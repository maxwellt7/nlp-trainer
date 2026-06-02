// Backfill paid_users from Clerk's public_metadata.
//
// The problem: start.sovereignty.app's checkout writes purchase status to
// Clerk's public_metadata.plan as its source of truth, but our paid_users
// table only gets populated when our own Stripe webhook fires — and that
// webhook isn't the one Stripe is configured to deliver to. Every customer
// who came through the funnel has purchase metadata in Clerk but no
// paid_users row, which left them paywall-looped on heart.sovereignty.app
// (the access-gate now reads Clerk too, so the loop is gone — but
// paid_users is still empty, which breaks analytics, CSVs, and the
// welcome-email backfill).
//
// This service walks every Clerk user, finds the ones with a paid plan in
// public_metadata, and upserts them into paid_users. Optionally sends the
// welcome email to anyone who hasn't received it yet. Idempotent — safe
// to re-run, will only top up what's missing.

import { grantAccess } from './customer-diagnostic.js';
import { derivePaidPlanFromClerk } from '../../src/hooks/clerk-paid-status.js';

export function extractPrimaryEmail(user) {
  if (!user || !Array.isArray(user.email_addresses) || user.email_addresses.length === 0) {
    return null;
  }
  const primaryId = user.primary_email_address_id;
  const primary = primaryId
    ? user.email_addresses.find((e) => e?.id === primaryId)
    : null;
  return (primary || user.email_addresses[0])?.email_address || null;
}

export function extractFullName(user) {
  const first = String(user?.first_name ?? '').trim();
  const last = String(user?.last_name ?? '').trim();
  const joined = [first, last].filter(Boolean).join(' ').trim();
  return joined || null;
}

/**
 * @param {Object} args
 * @param {() => AsyncIterable<any>} args.listAllUsers — yields every Clerk
 *   user (the caller is responsible for paginating the Clerk Backend API).
 * @param {Object} args.db — better-sqlite3-shaped db handle.
 * @param {(args: { email: string, name: string|null }) => Promise<{ ok: boolean, id?: string, error?: string, skipped?: boolean }>} [args.sendWelcome]
 *   — optional. If omitted, the sync only updates paid_users and never
 *   touches the email path.
 */
export async function syncClerkPaidUsers({ listAllUsers, db, sendWelcome }) {
  const summary = {
    scanned: 0,
    paid: 0,
    created: 0,
    reactivated: 0,
    emails_sent: 0,
    emails_skipped_already_sent: 0,
    errors: [],
  };

  for await (const clerkUser of listAllUsers()) {
    summary.scanned += 1;

    const plan = derivePaidPlanFromClerk(clerkUser);
    if (!plan) continue;
    summary.paid += 1;

    const email = extractPrimaryEmail(clerkUser);
    if (!email) {
      summary.errors.push({ user_id: clerkUser?.id, error: 'no email on Clerk user' });
      continue;
    }
    const name = extractFullName(clerkUser);

    let grant;
    try {
      grant = grantAccess(db, { email, name });
    } catch (err) {
      summary.errors.push({ email, error: `grantAccess failed: ${err.message}` });
      continue;
    }
    if (grant.action === 'created') summary.created += 1;
    else if (grant.action === 'reactivated') summary.reactivated += 1;
    else if (grant.action === 'error') {
      summary.errors.push({ email, error: grant.error });
      continue;
    }

    if (typeof sendWelcome === 'function') {
      try {
        const row = db
          .prepare(`SELECT welcome_email_sent_at FROM paid_users WHERE email = ?`)
          .get(grant.email);
        if (row && row.welcome_email_sent_at) {
          summary.emails_skipped_already_sent += 1;
        } else {
          const result = await sendWelcome({ email: grant.email, name });
          if (result?.ok) {
            db.prepare(`UPDATE paid_users SET welcome_email_sent_at = datetime('now') WHERE email = ?`)
              .run(grant.email);
            summary.emails_sent += 1;
          } else if (result?.skipped) {
            // Don't count as error — environment doesn't have Resend yet.
          } else {
            summary.errors.push({ email: grant.email, error: result?.error || 'unknown send error' });
          }
        }
      } catch (err) {
        summary.errors.push({ email: grant.email, error: `welcome email step failed: ${err.message}` });
      }
    }
  }

  return summary;
}
