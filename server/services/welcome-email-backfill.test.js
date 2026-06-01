import test from 'node:test';
import assert from 'node:assert/strict';
import { runWelcomeEmailBackfill } from './welcome-email-backfill.js';

function makeDb(initialRows) {
  const rows = initialRows.map((r) => ({ ...r }));
  return {
    rows,
    prepare(sql) {
      if (/SELECT.*welcome_email_sent_at IS NULL/i.test(sql)) {
        return {
          all: () => rows.filter((r) => !r.welcome_email_sent_at),
        };
      }
      if (/UPDATE paid_users SET welcome_email_sent_at/i.test(sql)) {
        return {
          run: (emailParam) => {
            const r = rows.find((x) => x.email === emailParam);
            if (r) r.welcome_email_sent_at = '2026-06-01 12:00:00';
          },
        };
      }
      throw new Error(`unexpected SQL in test: ${sql}`);
    },
  };
}

test('runWelcomeEmailBackfill sends to every customer who never got a welcome email and marks them sent', async () => {
  const db = makeDb([
    { email: 'a@example.com', name: 'Alpha', welcome_email_sent_at: null },
    { email: 'b@example.com', name: 'Beta', welcome_email_sent_at: null },
    { email: 'c@example.com', name: 'Gamma', welcome_email_sent_at: '2026-05-30 10:00:00' },
  ]);
  const sends = [];
  const sendFn = async ({ email, name }) => {
    sends.push({ email, name });
    return { ok: true, id: `msg-${email}` };
  };

  const summary = await runWelcomeEmailBackfill({ db, sendFn });

  assert.equal(summary.candidates, 2, 'must skip the row already marked sent');
  assert.equal(summary.sent, 2);
  assert.equal(summary.failed, 0);
  assert.deepEqual(
    sends.map((s) => s.email).sort(),
    ['a@example.com', 'b@example.com'],
  );
  // Marks both as sent
  assert.equal(db.rows.find((r) => r.email === 'a@example.com').welcome_email_sent_at, '2026-06-01 12:00:00');
  assert.equal(db.rows.find((r) => r.email === 'b@example.com').welcome_email_sent_at, '2026-06-01 12:00:00');
});

test('runWelcomeEmailBackfill counts failures and does NOT mark them sent — safe to re-run', async () => {
  const db = makeDb([
    { email: 'good@example.com', name: 'OK', welcome_email_sent_at: null },
    { email: 'bad@example.com', name: 'X', welcome_email_sent_at: null },
  ]);
  const sendFn = async ({ email }) =>
    email === 'bad@example.com'
      ? { ok: false, error: 'bounced' }
      : { ok: true, id: 'good-id' };

  const summary = await runWelcomeEmailBackfill({ db, sendFn });

  assert.equal(summary.sent, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.errors.length, 1);
  assert.match(summary.errors[0].error, /bounced/);
  // Failed row stays unmarked so the next backfill run retries it.
  assert.equal(db.rows.find((r) => r.email === 'bad@example.com').welcome_email_sent_at, null);
  assert.notEqual(db.rows.find((r) => r.email === 'good@example.com').welcome_email_sent_at, null);
});

test('runWelcomeEmailBackfill returns a "skipped" entry without marking when the sender is not configured', async () => {
  // A configuration mistake (no RESEND_API_KEY on Railway) must NOT silently
  // mark customers as emailed. The backfill stays safe to re-run.
  const db = makeDb([
    { email: 'a@example.com', name: 'A', welcome_email_sent_at: null },
  ]);
  const sendFn = async () => ({ ok: false, skipped: true });

  const summary = await runWelcomeEmailBackfill({ db, sendFn });

  assert.equal(summary.sent, 0);
  assert.equal(summary.failed, 0);
  assert.equal(summary.skipped, 1);
  assert.equal(db.rows[0].welcome_email_sent_at, null);
});
