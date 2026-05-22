/**
 * Tests for server/services/funnel-drip-scheduler.js
 *
 * Strategy:
 *   - The scheduler imports `db` from '../db/index.js' (the shared in-memory
 *     sql.js instance). Each test inserts unique rows identified by a unique
 *     email or send id, then cleans them up in a `finally` block.
 *   - `sendEmail` is replaced per-test via the `_setSendEmail` / `_resetSendEmail`
 *     injection hooks exported by the scheduler module.
 *   - Tests run with `{ concurrency: false }` to prevent interleaved DB state.
 *
 * Run:
 *   node --test server/services/funnel-drip-scheduler.test.js
 * (from the nlp-trainer root)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ── Env setup — must happen before importing modules that read env at load time ──

process.env.RESEND_API_KEY            = process.env.RESEND_API_KEY            || 'test-resend-key';
process.env.RESEND_FROM_ADDRESS       = process.env.RESEND_FROM_ADDRESS       || 'test@example.com';
process.env.LEAD_TOKEN_HMAC_SECRET    = process.env.LEAD_TOKEN_HMAC_SECRET    || 'test-lead-secret-32-chars-padded!!';
process.env.UNSUBSCRIBE_HMAC_SECRET   = process.env.UNSUBSCRIBE_HMAC_SECRET   || 'test-unsub-secret-32-chars-padded!';

import db from '../db/index.js';
import {
  runFunnelDripTick,
  _setSendEmail,
  _resetSendEmail,
} from './funnel-drip-scheduler.js';
import { ResendRetryableError, ResendPermanentError } from './resend.js';

// ── DB helpers ───────────────────────────────────────────────────────────────

/** Ensure tables exist (idempotent). */
function ensureTables() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS quiz_leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        name TEXT,
        score INTEGER,
        tier TEXT,
        answers TEXT,
        source_url TEXT,
        user_agent TEXT,
        fbp TEXT,
        fbc TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        pattern_scores TEXT DEFAULT NULL,
        result_program TEXT DEFAULT NULL,
        depth_score INTEGER DEFAULT NULL,
        depth_band TEXT DEFAULT NULL,
        q2_style TEXT DEFAULT NULL,
        q9_fear TEXT DEFAULT NULL,
        utm_source TEXT DEFAULT NULL,
        utm_medium TEXT DEFAULT NULL,
        utm_campaign TEXT DEFAULT NULL,
        utm_content TEXT DEFAULT NULL,
        gate_at TEXT DEFAULT NULL,
        unsubscribed INTEGER DEFAULT 0,
        purchased INTEGER DEFAULT 0,
        bump_purchased INTEGER DEFAULT 0
      )
    `);
  } catch (_) { /* already exists */ }

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
  } catch (_) { /* already exists */ }

  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_qes_due ON quiz_email_sends (status, scheduled_for)`);
  } catch (_) { /* already exists */ }
}

/** Insert a lead row, returns its integer id.
 *
 * NOTE: sql.js's rawDb.export() (called by save() inside db.prepare().run())
 * resets last_insert_rowid() to 0 as a side-effect.  We work around this by
 * looking up the row by the unique email immediately after inserting it.
 */
function insertLead(overrides = {}) {
  const defaults = {
    email:          `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    name:           'Test User',
    result_program: 'over-preparer',
    q9_fear:        'fear of failure',
    purchased:      0,
    unsubscribed:   0,
  };
  const lead = { ...defaults, ...overrides };

  db.prepare(`
    INSERT INTO quiz_leads (email, name, result_program, q9_fear, purchased, unsubscribed)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(lead.email, lead.name, lead.result_program, lead.q9_fear, lead.purchased, lead.unsubscribed);

  // last_insert_rowid() is reset by save() — look up by unique email instead
  const row = db.prepare('SELECT id FROM quiz_leads WHERE email = ?').get(lead.email);
  if (!row) throw new Error(`insertLead: failed to find row for ${lead.email}`);
  return row.id;
}

/** Insert a send row, returns its integer id.
 *
 * Same sql.js caveat: last_insert_rowid() is reset by save(), so we look up
 * by the unique (quiz_lead_id, email_num) pair.
 */
function insertSend(leadId, overrides = {}) {
  const defaults = {
    email_num:     1,
    status:        'queued',
    scheduled_for: '1970-01-01 00:00:00', // always in the past → always due
    attempts:      0,
  };
  const send = { ...defaults, ...overrides };

  db.prepare(`
    INSERT INTO quiz_email_sends (quiz_lead_id, email_num, status, scheduled_for, attempts)
    VALUES (?, ?, ?, ?, ?)
  `).run(leadId, send.email_num, send.status, send.scheduled_for, send.attempts);

  // Look up by (quiz_lead_id, email_num) which has a UNIQUE constraint
  const row = db.prepare(
    'SELECT id FROM quiz_email_sends WHERE quiz_lead_id = ? AND email_num = ?',
  ).get(leadId, send.email_num);
  if (!row) throw new Error(`insertSend: failed to find send row for lead ${leadId} email_num ${send.email_num}`);
  return row.id;
}

/** Read back a send row by id. */
function getSend(sendId) {
  return db.prepare('SELECT * FROM quiz_email_sends WHERE id = ?').get(sendId);
}

/** Clean up a lead and all its send rows. */
function cleanupLead(leadId) {
  if (!leadId) return;
  db.prepare('DELETE FROM quiz_email_sends WHERE quiz_lead_id = ?').run(leadId);
  db.prepare('DELETE FROM quiz_leads WHERE id = ?').run(leadId);
}

// ── Setup ────────────────────────────────────────────────────────────────────

ensureTables();

// ── Test 1: Empty queue ──────────────────────────────────────────────────────
// Run with serial concurrency so we don't collide with other tests' inserts.

test('empty queue — tick returns all-zero result, no sendEmail call', { concurrency: false }, async () => {
  // Wipe all queued sends to guarantee a clean state for this test
  db.exec("DELETE FROM quiz_email_sends WHERE status = 'queued'");

  let sendCalled = false;
  _setSendEmail(async () => {
    sendCalled = true;
    return { id: 'should-not-be-called' };
  });

  try {
    const result = await runFunnelDripTick();

    assert.deepEqual(result, { listed: 0, sent: 0, skipped: 0, failed: 0 });
    assert.equal(sendCalled, false, 'sendEmail must not be called on empty queue');
  } finally {
    _resetSendEmail();
  }
});

// ── Test 2: Single due row, all conditions met ───────────────────────────────

test('single due row — tick marks status=sent, stores resend_message_id', { concurrency: false }, async () => {
  const leadId = insertLead({ email: `happy-${Date.now()}@example.com`, result_program: 'over-preparer' });
  const sendId = insertSend(leadId, { email_num: 1 });

  const FAKE_MSG_ID = 'resend-msg-abc123';

  _setSendEmail(async ({ to, subject, html, idempotencyKey }) => {
    assert.ok(subject.length > 0,  'subject should be non-empty');
    assert.ok(html.length   > 0,  'html should be non-empty');
    assert.equal(idempotencyKey, `funnel-drip-${sendId}`);
    return { id: FAKE_MSG_ID };
  });

  try {
    const result = await runFunnelDripTick();

    assert.equal(result.listed, 1, 'listed must be 1');
    assert.equal(result.sent,   1, 'sent must be 1');
    assert.equal(result.skipped, 0);
    assert.equal(result.failed,  0);

    const row = getSend(sendId);
    assert.equal(row.status,            'sent',       'status must be sent');
    assert.equal(row.resend_message_id, FAKE_MSG_ID,  'resend_message_id must be stored');
    assert.ok(row.sent_at,                            'sent_at must be set');
  } finally {
    _resetSendEmail();
    cleanupLead(leadId);
  }
});

// ── Test 3: Purchased lead skip ──────────────────────────────────────────────

test('purchased lead — tick marks status=skipped_purchased, no sendEmail call', { concurrency: false }, async () => {
  const leadId = insertLead({
    email:          `buyer-${Date.now()}@example.com`,
    result_program: 'loop',
    purchased:      1,
  });
  const sendId = insertSend(leadId, { email_num: 2 });

  let sendCalled = false;
  _setSendEmail(async () => { sendCalled = true; return { id: 'x' }; });

  try {
    const result = await runFunnelDripTick();

    assert.equal(result.skipped, 1, 'skipped must be 1');
    assert.equal(result.sent,    0, 'sent must be 0');
    assert.equal(sendCalled, false, 'sendEmail must not be called for purchased leads');

    const row = getSend(sendId);
    assert.equal(row.status, 'skipped_purchased');
  } finally {
    _resetSendEmail();
    cleanupLead(leadId);
  }
});

// ── Test 4: Unsubscribed lead not selected ───────────────────────────────────
// The scheduler's SELECT filters `q.unsubscribed = 0`, so an unsubscribed
// lead's send row is never fetched — it stays 'queued' and sendEmail is not
// called.  The defensive re-check inside the tick guards a race condition
// where a lead is unsubscribed between SELECT and send; that race can't be
// reproduced in a synchronous unit test.

test('unsubscribed lead — row stays queued (filtered by WHERE clause), no sendEmail call', { concurrency: false }, async () => {
  // insertLead uses a unique email — pass unsubscribed:1 directly
  const unsubEmail = `unsub-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const leadId = insertLead({
    email:          unsubEmail,
    result_program: 'self-censor',
    unsubscribed:   1,
  });
  const sendId = insertSend(leadId, { email_num: 3 });

  let sendCalled = false;
  _setSendEmail(async () => { sendCalled = true; return { id: 'y' }; });

  try {
    const result = await runFunnelDripTick();

    assert.equal(result.listed, 0, 'unsubscribed row must not be listed');
    assert.equal(sendCalled, false, 'sendEmail must not be called for unsubscribed leads');

    const row = getSend(sendId);
    assert.equal(row.status, 'queued', 'row must remain queued (was never fetched)');
  } finally {
    _resetSendEmail();
    cleanupLead(leadId);
  }
});

// ── Test 5: Resend retryable error — first retry ─────────────────────────────

test('retryable error — attempts incremented, status stays queued, scheduled_for bumped +1h', { concurrency: false }, async () => {
  const leadId = insertLead({
    email:          `retry-${Date.now()}@example.com`,
    result_program: 'invisible-ceiling',
  });
  const sendId = insertSend(leadId, { email_num: 1, attempts: 0 });

  _setSendEmail(async () => {
    throw new ResendRetryableError('rate limited (429)', 429);
  });

  try {
    const result = await runFunnelDripTick();

    assert.equal(result.listed,  1, 'listed must be 1');
    assert.equal(result.sent,    0, 'sent must be 0');
    assert.equal(result.failed,  0, 'failed must be 0 (still queued for retry)');

    const row = getSend(sendId);
    assert.equal(row.status,   'queued', 'status must remain queued on retryable error');
    assert.equal(row.attempts, 1,        'attempts must be incremented to 1');

    // scheduled_for should be ~1 hour in the future
    const scheduledFor = new Date(row.scheduled_for.replace(' ', 'T') + 'Z');
    const diffMs       = scheduledFor.getTime() - Date.now();
    assert.ok(diffMs > 50 * 60 * 1000, 'scheduled_for must be at least 50 min ahead');
    assert.ok(diffMs < 70 * 60 * 1000, 'scheduled_for must be no more than 70 min ahead');
  } finally {
    _resetSendEmail();
    cleanupLead(leadId);
  }
});

// ── Test 6: Max retries ───────────────────────────────────────────────────────

test('max retries (attempts=2) — increments to 3, status=failed, error_message=max retries', { concurrency: false }, async () => {
  const leadId = insertLead({
    email:          `maxretry-${Date.now()}@example.com`,
    result_program: 'loop',
  });
  const sendId = insertSend(leadId, { email_num: 4, attempts: 2 });

  _setSendEmail(async () => {
    throw new ResendRetryableError('service unavailable (503)', 503);
  });

  try {
    const result = await runFunnelDripTick();

    assert.equal(result.failed, 1, 'failed must be 1');

    const row = getSend(sendId);
    assert.equal(row.status,        'failed',      'status must be failed at max retries');
    assert.equal(row.attempts,      3,             'attempts must be 3');
    assert.equal(row.error_message, 'max retries', 'error_message must say "max retries"');
  } finally {
    _resetSendEmail();
    cleanupLead(leadId);
  }
});

// ── Test 7: Permanent error ──────────────────────────────────────────────────

test('permanent error — status=failed, error_message captured from exception', { concurrency: false }, async () => {
  const leadId = insertLead({
    email:          `permerr-${Date.now()}@example.com`,
    result_program: 'self-censor',
  });
  const sendId = insertSend(leadId, { email_num: 5 });

  const PERM_MSG = 'Client error (422): invalid email format';
  _setSendEmail(async () => {
    throw new ResendPermanentError(PERM_MSG, 422);
  });

  try {
    const result = await runFunnelDripTick();

    assert.equal(result.failed, 1, 'failed must be 1');

    const row = getSend(sendId);
    assert.equal(row.status,        'failed',  'status must be failed');
    assert.equal(row.error_message, PERM_MSG,  'error_message must match the permanent error message');
  } finally {
    _resetSendEmail();
    cleanupLead(leadId);
  }
});

// ── Test 8: Invalid result_program ──────────────────────────────────────────

test('invalid result_program — status=failed, error_message=invalid_result_program, no sendEmail call', { concurrency: false }, async () => {
  // Lead with null result_program — use insertLead with result_program: null
  const badEmail = `badprog-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  db.prepare(`
    INSERT INTO quiz_leads (email, name, result_program, q9_fear, purchased, unsubscribed)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(badEmail, 'Bad Prog', null, 'fear', 0, 0);

  const lead   = db.prepare('SELECT id FROM quiz_leads WHERE email = ?').get(badEmail);
  const leadId = lead.id;
  const sendId = insertSend(leadId, { email_num: 1 });

  let sendCalled = false;
  _setSendEmail(async () => { sendCalled = true; return { id: 'z' }; });

  try {
    const result = await runFunnelDripTick();

    assert.equal(result.failed,  1,     'failed must be 1');
    assert.equal(result.sent,    0,     'sent must be 0');
    assert.equal(sendCalled, false,     'sendEmail must not be called for invalid result_program');

    const row = getSend(sendId);
    assert.equal(row.status,        'failed',                 'status must be failed');
    assert.equal(row.error_message, 'invalid_result_program', 'error_message must be invalid_result_program');
  } finally {
    _resetSendEmail();
    cleanupLead(leadId);
  }
});
