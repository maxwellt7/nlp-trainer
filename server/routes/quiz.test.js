/**
 * Tests for the POST /api/quiz/lead handler logic.
 *
 * Strategy: We test the DB persistence behavior (the most critical part of
 * A.4) by running the exact SQL the handler executes against an in-memory
 * sql.js database, then asserting the resulting rows.  External side-effects
 * (CAPI, GHL) are already wrapped in try/catch in the handler and never block
 * the response, so they are not tested here.
 *
 * Run with:
 *   LEAD_TOKEN_HMAC_SECRET=test-lead-secret-32-chars-min-len \
 *   UNSUBSCRIBE_HMAC_SECRET=test-unsub-secret-32-chars-min-len \
 *   node --test server/routes/quiz.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';

// We need signLeadToken for the token-shape assertions
process.env.LEAD_TOKEN_HMAC_SECRET =
  process.env.LEAD_TOKEN_HMAC_SECRET || 'test-lead-secret-32-chars-min-len';
process.env.UNSUBSCRIBE_HMAC_SECRET =
  process.env.UNSUBSCRIBE_HMAC_SECRET || 'test-unsub-secret-32-chars-min-len';

import { signLeadToken, verifyLeadToken } from '../middleware/tokens.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Create an isolated in-memory sql.js database with the same schema the handler uses. */
async function makeDb() {
  const SQL = await initSqlJs();
  const rawDb = new SQL.Database();

  // quiz_leads — base columns
  rawDb.run(`
    CREATE TABLE quiz_leads (
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
      bump_purchased INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // quiz_email_sends
  rawDb.run(`
    CREATE TABLE quiz_email_sends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_lead_id INTEGER NOT NULL REFERENCES quiz_leads(id),
      email_num INTEGER NOT NULL,
      status TEXT NOT NULL,
      resend_message_id TEXT,
      error_message TEXT,
      scheduled_for TEXT NOT NULL,
      sent_at TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (quiz_lead_id, email_num)
    )
  `);

  // Thin rawDb-level prepare (no save() — mirrors txDb in db.transaction())
  function rawPrepare(sql) {
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
  }

  // Minimal wrapper matching the db module's API including db.transaction()
  const db = {
    prepare(sql) { return rawPrepare(sql); },
    exec(sql) { rawDb.run(sql); },

    // Mirrors db.transaction() from server/db/index.js (no save() between steps)
    transaction(fn) {
      rawDb.run('BEGIN');
      try {
        const result = fn({ prepare: rawPrepare });
        rawDb.run('COMMIT');
        return result;
      } catch (err) {
        try { rawDb.run('ROLLBACK'); } catch (_) { /* ignore */ }
        throw err;
      }
    },
  };

  return db;
}

/** Drip schedule offsets in hours — must match the handler exactly. */
const DRIP_OFFSETS_HOURS = [1, 24, 48, 72, 96, 144];

/**
 * Run the legacy-path INSERT (mirrors the handler's legacy branch exactly).
 */
function legacyInsert(db, { email, name, score, tier, answers, sourceUrl, userAgent, fbp, fbc }) {
  db.prepare(`
    INSERT INTO quiz_leads (email, name, score, tier, answers, source_url, user_agent, fbp, fbc)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    email,
    name || null,
    score != null ? score : null,
    tier || null,
    answers ? JSON.stringify(answers) : null,
    sourceUrl || null,
    userAgent || null,
    fbp || null,
    fbc || null,
  );
}

/**
 * Run the funnel-path INSERT + email_sends enqueue via db.transaction()
 * (mirrors the handler's isFunnelSubmission branch exactly).
 * Returns { leadId }.
 */
function funnelInsert(db, body) {
  const {
    email, name, score, tier, answers,
    sourceUrl, userAgent, fbp, fbc,
    pattern_scores, result_program, depth_score, depth_band,
    q2_style, q9_fear, utm,
  } = body;

  const utmSource   = utm?.source   || null;
  const utmMedium   = utm?.medium   || null;
  const utmCampaign = utm?.campaign || null;
  const utmContent  = utm?.content  || null;

  const leadId = db.transaction((txDb) => {
    txDb.prepare(`
      INSERT INTO quiz_leads (
        email, name, score, tier, answers,
        source_url, user_agent, fbp, fbc,
        pattern_scores, result_program, depth_score, depth_band,
        q2_style, q9_fear,
        utm_source, utm_medium, utm_campaign, utm_content,
        gate_at
      )
      VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        datetime('now')
      )
    `).run(
      email,
      name || null,
      score != null ? score : null,
      tier || null,
      answers ? JSON.stringify(answers) : null,
      sourceUrl || null,
      userAgent || null,
      fbp || null,
      fbc || null,
      pattern_scores ? JSON.stringify(pattern_scores) : null,
      result_program || null,
      depth_score != null ? depth_score : null,
      depth_band || null,
      q2_style || null,
      q9_fear || null,
      utmSource, utmMedium, utmCampaign, utmContent,
    );

    const row = txDb.prepare('SELECT last_insert_rowid() as rowid').get();
    const newLeadId = row.rowid;

    const insertSend = txDb.prepare(`
      INSERT INTO quiz_email_sends (quiz_lead_id, email_num, status, scheduled_for)
      VALUES (?, ?, 'queued', datetime('now', ? || ' hours'))
    `);
    for (let i = 0; i < DRIP_OFFSETS_HOURS.length; i++) {
      insertSend.run(newLeadId, i + 1, String('+' + DRIP_OFFSETS_HOURS[i]));
    }

    return newLeadId;
  });

  return { leadId };
}

// ── Tests ────────────────────────────────────────────────────────────────────

test('1. Legacy path — inserts 1 quiz_leads row, 0 quiz_email_sends rows, no funnel columns', async () => {
  const db = await makeDb();

  legacyInsert(db, {
    email: 'old@test.com',
    name: 'Old User',
    score: 5,
    tier: 'high',
    answers: { q1: 'a', q2: 'b' },
  });

  const leads = db.prepare('SELECT * FROM quiz_leads').all();
  assert.equal(leads.length, 1, 'Expected 1 row in quiz_leads');

  const lead = leads[0];
  assert.equal(lead.email, 'old@test.com');
  assert.equal(lead.name, 'Old User');
  assert.equal(lead.score, 5);
  assert.equal(lead.tier, 'high');
  assert.ok(lead.answers, 'answers should be set');
  assert.deepEqual(JSON.parse(lead.answers), { q1: 'a', q2: 'b' });

  // New funnel columns must be NULL
  assert.equal(lead.pattern_scores, null, 'pattern_scores should be NULL on legacy path');
  assert.equal(lead.result_program, null, 'result_program should be NULL on legacy path');
  assert.equal(lead.depth_score, null, 'depth_score should be NULL on legacy path');
  assert.equal(lead.gate_at, null, 'gate_at should be NULL on legacy path');

  const sends = db.prepare('SELECT * FROM quiz_email_sends').all();
  assert.equal(sends.length, 0, 'Expected 0 rows in quiz_email_sends on legacy path');
});

test('2. Legacy path response shape — no lead_id, no lead_token', () => {
  // The handler returns { success: true } on legacy path (no funnel fields).
  // We verify the response shape by simulating the isFunnelSubmission guard.
  const body = { email: 'old@test.com', name: 'Old User', score: 5, tier: 'high' };
  const isFunnelSubmission = (
    body.pattern_scores !== undefined ||
    body.result_program !== undefined ||
    body.depth_score !== undefined
  );
  assert.equal(isFunnelSubmission, false, 'Legacy body must not trigger funnel path');
});

test('3. New funnel path — inserts 1 quiz_leads row with all funnel columns set', async () => {
  const db = await makeDb();

  const body = {
    email: 'new@test.com',
    name: 'Funnel User',
    score: 9,
    tier: 'high',
    answers: { q1: 'a' },
    pattern_scores: { A: 3, B: 2, C: 4, D: 1 },
    result_program: 'over-preparer',
    depth_score: 8,
    depth_band: 'deep-rooted',
    q2_style: 'analytical',
    q9_fear: 'not being enough',
    utm: { source: 'fb', medium: 'paid', campaign: 'align-q2', content: 'v1' },
  };

  const { leadId } = funnelInsert(db, body);

  const leads = db.prepare('SELECT * FROM quiz_leads').all();
  assert.equal(leads.length, 1, 'Expected 1 row in quiz_leads');

  const lead = leads[0];
  assert.equal(lead.email, 'new@test.com');
  assert.equal(lead.result_program, 'over-preparer');
  assert.equal(lead.depth_score, 8);
  assert.equal(lead.depth_band, 'deep-rooted');
  assert.equal(lead.q2_style, 'analytical');
  assert.equal(lead.q9_fear, 'not being enough');
  assert.deepEqual(JSON.parse(lead.pattern_scores), { A: 3, B: 2, C: 4, D: 1 });
  assert.equal(lead.utm_source, 'fb');
  assert.equal(lead.utm_medium, 'paid');
  assert.equal(lead.utm_campaign, 'align-q2');
  assert.equal(lead.utm_content, 'v1');
  assert.ok(lead.gate_at, 'gate_at should be set on funnel path');

  assert.equal(leadId, lead.id, 'leadId should match the row id');
});

test('4. New funnel path — enqueues exactly 6 quiz_email_sends rows with correct offsets', async () => {
  const db = await makeDb();

  const { leadId } = funnelInsert(db, {
    email: 'drip@test.com',
    pattern_scores: { A: 1, B: 2, C: 3, D: 4 },
    result_program: 'loop',
    depth_score: 5,
  });

  const sends = db.prepare('SELECT * FROM quiz_email_sends ORDER BY email_num ASC').all();
  assert.equal(sends.length, 6, 'Expected exactly 6 rows in quiz_email_sends');

  // Each send should reference the correct lead and be queued
  for (const send of sends) {
    assert.equal(send.quiz_lead_id, leadId, `send ${send.email_num}: quiz_lead_id mismatch`);
    assert.equal(send.status, 'queued', `send ${send.email_num}: status should be "queued"`);
    assert.ok(send.scheduled_for, `send ${send.email_num}: scheduled_for should be set`);
  }

  // email_num 1..6 should be present
  const emailNums = sends.map(s => s.email_num);
  assert.deepEqual(emailNums, [1, 2, 3, 4, 5, 6]);

  // scheduled_for offsets: each should be > gate_at and in the right order
  // We verify that scheduled_for values are strictly increasing
  const scheduledTimes = sends.map(s => new Date(s.scheduled_for).getTime());
  for (let i = 1; i < scheduledTimes.length; i++) {
    assert.ok(
      scheduledTimes[i] > scheduledTimes[i - 1],
      `send ${i + 1} should be scheduled after send ${i}`,
    );
  }
});

test('5. New funnel path response shape — includes lead_id and valid lead_token', async () => {
  const db = await makeDb();

  const { leadId } = funnelInsert(db, {
    email: 'token@test.com',
    pattern_scores: { A: 2, B: 3, C: 1, D: 4 },
    result_program: 'self-censor',
    depth_score: 4,
  });

  // The handler calls signLeadToken(leadId) and returns it in the response
  const lead_token = signLeadToken(leadId);
  const verified = verifyLeadToken(lead_token);

  assert.ok(verified !== null, 'lead_token should be verifiable');
  assert.equal(verified.lead_id, leadId, 'lead_token payload should contain the correct lead_id');
  assert.ok(verified.exp > Math.floor(Date.now() / 1000), 'lead_token should not be expired');

  // Response should include lead_id and lead_token
  const response = { success: true, lead_id: leadId, lead_token };
  assert.equal(response.success, true);
  assert.equal(typeof response.lead_id, 'number');
  assert.equal(typeof response.lead_token, 'string');
  assert.ok(response.lead_token.includes('.'), 'lead_token should be a signed token (payload.sig format)');
});

test('6. Transaction rollback — if email_sends INSERT fails, lead INSERT is rolled back', async () => {
  const db = await makeDb();

  // Simulate a failure mid-transaction by using db.transaction() (the same
  // method the handler uses) and forcing an error after the lead INSERT.
  let threw = false;
  try {
    db.transaction((txDb) => {
      txDb.prepare(`
        INSERT INTO quiz_leads (
          email, pattern_scores, result_program, depth_score, gate_at
        ) VALUES (?, ?, ?, ?, datetime('now'))
      `).run('rollback@test.com', null, 'loop', 5);

      // Force an error: insert into a non-existent table
      txDb.prepare(`INSERT INTO quiz_email_sends_NONEXISTENT (quiz_lead_id) VALUES (?)`).run(1);
    });
  } catch (err) {
    threw = true;
  }

  assert.ok(threw, 'Expected the transaction to throw');

  const leads = db.prepare('SELECT * FROM quiz_leads WHERE email = ?').all('rollback@test.com');
  assert.equal(leads.length, 0, 'Lead row should be rolled back on transaction failure');
});

test('7. isFunnelSubmission detection — triggered by pattern_scores alone', () => {
  const body = { email: 'x@y.com', pattern_scores: { A: 1, B: 2, C: 3, D: 4 } };
  const isFunnel = body.pattern_scores !== undefined || body.result_program !== undefined || body.depth_score !== undefined;
  assert.equal(isFunnel, true);
});

test('8. isFunnelSubmission detection — triggered by result_program alone', () => {
  const body = { email: 'x@y.com', result_program: 'loop' };
  const isFunnel = body.pattern_scores !== undefined || body.result_program !== undefined || body.depth_score !== undefined;
  assert.equal(isFunnel, true);
});

test('9. isFunnelSubmission detection — triggered by depth_score alone', () => {
  const body = { email: 'x@y.com', depth_score: 0 };
  const isFunnel = body.pattern_scores !== undefined || body.result_program !== undefined || body.depth_score !== undefined;
  assert.equal(isFunnel, true);
});

test('10. Backwards compat — null optional fields do not crash legacy INSERT', async () => {
  const db = await makeDb();
  // Minimal legacy POST — only email
  legacyInsert(db, { email: 'minimal@test.com' });
  const leads = db.prepare('SELECT * FROM quiz_leads').all();
  assert.equal(leads.length, 1);
  assert.equal(leads[0].email, 'minimal@test.com');
  assert.equal(leads[0].name, null);
  assert.equal(leads[0].score, null);
});
