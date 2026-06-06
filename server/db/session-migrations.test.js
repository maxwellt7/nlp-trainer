import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import { applySessionMigrations } from './session-migrations.js';

test('applySessionMigrations safely adds new session columns on legacy SQLite schemas', () => {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    INSERT INTO sessions (id, user_id, created_at)
    VALUES ('session-1', 'user-1', '2026-04-15T05:00:00.000Z')
  `);

  assert.doesNotThrow(() => applySessionMigrations(db));

  const columnNames = new Set(
    db.prepare('PRAGMA table_info(sessions)').all().map((row) => row.name),
  );

  assert.ok(columnNames.has('session_type'));
  assert.ok(columnNames.has('session_status'));
  assert.ok(columnNames.has('title'));
  assert.ok(columnNames.has('last_message_at'));
  assert.ok(columnNames.has('hypnosis_generated_at'));
  assert.ok(columnNames.has('locked_at'));

  const row = db
    .prepare(`SELECT session_type, session_status, title, last_message_at FROM sessions WHERE id = 'session-1'`)
    .get();

  assert.equal(row.session_type, 'daily_hypnosis');
  assert.equal(row.session_status, 'active');
  assert.equal(row.title, '');
  assert.equal(row.last_message_at, '2026-04-15T05:00:00.000Z');

  // Idempotent: a second run on the now-migrated schema must not throw.
  assert.doesNotThrow(() => applySessionMigrations(db));

  db.close();
});
