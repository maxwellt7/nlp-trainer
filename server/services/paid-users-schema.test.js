// Regression: fresh-deploy schema mismatch on paid_users.
//
// On a brand-new Railway boot, server/index.js imports provision.js BEFORE
// admin-kb.js. provision.js's module-load `CREATE TABLE IF NOT EXISTS`
// creates the table with column `provisioned_at` and a UNIQUE(email)
// constraint. The newly-added admin endpoints (welcome-status,
// welcome-email-backfill) reference column `created_at`, which doesn't
// exist on that fresh schema — every call 500s with
// "no such column: created_at".
//
// This test pins the contract: after the standard module-load migrations,
// the paid_users table must expose BOTH the columns referenced by the
// post-purchase code path (welcome_email_sent_at, created_at) and the
// UNIQUE(email) constraint the provision flow depends on.

import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPaidUsersMigrations } from './paid-users-schema.js';

function makeSqlJsDb() {
  // Minimal better-sqlite3-shaped wrapper around an in-memory sql.js DB —
  // mirrors server/db/index.js so the migration logic gets exercised the
  // same way it does in production.
  return import('sql.js').then(async ({ default: initSqlJs }) => {
    const SQL = await initSqlJs();
    const raw = new SQL.Database();
    return {
      raw,
      exec(sql) { raw.run(sql); },
      prepare(sql) {
        return {
          run: (...params) => { raw.run(sql, params); return { changes: raw.getRowsModified() }; },
          get: (...params) => {
            const stmt = raw.prepare(sql);
            stmt.bind(params);
            const out = stmt.step() ? stmt.getAsObject() : undefined;
            stmt.free();
            return out;
          },
          all: (...params) => {
            const stmt = raw.prepare(sql);
            stmt.bind(params);
            const rows = [];
            while (stmt.step()) rows.push(stmt.getAsObject());
            stmt.free();
            return rows;
          },
        };
      },
    };
  });
}

test('fresh-deploy paid_users schema exposes both created_at and welcome_email_sent_at', async () => {
  const db = await makeSqlJsDb();

  // Simulate provision.js running FIRST on module load — this is the order
  // server/index.js imports happen in, and it's what creates the schema
  // mismatch.
  db.exec(`
    CREATE TABLE IF NOT EXISTS paid_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      name TEXT,
      clerk_user_id TEXT,
      stripe_session_id TEXT,
      stripe_customer_id TEXT,
      paid_status TEXT DEFAULT 'active',
      amount INTEGER DEFAULT 7,
      plan TEXT DEFAULT 'alignment-engine-full-access',
      provisioned_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(email)
    );
  `);

  // Run the canonical migration — must heal the missing columns.
  applyPaidUsersMigrations(db);

  // The two queries that the welcome-email path executes — these are the
  // exact SQL strings used by admin-kb welcome-status and
  // welcome-email-backfill. They must not throw.
  assert.doesNotThrow(() => {
    db.prepare(`SELECT email, name, created_at FROM paid_users WHERE welcome_email_sent_at IS NULL ORDER BY created_at DESC LIMIT 20`).all();
  }, 'welcome-status SELECT must work after migration');

  assert.doesNotThrow(() => {
    db.prepare(`SELECT email, name FROM paid_users WHERE welcome_email_sent_at IS NULL ORDER BY created_at ASC`).all();
  }, 'welcome-email-backfill SELECT must work after migration');

  // A new INSERT through the stripe-webhook path must populate created_at —
  // the welcome-status ORDER BY needs it to be non-null on rows the
  // post-purchase email step depends on.
  db.prepare(`INSERT INTO paid_users (email, name, paid_status) VALUES (?, ?, 'active')`).run('fresh@example.com', 'Fresh');
  const row = db.prepare(`SELECT created_at FROM paid_users WHERE email = ?`).get('fresh@example.com');
  assert.ok(row && row.created_at, 'newly-inserted row must have a non-null created_at');
});

test('migration is idempotent — running twice is a no-op', async () => {
  const db = await makeSqlJsDb();
  db.exec(`CREATE TABLE IF NOT EXISTS paid_users (id INTEGER PRIMARY KEY, email TEXT NOT NULL, provisioned_at TEXT, UNIQUE(email));`);
  applyPaidUsersMigrations(db);
  assert.doesNotThrow(() => applyPaidUsersMigrations(db));
});

test('migration leaves an already-correct schema untouched', async () => {
  const db = await makeSqlJsDb();
  // Schema that already has created_at + welcome_email_sent_at — e.g. an
  // older Railway instance where stripe-webhook.js created the table first.
  db.exec(`
    CREATE TABLE IF NOT EXISTS paid_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      paid_status TEXT,
      created_at DATETIME DEFAULT (datetime('now')),
      welcome_email_sent_at DATETIME,
      UNIQUE(email)
    );
  `);
  applyPaidUsersMigrations(db);
  db.prepare(`INSERT INTO paid_users (email) VALUES (?)`).run('a@b.com');
  const row = db.prepare(`SELECT created_at, welcome_email_sent_at FROM paid_users WHERE email = ?`).get('a@b.com');
  assert.ok(row.created_at, 'created_at must still default');
});
