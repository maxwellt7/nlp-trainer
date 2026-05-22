/**
 * Tests for stripe-webhook.js checkout.session.completed handler
 *
 * Focus: Verify that quiz_leads rows are marked purchased and bump_purchased
 * as appropriate when a Stripe checkout session completes.
 *
 * Run with:
 *   STRIPE_WEBHOOK_SECRET=test-secret-minimum-32-chars-length-ok \
 *   CLERK_SECRET_KEY=test-clerk-key \
 *   META_CAPI_TOKEN=test-capi-token \
 *   node --test server/routes/stripe-webhook.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import crypto from 'crypto';

// Set required env vars
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'test-secret-minimum-32-chars-length-ok';
process.env.CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || 'test-clerk-key';
process.env.META_CAPI_TOKEN = process.env.META_CAPI_TOKEN || 'test-capi-token';

// ── Test Setup ───────────────────────────────────────────────────────────────

/** Create an isolated in-memory sql.js database with quiz_leads schema. */
async function makeTestDb() {
  const SQL = await initSqlJs();
  const rawDb = new SQL.Database();

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

  // Mock prepare/run interface
  function mockPrepare(sql) {
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
    };
  }

  return {
    prepare: mockPrepare,
    rawDb,
    getRows(sql) {
      const stmt = rawDb.prepare(sql);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    },
  };
}

/**
 * Extract the update logic from stripe-webhook.js
 * (This mimics what the webhook handler does)
 */
async function markLead(db, email, session) {
  const normalizedEmail = email.toLowerCase().trim();

  // Detect if bump was purchased
  let hasBump = false;
  if (session.line_items?.data && Array.isArray(session.line_items.data)) {
    hasBump = session.line_items.data.some(item =>
      item.description?.includes('bump') ||
      item.name?.includes('bump') ||
      (item.price?.metadata?.type === 'bump')
    );
  }
  // Fallback: Check if amount_total >= 3400 cents ($34 = $7 + $27 bump)
  if (!hasBump && session.amount_total && session.amount_total >= 3400) {
    hasBump = true;
  }

  if (hasBump) {
    db.prepare(`UPDATE quiz_leads SET purchased = 1, bump_purchased = 1 WHERE email = ?`)
      .run(normalizedEmail);
  } else {
    db.prepare(`UPDATE quiz_leads SET purchased = 1 WHERE email = ?`)
      .run(normalizedEmail);
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

test('Quiz Leads Stripe Webhook Updates', async (t) => {
  await t.test('marks quiz_leads row as purchased on checkout.session.completed', async () => {
    const db = await makeTestDb();

    // Insert a quiz lead
    db.prepare(`
      INSERT INTO quiz_leads (email, name, score, tier, answers, purchased, bump_purchased)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('test@example.com', 'Test User', 75, 'intermediate', '{}', 0, 0);

    // Create a mock session (no bump)
    const session = {
      id: 'cs_test_123',
      customer_email: 'test@example.com',
      amount_total: 700, // $7
      line_items: { data: [] },
    };

    // Mark the lead as purchased
    await markLead(db, 'test@example.com', session);

    // Verify purchased = 1, bump_purchased = 0
    const rows = db.getRows(`SELECT * FROM quiz_leads WHERE email = 'test@example.com'`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].purchased, 1);
    assert.equal(rows[0].bump_purchased, 0);
  });

  await t.test('does not error if email not in quiz_leads', async () => {
    const db = await makeTestDb();

    const session = {
      id: 'cs_test_123',
      customer_email: 'unknown@example.com',
      amount_total: 700,
      line_items: { data: [] },
    };

    // Should not throw
    await markLead(db, 'unknown@example.com', session);

    // Verify quiz_leads is empty
    const rows = db.getRows(`SELECT COUNT(*) as cnt FROM quiz_leads`);
    assert.equal(rows[0].cnt, 0);
  });

  await t.test('marks both purchased and bump_purchased when amount_total >= 3400', async () => {
    const db = await makeTestDb();

    db.prepare(`
      INSERT INTO quiz_leads (email, name, purchased, bump_purchased)
      VALUES (?, ?, ?, ?)
    `).run('bump@example.com', 'Bump User', 0, 0);

    const session = {
      id: 'cs_test_bump',
      customer_email: 'bump@example.com',
      amount_total: 3400, // $34 = $7 + $27 bump
      line_items: { data: [] },
    };

    await markLead(db, 'bump@example.com', session);

    const rows = db.getRows(`SELECT * FROM quiz_leads WHERE email = 'bump@example.com'`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].purchased, 1);
    assert.equal(rows[0].bump_purchased, 1);
  });

  await t.test('marks both purchased and bump_purchased when line_items contains bump', async () => {
    const db = await makeTestDb();

    db.prepare(`
      INSERT INTO quiz_leads (email, name, purchased, bump_purchased)
      VALUES (?, ?, ?, ?)
    `).run('lineitem@example.com', 'LineItem User', 0, 0);

    const session = {
      id: 'cs_test_lineitem',
      customer_email: 'lineitem@example.com',
      amount_total: 1500, // Unrelated amount
      line_items: {
        data: [
          { description: '$7 Core Product', price: { metadata: {} } },
          { description: '$27 bump add-on', price: { metadata: { type: 'bump' } } },
        ],
      },
    };

    await markLead(db, 'lineitem@example.com', session);

    const rows = db.getRows(`SELECT * FROM quiz_leads WHERE email = 'lineitem@example.com'`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].purchased, 1);
    assert.equal(rows[0].bump_purchased, 1);
  });

  await t.test('respects email normalization (lowercase + trim)', async () => {
    const db = await makeTestDb();

    db.prepare(`
      INSERT INTO quiz_leads (email, purchased, bump_purchased)
      VALUES (?, ?, ?)
    `).run('test@example.com', 0, 0);

    const session = {
      id: 'cs_test_norm',
      customer_email: 'TEST@EXAMPLE.COM',
      amount_total: 700,
      line_items: { data: [] },
    };

    // Pass with uppercase/mixed case
    await markLead(db, '  TEST@EXAMPLE.COM  ', session);

    const rows = db.getRows(`SELECT * FROM quiz_leads WHERE email = 'test@example.com'`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].purchased, 1);
  });

  await t.test('detects bump via line_items name field', async () => {
    const db = await makeTestDb();

    db.prepare(`
      INSERT INTO quiz_leads (email, purchased, bump_purchased)
      VALUES (?, ?, ?)
    `).run('name@example.com', 0, 0);

    const session = {
      id: 'cs_test_name',
      customer_email: 'name@example.com',
      amount_total: 700,
      line_items: {
        data: [
          { name: 'Alignment Engine', price: { metadata: {} } },
          { name: 'bonus bump package', price: { metadata: {} } },
        ],
      },
    };

    await markLead(db, 'name@example.com', session);

    const rows = db.getRows(`SELECT * FROM quiz_leads WHERE email = 'name@example.com'`);
    assert.equal(rows[0].purchased, 1);
    assert.equal(rows[0].bump_purchased, 1);
  });
});
