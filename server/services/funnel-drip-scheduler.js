// Funnel drip email scheduler.
//
// Fires every 15 minutes: */15 * * * * (America/Los_Angeles).
// Picks up queued rows from quiz_email_sends, renders & sends via Resend,
// and handles retries according to the defined retry policy.
//
// Boot integration: call initFunnelDripScheduler() from server/index.js.
// Testing: import runFunnelDripTick() directly — no cron required.

import cron from 'node-cron';
import React from 'react';
import db from '../db/index.js';
import { sendEmail, ResendRetryableError, ResendPermanentError } from './resend.js';
import { signLeadToken } from '../middleware/tokens.js';
import { signUnsubToken } from '../middleware/tokens.js';
import { PROGRAM_MERGES } from '../emails/data/program-merges.js';
import { SUBJECT_LINES } from '../emails/data/subject-lines.js';
import { renderEmail } from '../emails/_shared/render.js';

// ── Config ───────────────────────────────────────────────────────────────────

const CRON_EXPR = '*/15 * * * *';
const CRON_TZ   = 'America/Los_Angeles';

const BACKEND_URL = process.env.BACKEND_URL
  || 'https://nlp-training-backend-production.up.railway.app';

const ALIGN_FUNNEL_URL = process.env.ALIGN_FUNNEL_URL
  || 'https://align.sovereignty.app';

// ── Template registry (lazy dynamic imports) ─────────────────────────────────

const TEMPLATES = {
  1: () => import('../emails/01-result-recap.js'),
  2: () => import('../emails/02-mechanism.js'),
  3: () => import('../emails/03-proof.js'),
  4: () => import('../emails/04-fear.js'),
  5: () => import('../emails/05-objections.js'),
  6: () => import('../emails/06-last-call.js'),
};

// ── Module-level sendEmail handle (tests can replace this reference) ──────────

let _sendEmail = sendEmail;

/** @internal — for test injection only */
export function _setSendEmail(fn) { _sendEmail = fn; }
/** @internal — reset to real implementation */
export function _resetSendEmail()  { _sendEmail = sendEmail; }

// ── Tick algorithm ───────────────────────────────────────────────────────────

/**
 * Process up to 50 due funnel drip emails.
 *
 * @returns {Promise<{listed: number, sent: number, skipped: number, failed: number}>}
 */
export async function runFunnelDripTick() {
  const rows = db.prepare(`
    SELECT
      s.id           AS send_id,
      s.email_num,
      s.scheduled_for,
      s.attempts,
      q.id           AS lead_id,
      q.email,
      q.name,
      q.result_program,
      q.q9_fear,
      q.purchased,
      q.unsubscribed
    FROM quiz_email_sends s
    JOIN quiz_leads q ON q.id = s.quiz_lead_id
    WHERE s.status = 'queued'
      AND s.scheduled_for <= datetime('now')
      AND q.unsubscribed = 0
    ORDER BY s.scheduled_for ASC
    LIMIT 50
  `).all();

  const result = { listed: rows.length, sent: 0, skipped: 0, failed: 0 };

  for (const row of rows) {
    const {
      send_id,
      email_num,
      attempts,
      lead_id,
      email,
      name,
      result_program,
      purchased,
      unsubscribed,
    } = row;

    // a. Skip purchased leads
    if (purchased) {
      db.prepare(`UPDATE quiz_email_sends SET status = 'skipped_purchased' WHERE id = ?`)
        .run(send_id);
      result.skipped++;
      continue;
    }

    // b. Defensive re-check of unsubscribed
    if (unsubscribed) {
      db.prepare(`UPDATE quiz_email_sends SET status = 'skipped_unsubscribed' WHERE id = ?`)
        .run(send_id);
      result.skipped++;
      continue;
    }

    // c/d. Validate result_program → look up merge vars
    if (!result_program || !(result_program in PROGRAM_MERGES)) {
      db.prepare(`
        UPDATE quiz_email_sends
        SET status = 'failed', error_message = 'invalid_result_program'
        WHERE id = ?
      `).run(send_id);
      result.failed++;
      continue;
    }

    const merges = PROGRAM_MERGES[result_program];

    try {
      // e. Build unsub URL
      const unsubToken   = signUnsubToken(email, lead_id);
      const unsubscribe_url = `${BACKEND_URL}/api/email/unsubscribe?token=${unsubToken}`;

      // f. Build offer URL
      const offerToken = signLeadToken(lead_id);
      const offer_url  = `${ALIGN_FUNNEL_URL}/start/result?token=${offerToken}`;

      // g. Load template + render
      const templateModule = await TEMPLATES[email_num]();
      const first_name = name?.split(' ')[0] || 'there';

      const element = React.createElement(templateModule.default, {
        first_name,
        program:      merges.program,
        program_line: merges.program_line,
        fear_line:    merges.fear_line,
        offer_url,
        unsubscribe_url,
      });
      const html = await renderEmail(element);

      // h. Compute subject
      const subject = SUBJECT_LINES[email_num]({ first_name });

      // i. Send
      const sendResult = await _sendEmail({
        to:             email,
        subject,
        html,
        idempotencyKey: `funnel-drip-${send_id}`,
      });

      // j. Mark sent
      db.prepare(`
        UPDATE quiz_email_sends
        SET status = 'sent',
            resend_message_id = ?,
            sent_at = datetime('now')
        WHERE id = ?
      `).run(sendResult.id, send_id);
      result.sent++;

    } catch (err) {
      if (err instanceof ResendRetryableError) {
        // k. Retryable — increment attempts; max 3
        const newAttempts = attempts + 1;
        if (newAttempts >= 3) {
          db.prepare(`
            UPDATE quiz_email_sends
            SET status = 'failed',
                attempts = ?,
                error_message = 'max retries'
            WHERE id = ?
          `).run(newAttempts, send_id);
          result.failed++;
        } else {
          db.prepare(`
            UPDATE quiz_email_sends
            SET attempts = ?,
                scheduled_for = datetime('now', '+1 hour')
            WHERE id = ?
          `).run(newAttempts, send_id);
          // row stays 'queued'; don't count as failed or sent
        }
      } else if (err instanceof ResendPermanentError) {
        // l. Permanent error
        db.prepare(`
          UPDATE quiz_email_sends
          SET status = 'failed', error_message = ?
          WHERE id = ?
        `).run(err.message, send_id);
        result.failed++;
      } else {
        // Unexpected — treat as permanent to avoid infinite loops
        db.prepare(`
          UPDATE quiz_email_sends
          SET status = 'failed', error_message = ?
          WHERE id = ?
        `).run(err.message || 'unexpected error', send_id);
        result.failed++;
      }
    }
  }

  console.log('[FunnelDrip] tick complete:', JSON.stringify(result));
  return result;
}

// ── Boot init ─────────────────────────────────────────────────────────────────

let started = false;

/**
 * Register the funnel drip cron job. Safe to call at boot — silently skips
 * registration if required env vars are absent (won't crash the server).
 */
export function initFunnelDripScheduler() {
  if (started) return;

  const missingVars = ['RESEND_API_KEY', 'RESEND_FROM_ADDRESS'].filter(
    v => !process.env[v],
  );

  if (missingVars.length > 0) {
    console.warn(
      `[FunnelDrip] scheduler disabled — missing env vars: ${missingVars.join(', ')}`,
    );
    return;
  }

  console.log(`[FunnelDrip] cron registered: ${CRON_EXPR} (${CRON_TZ})`);

  cron.schedule(CRON_EXPR, async () => {
    try {
      await runFunnelDripTick();
    } catch (err) {
      console.error('[FunnelDrip] tick error:', err.message);
    }
  }, { timezone: CRON_TZ });

  // Catch-up tick on startup
  setImmediate(async () => {
    try {
      await runFunnelDripTick();
    } catch (err) {
      console.error('[FunnelDrip] startup tick error:', err.message);
    }
  });

  started = true;
}
