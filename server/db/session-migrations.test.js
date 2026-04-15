import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';

import { applySessionMigrations } from './session-migrations.js';

test('applySessionMigrations safely adds new session columns on legacy SQLite schemas', async () => {
  const SQL = await initSqlJs();
  const rawDb = new SQL.Database();

  rawDb.run(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  rawDb.run(`
    INSERT INTO sessions (id, user_id, created_at)
    VALUES ('session-1', 'user-1', '2026-04-15T05:00:00.000Z')
  `);

  assert.doesNotThrow(() => applySessionMigrations(rawDb));

  const columnsResult = rawDb.exec(`PRAGMA table_info(sessions);`);
  const columnNames = new Set((columnsResult[0]?.values || []).map((row) => row[1]));

  assert.ok(columnNames.has('session_type'));
  assert.ok(columnNames.has('session_status'));
  assert.ok(columnNames.has('title'));
  assert.ok(columnNames.has('last_message_at'));
  assert.ok(columnNames.has('hypnosis_generated_at'));
  assert.ok(columnNames.has('locked_at'));

  const rows = rawDb.exec(`SELECT session_type, session_status, title, last_message_at FROM sessions WHERE id = 'session-1'`);
  const [sessionType, sessionStatus, title, lastMessageAt] = rows[0].values[0];

  assert.equal(sessionType, 'daily_hypnosis');
  assert.equal(sessionStatus, 'active');
  assert.equal(title, '');
  assert.equal(lastMessageAt, '2026-04-15T05:00:00.000Z');
});
