// Periodic Clerk → paid_users sync.
//
// Belt-and-suspenders for the Stripe webhook. start.sovereignty.app's
// checkout writes purchase status to Clerk public_metadata; our Stripe
// webhook on heart.sovereignty.app/Railway also fires (once the second
// endpoint is added in Stripe Dashboard) and provisions paid_users +
// emails immediately. If the webhook ever drops a delivery (network blip,
// Stripe retry exhaustion, dev outage) this cron catches it within
// CLERK_PAID_SYNC_INTERVAL_MINUTES, walks every Clerk user, and ensures
// every paying customer has a paid_users row + welcome email.
//
// Idempotent: syncClerkPaidUsers checks welcome_email_sent_at before
// sending, so a customer caught by both the webhook AND the cron only
// gets one email.

import cron from 'node-cron';
import db from '../db/index.js';
import { syncClerkPaidUsers } from './clerk-paid-sync.js';
import { paginateClerkUsers } from './clerk-users-paginator.js';
import { sendWelcomeEmail } from './welcome-email.js';

export const DEFAULT_INTERVAL_MIN = 10;

export function intervalToCron(minutes) {
  const m = Math.max(5, Math.min(720, Number(minutes) || DEFAULT_INTERVAL_MIN));
  if (m === 60) return '0 * * * *';
  if (m % 60 === 0) return `0 */${m / 60} * * *`;
  return `*/${m} * * * *`;
}

let started = false;

export function initClerkPaidSyncScheduler() {
  if (started) return;

  const apiKey = process.env.CLERK_SECRET_KEY;
  if (!apiKey) {
    console.log('[Clerk Paid Sync] disabled — CLERK_SECRET_KEY not set');
    return;
  }

  const expr = intervalToCron(process.env.CLERK_PAID_SYNC_INTERVAL_MINUTES);
  console.log(`[Clerk Paid Sync] cron registered: ${expr}`);

  const runOnce = async () => {
    try {
      const summary = await syncClerkPaidUsers({
        listAllUsers: () => paginateClerkUsers({ apiKey }),
        db,
        sendWelcome: ({ email, name }) => sendWelcomeEmail({ email, name }),
      });
      // Only log when something interesting happens. A 10-minute cron
      // hitting 0/0/0 every tick on a quiet day is just log spam.
      const interesting =
        summary.created > 0 ||
        summary.reactivated > 0 ||
        summary.emails_sent > 0 ||
        summary.errors.length > 0;
      if (interesting) {
        console.log('[Clerk Paid Sync] tick:', JSON.stringify(summary));
      }
    } catch (err) {
      console.error('[Clerk Paid Sync] tick failed:', err.message);
    }
  };

  cron.schedule(expr, runOnce);
  // Also run once on startup so a freshly-deployed instance reconciles
  // immediately instead of waiting for the first cron tick.
  setImmediate(runOnce);

  started = true;
}
