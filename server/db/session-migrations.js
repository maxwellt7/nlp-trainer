// Idempotently bring a legacy `sessions` table up to the current schema.
//
// Driver-agnostic: `db` only needs a better-sqlite3 / node:sqlite-style API —
// `db.prepare(sql).all()` and `db.exec(sql)`. Safe to run on every startup; it
// only ALTERs columns that are missing.
export function applySessionMigrations(db) {
  const existingColumns = new Set(
    db.prepare('PRAGMA table_info(sessions)').all().map((row) => row.name),
  );

  const sessionMigrations = [
    ['session_type', `ALTER TABLE sessions ADD COLUMN session_type TEXT DEFAULT 'daily_hypnosis'`],
    ['session_status', `ALTER TABLE sessions ADD COLUMN session_status TEXT DEFAULT 'active'`],
    ['title', `ALTER TABLE sessions ADD COLUMN title TEXT DEFAULT ''`],
    ['last_message_at', `ALTER TABLE sessions ADD COLUMN last_message_at TEXT DEFAULT NULL`],
    ['hypnosis_generated_at', `ALTER TABLE sessions ADD COLUMN hypnosis_generated_at TEXT DEFAULT NULL`],
    ['locked_at', `ALTER TABLE sessions ADD COLUMN locked_at TEXT DEFAULT NULL`],
  ];

  for (const [columnName, statement] of sessionMigrations) {
    if (!existingColumns.has(columnName)) {
      db.exec(statement);
    }
  }

  db.exec(`
    UPDATE sessions
    SET session_type = COALESCE(NULLIF(session_type, ''), 'daily_hypnosis'),
        session_status = COALESCE(NULLIF(session_status, ''), 'active'),
        title = COALESCE(title, ''),
        last_message_at = COALESCE(NULLIF(last_message_at, ''), created_at)
  `);
}
