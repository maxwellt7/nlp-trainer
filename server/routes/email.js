/**
 * Email routes — two focused endpoints:
 *
 *   GET  /api/email/unsubscribe?token=...   — one-click unsubscribe (HMAC-verified)
 *   POST /api/email/resend-webhook          — Resend delivery event handler (svix-verified)
 *
 * Spec: §5.2
 */

import express from 'express';
import { Webhook, WebhookVerificationError } from 'svix';
import { verifyUnsubToken } from '../middleware/tokens.js';
import db from '../db/index.js';

const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal HTML wrapper for user-facing pages. */
function htmlPage(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:sans-serif;max-width:480px;margin:80px auto;padding:0 16px;line-height:1.6}</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

// ── GET /api/email/unsubscribe ────────────────────────────────────────────────

/**
 * One-click unsubscribe endpoint.
 *
 * Query params:
 *   token — HMAC-signed unsub token produced by signUnsubToken(email, leadId)
 *
 * On valid token → UPDATE quiz_leads SET unsubscribed = 1 WHERE id = ? AND email = ?
 * Returns 200 HTML.  All failure paths return 404 HTML (neutral "Not found").
 * Idempotent: already-unsubscribed lead is accepted without error.
 */
router.get('/unsubscribe', (req, res) => {
  res.set('Cache-Control', 'no-store');

  const { token } = req.query;

  // All failure paths → same neutral 404 (no info leakage)
  const notFound = () =>
    res.status(404).send(
      htmlPage('Not found', '<h2>Not found</h2><p>This page could not be found.</p>')
    );

  // 1. Verify token
  const payload = verifyUnsubToken(token);
  if (!payload) return notFound();

  const { email, lead_id } = payload;

  // 2. Update — both columns must match (prevents forged lead_id unsubscribing another email)
  let result;
  try {
    result = db
      .prepare('UPDATE quiz_leads SET unsubscribed = 1 WHERE id = ? AND email = ?')
      .run(lead_id, email);
  } catch (err) {
    console.error('[email/unsubscribe] DB error:', err.message);
    return notFound();
  }

  // 3. If nothing matched, the lead doesn't exist (or email/id mismatch)
  if (result.changes === 0) {
    // Double-check: already unsubscribed is fine (idempotent)
    let existing;
    try {
      existing = db
        .prepare('SELECT unsubscribed FROM quiz_leads WHERE id = ? AND email = ?')
        .get(lead_id, email);
    } catch (_) {
      // ignore
    }
    if (!existing) return notFound();
    // existing exists but changes = 0 means it was already unsubscribed = 1 — fall through to 200
  }

  return res.status(200).send(
    htmlPage(
      "You've been unsubscribed",
      `<h2>You've been unsubscribed</h2>
<p>You won't receive any more emails from us.</p>
<p style="color:#666;font-size:.9em">If this was a mistake, reply to any prior email and we'll add you back.</p>`
    )
  );
});

// ── POST /api/email/resend-webhook ────────────────────────────────────────────

/**
 * Resend delivery-event webhook.
 *
 * Uses express.raw() on this route only — the global JSON parser is not changed.
 * Signature verified via svix Webhook.verify() before any DB writes.
 *
 * Handled event types (§5.2):
 *   email.delivered  → no-op (v1)
 *   email.opened     → no-op (v1)
 *   email.clicked    → no-op (v1)
 *   email.bounced    → unsubscribe lead + mark send row failed
 *   email.complained → unsubscribe lead + mark send row failed
 */
router.post(
  '/resend-webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[resend-webhook] RESEND_WEBHOOK_SECRET not set');
      return res.status(401).json({ error: 'invalid signature' });
    }

    // svix Webhook expects the secret to be base64-encoded.
    // Resend stores the webhook secret as "whsec_<base64>" — pass it as-is.
    let wh;
    try {
      wh = new Webhook(secret);
    } catch (err) {
      console.error('[resend-webhook] Failed to init Webhook verifier:', err.message);
      return res.status(401).json({ error: 'invalid signature' });
    }

    // Verify signature — throws WebhookVerificationError on failure
    let event;
    try {
      const payload = req.body; // Buffer (express.raw)
      event = wh.verify(payload, req.headers);
    } catch (err) {
      if (err instanceof WebhookVerificationError) {
        return res.status(401).json({ error: 'invalid signature' });
      }
      // Malformed JSON or other parse error
      console.error('[resend-webhook] Verify error:', err.message);
      return res.status(400).json({ error: 'bad request' });
    }

    const eventType = event?.type;
    console.log(`[resend-webhook] Received event: ${eventType}`);

    // No-op events — acknowledge immediately
    if (
      eventType === 'email.delivered' ||
      eventType === 'email.opened' ||
      eventType === 'email.clicked'
    ) {
      return res.status(200).json({ received: true });
    }

    // Bounce / complaint handling
    if (eventType === 'email.bounced' || eventType === 'email.complained') {
      // Resend webhook event schema:
      //   { type: "email.bounced", data: { email_id: "...", ... } }
      const resendMessageId = event?.data?.email_id;
      const errorMessage = eventType === 'email.bounced' ? 'bounced' : 'complained';

      if (!resendMessageId) {
        console.warn(`[resend-webhook] ${eventType} event missing data.email_id — skipping DB update`);
        return res.status(200).json({ received: true });
      }

      try {
        // Look up the send row by resend_message_id
        const sendRow = db
          .prepare('SELECT quiz_lead_id FROM quiz_email_sends WHERE resend_message_id = ?')
          .get(resendMessageId);

        if (sendRow) {
          db.transaction((txDb) => {
            // Mark lead as unsubscribed
            txDb
              .prepare('UPDATE quiz_leads SET unsubscribed = 1 WHERE id = ?')
              .run(sendRow.quiz_lead_id);

            // Mark send row as failed
            txDb
              .prepare(
                "UPDATE quiz_email_sends SET status = 'failed', error_message = ? WHERE resend_message_id = ?"
              )
              .run(errorMessage, resendMessageId);
          });

          console.log(
            `[resend-webhook] ${eventType} — lead ${sendRow.quiz_lead_id} unsubscribed, send row marked failed`
          );
        } else {
          console.warn(`[resend-webhook] No send row found for resend_message_id=${resendMessageId}`);
        }
      } catch (err) {
        console.error(`[resend-webhook] DB error on ${eventType}:`, err.message);
        // Still return 200 so Resend doesn't retry indefinitely
      }

      return res.status(200).json({ received: true });
    }

    // Unknown event type — acknowledge
    console.log(`[resend-webhook] Unhandled event type: ${eventType}`);
    return res.status(200).json({ received: true });
  }
);

export default router;
