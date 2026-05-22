/**
 * Tests for server/db/index.js — focusing on db.transaction() behaviour.
 *
 * We test against the real exported db object (which initialises an in-memory
 * sql.js database at import time) so we exercise the actual code paths.
 *
 * Run with:
 *   LEAD_TOKEN_HMAC_SECRET=test-lead-secret-32-chars-min-len \
 *   UNSUBSCRIBE_HMAC_SECRET=test-unsub-secret-32-chars-min-len \
 *   node --test server/db/index.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// Set required env vars before importing anything that reads them.
process.env.LEAD_TOKEN_HMAC_SECRET =
  process.env.LEAD_TOKEN_HMAC_SECRET || 'test-lead-secret-32-chars-min-len';
process.env.UNSUBSCRIBE_HMAC_SECRET =
  process.env.UNSUBSCRIBE_HMAC_SECRET || 'test-unsub-secret-32-chars-min-len';

import db from './index.js';

// ── nested-transaction guard ──────────────────────────────────────────────────

test('db.transaction() throws on nested call with message containing "Nested"', () => {
  let innerError = null;

  // The outer transaction should complete normally; the inner call throws.
  db.transaction((_txDb) => {
    try {
      db.transaction((_inner) => {
        // should never reach here
      });
    } catch (err) {
      innerError = err;
    }
  });

  assert.ok(innerError, 'Expected an error to be thrown for nested transaction');
  assert.match(innerError.message, /[Nn]ested/,
    `Error message should contain "Nested" or "nested", got: "${innerError.message}"`);
});

test('_inTransaction flag is cleared after a successful transaction', () => {
  db.transaction((_txDb) => { /* no-op */ });
  assert.equal(db._inTransaction, false,
    '_inTransaction should be false after a successful transaction');
});

test('_inTransaction flag is cleared after a transaction that throws', () => {
  try {
    db.transaction((_txDb) => {
      throw new Error('deliberate inner failure');
    });
  } catch (_) {
    // expected
  }
  assert.equal(db._inTransaction, false,
    '_inTransaction should be false after a failed transaction (finally block)');
});

test('db.transaction() is callable again after a nested-transaction error', () => {
  // Trigger the guard...
  db.transaction((_txDb) => {
    try { db.transaction(() => {}); } catch (_) { /* swallow */ }
  });

  // ...then verify a fresh transaction succeeds (flag was not left stuck).
  assert.doesNotThrow(() => {
    db.transaction((_txDb) => { /* no-op */ });
  }, 'db.transaction() should be callable again after the nested guard fired');
});
