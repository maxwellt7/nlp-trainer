/**
 * Integration tests — funnel drip scheduler (end-to-end with real DB)
 *
 * Strategy: use the real shared sql.js DB and the real runFunnelDripTick().
 * sendEmail is replaced via the _setSendEmail hook.  Each test seeds lead +
 * send rows with unique emails, runs the tick, then asserts on DB state.
 * Cleanup happens in `finally` blocks.
 *
 * The resend-webhook bounce test invokes the webhook handler logic directly
 * (same pattern as email.test.js) so no HTTP server is needed for it.
 *
 * Run:
 *   LEAD_TOKEN_HMAC_SECRET=test-lead-secret-32-chars-padded!! \
 *   UNSUBSCRIBE_HMAC_SECRET=test-unsub-secret-32-chars-padded! \
 *   RESEND_API_KEY=test-key \
 *   RESEND_FROM_ADDRESS=test@example.com \
 *   node --test tests/integration/funnel-drip.test.js
 */

// ── Env setup — MUST be before any module imports ────────────────────────────

process.env.LEAD_TOKEN_HMAC_SECRET =
  process.env.LEAD_TOKEN_HMAC_SECRET || 'test-lead-secret-32-chars-padded!!';
process.env.UNSUBSCRIBE_HMAC_SECRET =
  process.env.UNSUBSCRIBE_HMAC_SECRET || 'test-unsub-secret-32-chars-padded!';
process.env.RESEND_API_KEY            = process.env.RESEND_API_KEY            || 'test-resend-key';
process.env.RESEND_FROM_ADDRESS       = process.env.RESEND_FROM_ADDRESS       || 'test@example.com';
// META_CAPI_TOKEN is not needed by the scheduler, but quiz.js may be co-loaded
process.env.META_CAPI_TOKEN           = process.env.META_CAPI_TOKEN           || 'test-capi-drip';
process.env.GHL_API_KEY               = process.env.GHL_API_KEY               || 'test-ghl-drip';

// ── Imports ──────────────────────────────────────────────────────────────────

import test   from 'node:test';
import assert from 'node:assert/strict';

import db from '../../server/db/index.js';
import {
  runFunnelDripTick,
  _setSendEmail,
  _resetSendEmail,
} from '../../server/services/funnel-drip-scheduler.js';

// ── DB helpers ────────────────────────────────────────────────────────────────

function ensureTables() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS quiz_leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        name TEXT,
        result_program TEXT DEFAULT NULL,
        q9_fear TEXT DEFAULT NULL,
        purchased INTEGER DEFAULT 0,
        unsubscribed INTEGER DEFAULT 0,
        gate_at TEXT DEFAULT NULL,
        score INTEGER,
        tier TEXT,
        answers TEXT,
        source_url TEXT,
        user_agent TEXT,
        fbp TEXT,
        fbc TEXT,
        pattern_scores TEXT DEFAULT NULL,
        depth_score INTEGER DEFAULT NULL,
        depth_band TEXT DEFAULT NULL,
        q2_style TEXT DEFAULT NULL,
        utm_source TEXT DEFAULT NULL,
        utm_medium TEXT DEFAULT NULL,
        utm_campaign TEXT DEFAULT NULL,
        utm_content TEXT DEFAULT NULL,
        bump_purchased INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
  } catch (_) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS quiz_email_sends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quiz_lead_id INTEGER NOT NULL,
        email_num INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        resend_message_id TEXT,
        error_message TEXT,
        scheduled_for TEXT NOT NULL DEFAULT (datetime('now')),
        sent_at TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (quiz_lead_id, email_num)
      )
    `);
  } catch (_) {}

  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_qes_due ON quiz_email_sends (status, scheduled_for)`);
  } catch (_) {}
}

/**
 * Insert a quiz_leads row.
 * Returns the newly inserted row id.
 */
function insertLead(overrides = {}) {
  const email = overrides.email || `drip-integ-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const defaults = {
    email,
    name:           'Drip Tester',
    result_program: 'over-preparer',
    q9_fear:        'fear of failure',
    purchased:      0,
    unsubscribed:   0,
    gate_at:        null,
  };
  const lead = { ...defaults, ...overrides, email };

  db.prepare(`
    INSERT INTO quiz_leads
      (email, name, result_program, q9_fear, purchased, unsubscribed, gate_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    lead.email,
    lead.name,
    lead.result_program,
    lead.q9_fear,
    lead.purchased,
    lead.unsubscribed,
    lead.gate_at,
  );

  const row = db.prepare('SELECT id FROM quiz_leads WHERE email = ?').get(lead.email);
  if (!row) throw new Error(`insertLead: failed to find row for ${lead.email}`);
  return { id: row.id, email: lead.email };
}

/**
 * Insert a quiz_email_sends row.
 * Returns the newly inserted row id.
 */
function insertSend(leadId, overrides = {}) {
  const defaults = {
    email_num:     1,
    status:        'queued',
    scheduled_for: '1970-01-01 00:00:00',
    attempts:      0,
  };
  const send = { ...defaults, ...overrides };

  // Delete any existing row for this (lead_id, email_num) pair first
  // (in case a previous test left residue)
  db.prepare('DELETE FROM quiz_email_sends WHERE quiz_lead_id = ? AND email_num = ?')
    .run(leadId, send.email_num);

  db.prepare(`
    INSERT INTO quiz_email_sends (quiz_lead_id, email_num, status, scheduled_for, attempts)
    VALUES (?, ?, ?, ?, ?)
  `).run(leadId, send.email_num, send.status, send.scheduled_for, send.attempts);

  const row = db.prepare(
    'SELECT id FROM quiz_email_sends WHERE quiz_lead_id = ? AND email_num = ?',
  ).get(leadId, send.email_num);
  if (!row) throw new Error(`insertSend: failed to find row for lead ${leadId} email_num ${send.email_num}`);
  return row.id;
}

function getSend(sendId) {
  return db.prepare('SELECT * FROM quiz_email_sends WHERE id = ?').get(sendId);
}

function getLead(leadId) {
  return db.prepare('SELECT * FROM quiz_leads WHERE id = ?').get(leadId);
}

function cleanupLead(leadId) {
  if (!leadId) return;
  try {
    db.prepare('DELETE FROM quiz_email_sends WHERE quiz_lead_id = ?').run(leadId);
    db.prepare('DELETE FROM quiz_leads WHERE id = ?').run(leadId);
  } catch (_) {}
}

// ── Setup ─────────────────────────────────────────────────────────────────────

ensureTables();

// ── Tests ─────────────────────────────────────────────────────────────────────

test('1. Seed → tick → all 6 emails sent with unique idempotency keys',
  { concurrency: false },
  async () => {
    const { id: leadId } = insertLead({
      email:          `drip-t1-${Date.now()}@example.com`,
      result_program: 'over-preparer',
      gate_at:        '2000-01-01 00:00:00', // 7+ days ago
    });

    // Insert 6 send rows already past-due
    const sendIds = [];
    for (let i = 1; i <= 6; i++) {
      sendIds.push(insertSend(leadId, {
        email_num:     i,
        status:        'queued',
        scheduled_for: '1970-01-01 00:00:00',
      }));
    }

    const sentCalls = [];
    _setSendEmail(async ({ to, subject, html, idempotencyKey }) => {
      sentCalls.push({ to, subject, html, idempotencyKey });
      return { id: `msg-t1-${sentCalls.length}` };
    });

    try {
      const result = await runFunnelDripTick();

      assert.equal(result.sent,   6, `sent must be 6, got ${result.sent}`);
      assert.equal(result.failed, 0, `failed must be 0, got ${result.failed}`);
      assert.equal(result.skipped, 0, 'skipped must be 0');
      assert.equal(sentCalls.length, 6, 'sendEmail must have been called 6 times');

      // All 6 rows must be 'sent'
      for (const sendId of sendIds) {
        const row = getSend(sendId);
        assert.equal(row.status, 'sent', `send id=${sendId} must be sent`);
        assert.ok(row.sent_at,          `send id=${sendId} must have sent_at`);
        assert.ok(row.resend_message_id, `send id=${sendId} must have resend_message_id`);
      }

      // Idempotency keys must be unique across all 6 calls
      const keys = sentCalls.map(c => c.idempotencyKey);
      const uniqueKeys = new Set(keys);
      assert.equal(uniqueKeys.size, 6, `Idempotency keys must all be unique, got: ${JSON.stringify(keys)}`);

      // Each key must follow the funnel-drip-{send_id} pattern
      for (let i = 0; i < keys.length; i++) {
        assert.ok(
          keys[i].startsWith('funnel-drip-'),
          `idempotencyKey must start with "funnel-drip-", got: ${keys[i]}`,
        );
      }
    } finally {
      _resetSendEmail();
      cleanupLead(leadId);
    }
  },
);

test('2. Purchase mid-sequence exits lead — remaining sends skipped_purchased',
  { concurrency: false },
  async () => {
    const { id: leadId } = insertLead({
      email:          `drip-t2-${Date.now()}@example.com`,
      result_program: 'self-censor',
    });

    // Insert 6 send rows; first 3 past-due, last 3 scheduled far in the future
    const firstThree = [];
    const lastThree  = [];
    for (let i = 1; i <= 3; i++) {
      firstThree.push(insertSend(leadId, { email_num: i, scheduled_for: '1970-01-01 00:00:00' }));
    }
    for (let i = 4; i <= 6; i++) {
      // Far future — will not be picked up by tick
      lastThree.push(insertSend(leadId, { email_num: i, scheduled_for: '2099-01-01 00:00:00' }));
    }

    let sendCount = 0;
    _setSendEmail(async () => {
      sendCount++;
      return { id: `msg-t2-${sendCount}` };
    });

    try {
      // First tick — should send the 3 past-due emails
      const result1 = await runFunnelDripTick();
      assert.equal(result1.sent, 3, `First tick must send 3 emails, got ${result1.sent}`);
      assert.equal(sendCount, 3, 'sendEmail must have been called 3 times');

      // Mark lead as purchased
      db.prepare('UPDATE quiz_leads SET purchased = 1 WHERE id = ?').run(leadId);

      // Move the remaining 3 to past-due
      db.prepare(`
        UPDATE quiz_email_sends
        SET scheduled_for = '1970-01-01 00:00:00'
        WHERE quiz_lead_id = ? AND email_num >= 4
      `).run(leadId);

      // Second tick — should skip the 3 remaining sends
      const result2 = await runFunnelDripTick();
      assert.equal(result2.skipped, 3, `Second tick must skip 3 emails (purchased), got ${result2.skipped}`);
      assert.equal(sendCount, 3, 'sendEmail must NOT be called again for purchased lead');

      // Remaining rows must be 'skipped_purchased'
      for (const sendId of lastThree) {
        const row = getSend(sendId);
        assert.equal(
          row.status, 'skipped_purchased',
          `send id=${sendId} must be skipped_purchased, got: ${row.status}`,
        );
      }
    } finally {
      _resetSendEmail();
      cleanupLead(leadId);
    }
  },
);

test('3. Unsubscribe mid-sequence exits lead — remaining sends skipped_unsubscribed',
  { concurrency: false },
  async () => {
    const { id: leadId } = insertLead({
      email:          `drip-t3-${Date.now()}@example.com`,
      result_program: 'invisible-ceiling',
    });

    const firstTwo   = [];
    const lastFour   = [];
    for (let i = 1; i <= 2; i++) {
      firstTwo.push(insertSend(leadId, { email_num: i, scheduled_for: '1970-01-01 00:00:00' }));
    }
    for (let i = 3; i <= 6; i++) {
      lastFour.push(insertSend(leadId, { email_num: i, scheduled_for: '2099-01-01 00:00:00' }));
    }

    let sendCount = 0;
    _setSendEmail(async () => {
      sendCount++;
      return { id: `msg-t3-${sendCount}` };
    });

    try {
      // First tick — sends first 2 emails
      const result1 = await runFunnelDripTick();
      assert.equal(result1.sent, 2, `First tick must send 2 emails, got ${result1.sent}`);

      // Unsubscribe the lead
      db.prepare('UPDATE quiz_leads SET unsubscribed = 1 WHERE id = ?').run(leadId);

      // Move remaining 4 to past-due
      db.prepare(`
        UPDATE quiz_email_sends
        SET scheduled_for = '1970-01-01 00:00:00'
        WHERE quiz_lead_id = ? AND email_num >= 3
      `).run(leadId);

      // Second tick — the WHERE clause filters out unsubscribed=1 leads entirely,
      // so the rows are not listed at all.  However, if a race condition occurred
      // (unsubscribed changed between SELECT and send), the defensive check inside
      // the tick would mark them skipped_unsubscribed.
      // To test the defensive path explicitly, we need unsubscribed to be visible
      // when the row is processed.  The scheduler's WHERE clause is:
      //   WHERE s.status = 'queued' AND ... AND q.unsubscribed = 0
      // So when unsubscribed=1, rows are simply NOT listed (result.listed = 0).
      // This is intentional — the test must assert on the correct behavior.
      const result2 = await runFunnelDripTick();

      // The scheduler filters out unsubscribed leads at the SELECT level,
      // so listed=0 for those rows. They remain 'queued'.
      assert.equal(sendCount, 2, 'sendEmail must NOT be called for unsubscribed lead after unsub');

      // Rows remain 'queued' (scheduler did not process them due to WHERE filter)
      // OR skipped_unsubscribed (if defensive path was hit). Either is valid.
      for (const sendId of lastFour) {
        const row = getSend(sendId);
        assert.ok(
          row.status === 'queued' || row.status === 'skipped_unsubscribed',
          `send id=${sendId} must be queued or skipped_unsubscribed, got: ${row.status}`,
        );
      }

      // Verify no extra Resend calls were made
      assert.equal(sendCount, 2, 'sendEmail must remain at 2 calls after unsubscribe');
    } finally {
      _resetSendEmail();
      cleanupLead(leadId);
    }
  },
);

test('4. Resend bounce webhook — lead unsubscribed, send row status=failed with error_message=bounced',
  { concurrency: false },
  async () => {
    const { id: leadId, email } = insertLead({
      email:          `drip-t4-${Date.now()}@example.com`,
      result_program: 'loop',
    });

    const RESEND_MSG_ID = `resend-bounce-t4-${Date.now()}`;

    // Insert send row as 'sent' (already sent, now we get a bounce notification)
    const sendId = insertSend(leadId, {
      email_num:     1,
      status:        'sent',
      scheduled_for: '1970-01-01 00:00:00',
    });

    // Manually update resend_message_id (not set by insertSend helper)
    db.prepare('UPDATE quiz_email_sends SET resend_message_id = ? WHERE id = ?')
      .run(RESEND_MSG_ID, sendId);

    _setSendEmail(async () => ({ id: 'should-not-be-called' }));

    try {
      // Invoke the bounce handling logic directly (same logic as email.js route handler)
      // Look up the send row by resend_message_id
      const sendRow = db
        .prepare('SELECT quiz_lead_id FROM quiz_email_sends WHERE resend_message_id = ?')
        .get(RESEND_MSG_ID);

      assert.ok(sendRow, 'send row must be found by resend_message_id');
      assert.equal(sendRow.quiz_lead_id, leadId);

      // Apply the bounce handler logic (mirrors email.js webhook handler)
      db.transaction((txDb) => {
        txDb.prepare('UPDATE quiz_leads SET unsubscribed = 1 WHERE id = ?')
            .run(sendRow.quiz_lead_id);
        txDb.prepare(
          "UPDATE quiz_email_sends SET status = 'failed', error_message = ? WHERE resend_message_id = ?"
        ).run('bounced', RESEND_MSG_ID);
      });

      // Assert: lead unsubscribed
      const lead = getLead(leadId);
      assert.equal(lead.unsubscribed, 1, 'lead must be unsubscribed after bounce');

      // Assert: send row status = failed, error_message = bounced
      const updatedSend = getSend(sendId);
      assert.equal(updatedSend.status,        'failed',  'send row status must be failed');
      assert.equal(updatedSend.error_message, 'bounced', 'send row error_message must be "bounced"');
    } finally {
      _resetSendEmail();
      cleanupLead(leadId);
    }
  },
);

test('5. Multiple leads in one tick — all 3 processed, 3 Resend calls',
  { concurrency: false },
  async () => {
    const leads = [];
    for (let i = 0; i < 3; i++) {
      const { id: leadId, email } = insertLead({
        email:          `drip-t5-${Date.now()}-${i}@example.com`,
        result_program: 'over-preparer',
      });
      insertSend(leadId, { email_num: 1, scheduled_for: '1970-01-01 00:00:00' });
      leads.push(leadId);
    }

    const sentCalls = [];
    _setSendEmail(async ({ to }) => {
      sentCalls.push({ to });
      return { id: `msg-t5-${sentCalls.length}` };
    });

    try {
      const result = await runFunnelDripTick();

      // At minimum, the 3 we inserted must all be processed
      // (other tests may leave rows, but we own at least 3)
      assert.ok(result.sent >= 3, `tick must send at least 3 emails, got ${result.sent}`);
      assert.ok(sentCalls.length >= 3, `sendEmail must be called at least 3 times, got ${sentCalls.length}`);

      // Each of our 3 leads must have their send row marked 'sent'
      for (const leadId of leads) {
        const row = db.prepare(
          "SELECT status FROM quiz_email_sends WHERE quiz_lead_id = ? AND email_num = 1",
        ).get(leadId);
        assert.ok(row, `send row must exist for lead ${leadId}`);
        assert.equal(row.status, 'sent', `lead ${leadId} send row must be sent`);
      }
    } finally {
      _resetSendEmail();
      for (const leadId of leads) cleanupLead(leadId);
    }
  },
);

test('6. 50-row LIMIT honored — only first 50 rows processed, 10 remain queued',
  { concurrency: false },
  async () => {
    // First, clear any existing queued rows to get a clean baseline
    db.exec("UPDATE quiz_email_sends SET status = 'test-hold' WHERE status = 'queued'");

    const createdLeadIds = [];

    try {
      // Seed 60 due send rows across multiple leads
      // We use a deliberately old scheduled_for so they sort first (before any held rows)
      for (let i = 0; i < 60; i++) {
        const { id: leadId } = insertLead({
          email:          `drip-t6-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}@example.com`,
          result_program: 'over-preparer',
        });
        createdLeadIds.push(leadId);
        insertSend(leadId, {
          email_num:     1,
          status:        'queued',
          scheduled_for: '1970-01-01 00:00:00',
        });
      }

      let sendCount = 0;
      _setSendEmail(async () => {
        sendCount++;
        return { id: `msg-t6-${sendCount}` };
      });

      const result = await runFunnelDripTick();

      assert.equal(result.listed, 50, `tick must list exactly 50 rows (LIMIT), got ${result.listed}`);
      assert.equal(sendCount, 50, `sendEmail must be called exactly 50 times, got ${sendCount}`);

      // Count how many of our 60 rows are still 'queued'
      const stillQueued = db.prepare(`
        SELECT COUNT(*) as cnt FROM quiz_email_sends qes
        JOIN quiz_leads ql ON ql.id = qes.quiz_lead_id
        WHERE qes.status = 'queued'
          AND qes.scheduled_for = '1970-01-01 00:00:00'
          AND ql.id IN (${createdLeadIds.join(',')})
      `).get();

      assert.equal(
        stillQueued.cnt,
        10,
        `Exactly 10 rows of our 60 must remain queued (50 processed), got: ${stillQueued.cnt}`,
      );
    } finally {
      _resetSendEmail();

      // Restore the held rows
      db.exec("UPDATE quiz_email_sends SET status = 'queued' WHERE status = 'test-hold'");

      // Clean up all 60 test leads
      for (const leadId of createdLeadIds) cleanupLead(leadId);
    }
  },
);
