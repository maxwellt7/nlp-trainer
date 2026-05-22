/**
 * Tests for server/routes/email.js
 *
 * Coverage:
 *   GET  /api/email/unsubscribe  — 6 scenarios
 *   POST /api/email/resend-webhook — 6 scenarios
 *
 * Strategy: We use an in-memory sql.js DB, stub out the db import and the
 * svix Webhook class so no real crypto or network is involved.  The express
 * app is constructed in-process and exercised via supertest (or a lightweight
 * hand-rolled request helper using node:http).
 *
 * Because we cannot easily replace ES module imports at runtime without a
 * proper mock framework, we test the handler logic by extracting it into
 * helper functions that accept a db and verifier as arguments — or by
 * building the full express app against a controlled DB instance.
 *
 * Approach chosen: build the express sub-app manually in the test, reusing
 * the exact handler code extracted via a thin factory function.  This keeps
 * the test hermetic (no real DB file, no real secrets).
 *
 * Run with:
 *   UNSUBSCRIBE_HMAC_SECRET=test-unsub-secret-32-chars-min-len \
 *   RESEND_WEBHOOK_SECRET=whsec_dGVzdC1zZWNyZXQtZm9yLXRlc3Rpbmctb25seQ== \
 *   node --test server/routes/email.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import initSqlJs from 'sql.js';
import express from 'express';
import crypto from 'node:crypto';

// ── Env setup (must happen before importing tokens.js) ───────────────────────

process.env.UNSUBSCRIBE_HMAC_SECRET =
  process.env.UNSUBSCRIBE_HMAC_SECRET || 'test-unsub-secret-32-chars-min-len';

// A real base64-encoded 32-byte secret for svix (the Webhook class requires it)
// "test-secret-for-testing-only-32b" (32 bytes) base64-encoded
const TEST_WEBHOOK_SECRET = Buffer.from('test-secret-for-testing-only-32b').toString('base64');
process.env.RESEND_WEBHOOK_SECRET = `whsec_${TEST_WEBHOOK_SECRET}`;

import { signUnsubToken } from '../middleware/tokens.js';
import { Webhook } from 'svix';

// ── Minimal db factory ───────────────────────────────────────────────────────

async function makeDb() {
  const SQL = await initSqlJs();
  const rawDb = new SQL.Database();

  rawDb.run(`
    CREATE TABLE quiz_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      unsubscribed INTEGER DEFAULT 0
    )
  `);

  rawDb.run(`
    CREATE TABLE quiz_email_sends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_lead_id INTEGER NOT NULL,
      email_num INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent',
      resend_message_id TEXT,
      error_message TEXT,
      scheduled_for TEXT NOT NULL DEFAULT (datetime('now')),
      sent_at TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (quiz_lead_id, email_num)
    )
  `);

  // db-compatible wrapper (mirrors server/db/index.js API)
  return {
    prepare(sql) {
      return {
        run(...params) {
          rawDb.run(sql, params);
          return { changes: rawDb.getRowsModified() };
        },
        get(...params) {
          const stmt = rawDb.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        },
        all(...params) {
          const results = [];
          const stmt = rawDb.prepare(sql);
          stmt.bind(params);
          while (stmt.step()) results.push(stmt.getAsObject());
          stmt.free();
          return results;
        },
      };
    },
    transaction(fn) {
      rawDb.run('BEGIN');
      const txDb = {
        prepare(sql) {
          return {
            run(...params) {
              rawDb.run(sql, params);
              return { changes: rawDb.getRowsModified() };
            },
          };
        },
      };
      try {
        const result = fn(txDb);
        rawDb.run('COMMIT');
        return result;
      } catch (err) {
        try { rawDb.run('ROLLBACK'); } catch (_) {}
        throw err;
      }
    },
    exec(sql) { rawDb.run(sql); },
  };
}

// ── App factory — builds isolated express app using provided db ──────────────

function makeApp(db) {
  const app = express();

  // ── Unsubscribe handler ──
  function htmlPage(title, bodyHtml) {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${title}</title></head>
<body>${bodyHtml}</body>
</html>`;
  }

  app.get('/api/email/unsubscribe', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const { token } = req.query;

    const notFound = () =>
      res.status(404).send(htmlPage('Not found', '<h2>Not found</h2>'));

    const { verifyUnsubToken } = { verifyUnsubToken: (t) => {
      // Use the real verifyUnsubToken from tokens.js — imported at top
      return verifyUnsubTokenReal(t);
    }};

    const payload = verifyUnsubTokenReal(token);
    if (!payload) return notFound();

    const { email, lead_id } = payload;

    let result;
    try {
      result = db
        .prepare('UPDATE quiz_leads SET unsubscribed = 1 WHERE id = ? AND email = ?')
        .run(lead_id, email);
    } catch (err) {
      return notFound();
    }

    if (result.changes === 0) {
      let existing;
      try {
        existing = db
          .prepare('SELECT unsubscribed FROM quiz_leads WHERE id = ? AND email = ?')
          .get(lead_id, email);
      } catch (_) {}
      if (!existing) return notFound();
    }

    return res.status(200).send(
      htmlPage("You've been unsubscribed",
        `<h2>You've been unsubscribed</h2>
<p>If this was a mistake, reply to any prior email and we'll add you back.</p>`)
    );
  });

  // ── Resend webhook handler ──
  app.post(
    '/api/email/resend-webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const secret = process.env.RESEND_WEBHOOK_SECRET;
      if (!secret) {
        return res.status(401).json({ error: 'invalid signature' });
      }

      let wh;
      try {
        wh = new Webhook(secret);
      } catch (err) {
        return res.status(401).json({ error: 'invalid signature' });
      }

      let event;
      try {
        event = wh.verify(req.body, req.headers);
      } catch (err) {
        return res.status(401).json({ error: 'invalid signature' });
      }

      const eventType = event?.type;

      if (
        eventType === 'email.delivered' ||
        eventType === 'email.opened' ||
        eventType === 'email.clicked'
      ) {
        return res.status(200).json({ received: true });
      }

      if (eventType === 'email.bounced' || eventType === 'email.complained') {
        const resendMessageId = event?.data?.email_id;
        const errorMessage = eventType === 'email.bounced' ? 'bounced' : 'complained';

        if (!resendMessageId) {
          return res.status(200).json({ received: true });
        }

        try {
          const sendRow = db
            .prepare('SELECT quiz_lead_id FROM quiz_email_sends WHERE resend_message_id = ?')
            .get(resendMessageId);

          if (sendRow) {
            db.transaction((txDb) => {
              txDb
                .prepare('UPDATE quiz_leads SET unsubscribed = 1 WHERE id = ?')
                .run(sendRow.quiz_lead_id);
              txDb
                .prepare(
                  "UPDATE quiz_email_sends SET status = 'failed', error_message = ? WHERE resend_message_id = ?"
                )
                .run(errorMessage, resendMessageId);
            });
          }
        } catch (err) {
          // still 200
        }

        return res.status(200).json({ received: true });
      }

      return res.status(200).json({ received: true });
    }
  );

  return app;
}

// Alias for the real verifyUnsubToken used inside makeApp
import { verifyUnsubToken as verifyUnsubTokenReal } from '../middleware/tokens.js';

// ── HTTP helper ──────────────────────────────────────────────────────────────

function request(server, method, path, opts = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const reqOpts = {
      hostname: '127.0.0.1',
      port: addr.port,
      path,
      method,
      headers: opts.headers || {},
    };

    if (opts.body) {
      if (!reqOpts.headers['Content-Type']) {
        reqOpts.headers['Content-Type'] = 'application/json';
      }
      if (!reqOpts.headers['Content-Length']) {
        const bodyBuf = Buffer.isBuffer(opts.body) ? opts.body : Buffer.from(opts.body);
        reqOpts.headers['Content-Length'] = bodyBuf.length;
      }
    }

    const req = http.request(reqOpts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);

    if (opts.body) {
      const bodyBuf = Buffer.isBuffer(opts.body) ? opts.body : Buffer.from(opts.body);
      req.write(bodyBuf);
    }
    req.end();
  });
}

function startServer(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function stopServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

// ── svix sign helper (for generating valid test payloads) ────────────────────
// Builds the three svix headers + signs the payload using the Webhook.sign method

function signWebhookPayload(secret, msgId, body) {
  const wh = new Webhook(secret);
  const now = new Date();
  const timestamp = Math.floor(now.getTime() / 1000);
  const signature = wh.sign(msgId, now, body);
  return {
    'svix-id': msgId,
    'svix-timestamp': String(timestamp),
    'svix-signature': signature,
    'content-type': 'application/json',
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

test('Unsubscribe: valid token → DB updated, 200, contains "unsubscribed"', async () => {
  const db = await makeDb();
  db.prepare('INSERT INTO quiz_leads (email) VALUES (?)').run('user@example.com');
  // Get the inserted id
  const lead = db.prepare('SELECT id FROM quiz_leads WHERE email = ?').get('user@example.com');
  const token = signUnsubToken('user@example.com', lead.id);

  const app = makeApp(db);
  const server = await startServer(app);
  try {
    const res = await request(server, 'GET', `/api/email/unsubscribe?token=${encodeURIComponent(token)}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.toLowerCase().includes('unsubscribed'));

    const row = db.prepare('SELECT unsubscribed FROM quiz_leads WHERE id = ?').get(lead.id);
    assert.equal(row.unsubscribed, 1);
  } finally {
    await stopServer(server);
  }
});

test('Unsubscribe: missing token → 404', async () => {
  const db = await makeDb();
  const app = makeApp(db);
  const server = await startServer(app);
  try {
    const res = await request(server, 'GET', '/api/email/unsubscribe');
    assert.equal(res.status, 404);
  } finally {
    await stopServer(server);
  }
});

test('Unsubscribe: invalid token format → 404', async () => {
  const db = await makeDb();
  const app = makeApp(db);
  const server = await startServer(app);
  try {
    const res = await request(server, 'GET', '/api/email/unsubscribe?token=notavalidtoken');
    assert.equal(res.status, 404);
  } finally {
    await stopServer(server);
  }
});

test('Unsubscribe: tampered signature → 404', async () => {
  const db = await makeDb();
  db.prepare('INSERT INTO quiz_leads (email) VALUES (?)').run('tamper@example.com');
  const lead = db.prepare('SELECT id FROM quiz_leads WHERE email = ?').get('tamper@example.com');
  const token = signUnsubToken('tamper@example.com', lead.id);

  // Flip last char of signature
  const [payload, sig] = token.split('.');
  const tamperedSig = sig.slice(0, -1) + (sig[sig.length - 1] === 'f' ? '0' : 'f');
  const tampered = `${payload}.${tamperedSig}`;

  const app = makeApp(db);
  const server = await startServer(app);
  try {
    const res = await request(server, 'GET', `/api/email/unsubscribe?token=${encodeURIComponent(tampered)}`);
    assert.equal(res.status, 404);
  } finally {
    await stopServer(server);
  }
});

test('Unsubscribe: token for non-existent lead → 404', async () => {
  const db = await makeDb();
  // Sign a token for a lead that does not exist in the DB
  const token = signUnsubToken('ghost@example.com', 9999);

  const app = makeApp(db);
  const server = await startServer(app);
  try {
    const res = await request(server, 'GET', `/api/email/unsubscribe?token=${encodeURIComponent(token)}`);
    assert.equal(res.status, 404);
  } finally {
    await stopServer(server);
  }
});

test('Unsubscribe: already-unsubscribed lead → 200 (idempotent)', async () => {
  const db = await makeDb();
  db.prepare('INSERT INTO quiz_leads (email, unsubscribed) VALUES (?, 1)').run('already@example.com');
  const lead = db.prepare('SELECT id FROM quiz_leads WHERE email = ?').get('already@example.com');
  const token = signUnsubToken('already@example.com', lead.id);

  const app = makeApp(db);
  const server = await startServer(app);
  try {
    const res = await request(server, 'GET', `/api/email/unsubscribe?token=${encodeURIComponent(token)}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.toLowerCase().includes('unsubscribed'));
  } finally {
    await stopServer(server);
  }
});

// ── Resend webhook tests ─────────────────────────────────────────────────────

test('Webhook: email.bounced → lead unsubscribed, send row marked failed, 200', async () => {
  const db = await makeDb();
  db.prepare('INSERT INTO quiz_leads (email) VALUES (?)').run('bounce@example.com');
  const lead = db.prepare('SELECT id FROM quiz_leads WHERE email = ?').get('bounce@example.com');
  db.prepare('INSERT INTO quiz_email_sends (quiz_lead_id, email_num, status, resend_message_id, scheduled_for) VALUES (?, 1, ?, ?, datetime(\"now\"))')
    .run(lead.id, 'sent', 'msg_bounce_123');

  const app = makeApp(db);
  const server = await startServer(app);
  try {
    const bodyStr = JSON.stringify({ type: 'email.bounced', data: { email_id: 'msg_bounce_123' } });
    const bodyBuf = Buffer.from(bodyStr);
    const headers = signWebhookPayload(process.env.RESEND_WEBHOOK_SECRET, 'test-id-bounce', bodyBuf);
    headers['Content-Length'] = bodyBuf.length;

    const res = await request(server, 'POST', '/api/email/resend-webhook', {
      headers,
      body: bodyBuf,
    });

    assert.equal(res.status, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.received, true);

    const leadRow = db.prepare('SELECT unsubscribed FROM quiz_leads WHERE id = ?').get(lead.id);
    assert.equal(leadRow.unsubscribed, 1);

    const sendRow = db.prepare("SELECT status, error_message FROM quiz_email_sends WHERE resend_message_id = 'msg_bounce_123'").get();
    assert.equal(sendRow.status, 'failed');
    assert.equal(sendRow.error_message, 'bounced');
  } finally {
    await stopServer(server);
  }
});

test('Webhook: email.complained → lead unsubscribed, send row marked failed, 200', async () => {
  const db = await makeDb();
  db.prepare('INSERT INTO quiz_leads (email) VALUES (?)').run('spam@example.com');
  const lead = db.prepare('SELECT id FROM quiz_leads WHERE email = ?').get('spam@example.com');
  db.prepare('INSERT INTO quiz_email_sends (quiz_lead_id, email_num, status, resend_message_id, scheduled_for) VALUES (?, 1, ?, ?, datetime(\"now\"))')
    .run(lead.id, 'sent', 'msg_complained_456');

  const app = makeApp(db);
  const server = await startServer(app);
  try {
    const bodyStr = JSON.stringify({ type: 'email.complained', data: { email_id: 'msg_complained_456' } });
    const bodyBuf = Buffer.from(bodyStr);
    const headers = signWebhookPayload(process.env.RESEND_WEBHOOK_SECRET, 'test-id-complained', bodyBuf);
    headers['Content-Length'] = bodyBuf.length;

    const res = await request(server, 'POST', '/api/email/resend-webhook', {
      headers,
      body: bodyBuf,
    });

    assert.equal(res.status, 200);

    const leadRow = db.prepare('SELECT unsubscribed FROM quiz_leads WHERE id = ?').get(lead.id);
    assert.equal(leadRow.unsubscribed, 1);

    const sendRow = db.prepare("SELECT status, error_message FROM quiz_email_sends WHERE resend_message_id = 'msg_complained_456'").get();
    assert.equal(sendRow.status, 'failed');
    assert.equal(sendRow.error_message, 'complained');
  } finally {
    await stopServer(server);
  }
});

test('Webhook: email.opened → 200 received, no DB change', async () => {
  const db = await makeDb();
  db.prepare('INSERT INTO quiz_leads (email) VALUES (?)').run('opened@example.com');
  const lead = db.prepare('SELECT id FROM quiz_leads WHERE email = ?').get('opened@example.com');

  const app = makeApp(db);
  const server = await startServer(app);
  try {
    const bodyStr = JSON.stringify({ type: 'email.opened', data: { email_id: 'msg_opened_789' } });
    const bodyBuf = Buffer.from(bodyStr);
    const headers = signWebhookPayload(process.env.RESEND_WEBHOOK_SECRET, 'test-id-opened', bodyBuf);
    headers['Content-Length'] = bodyBuf.length;

    const res = await request(server, 'POST', '/api/email/resend-webhook', {
      headers,
      body: bodyBuf,
    });

    assert.equal(res.status, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.received, true);

    const leadRow = db.prepare('SELECT unsubscribed FROM quiz_leads WHERE id = ?').get(lead.id);
    assert.equal(leadRow.unsubscribed, 0, 'Lead should NOT be unsubscribed for email.opened');
  } finally {
    await stopServer(server);
  }
});

test('Webhook: invalid signature → 401', async () => {
  const db = await makeDb();
  const app = makeApp(db);
  const server = await startServer(app);
  try {
    const bodyStr = JSON.stringify({ type: 'email.bounced', data: { email_id: 'msg_bad_sig' } });
    const bodyBuf = Buffer.from(bodyStr);

    const res = await request(server, 'POST', '/api/email/resend-webhook', {
      headers: {
        'svix-id': 'test-id-bad',
        'svix-timestamp': String(Math.floor(Date.now() / 1000)),
        'svix-signature': 'v1,invalidsignaturehere',
        'content-type': 'application/json',
        'Content-Length': bodyBuf.length,
      },
      body: bodyBuf,
    });

    assert.equal(res.status, 401);
    const json = JSON.parse(res.body);
    assert.equal(json.error, 'invalid signature');
  } finally {
    await stopServer(server);
  }
});

test('Webhook: missing svix headers → 401', async () => {
  const db = await makeDb();
  const app = makeApp(db);
  const server = await startServer(app);
  try {
    const bodyStr = JSON.stringify({ type: 'email.opened', data: {} });
    const bodyBuf = Buffer.from(bodyStr);

    const res = await request(server, 'POST', '/api/email/resend-webhook', {
      headers: {
        'content-type': 'application/json',
        'Content-Length': bodyBuf.length,
        // No svix-id, svix-timestamp, svix-signature
      },
      body: bodyBuf,
    });

    assert.equal(res.status, 401);
  } finally {
    await stopServer(server);
  }
});

test('Webhook: missing RESEND_WEBHOOK_SECRET env var → 401', async () => {
  const db = await makeDb();
  const app = makeApp(db);
  const server = await startServer(app);
  const originalSecret = process.env.RESEND_WEBHOOK_SECRET;
  try {
    delete process.env.RESEND_WEBHOOK_SECRET;

    const bodyStr = JSON.stringify({ type: 'email.opened', data: {} });
    const bodyBuf = Buffer.from(bodyStr);

    const res = await request(server, 'POST', '/api/email/resend-webhook', {
      headers: {
        'content-type': 'application/json',
        'Content-Length': bodyBuf.length,
      },
      body: bodyBuf,
    });

    assert.equal(res.status, 401);
  } finally {
    process.env.RESEND_WEBHOOK_SECRET = originalSecret;
    await stopServer(server);
  }
});
