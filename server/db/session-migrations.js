export function applySessionMigrations(rawDb) {
  const sessionColumnsResult = rawDb.exec(`PRAGMA table_info(sessions);`);
  const sessionColumns = new Set((sessionColumnsResult[0]?.values || []).map((row) => row[1]));

  const sessionMigrations = [
    ['session_type', `ALTER TABLE sessions ADD COLUMN session_type TEXT DEFAULT 'daily_hypnosis'`],
    ['session_status', `ALTER TABLE sessions ADD COLUMN session_status TEXT DEFAULT 'active'`],
    ['title', `ALTER TABLE sessions ADD COLUMN title TEXT DEFAULT ''`],
    ['last_message_at', `ALTER TABLE sessions ADD COLUMN last_message_at TEXT DEFAULT NULL`],
    ['hypnosis_generated_at', `ALTER TABLE sessions ADD COLUMN hypnosis_generated_at TEXT DEFAULT NULL`],
    ['locked_at', `ALTER TABLE sessions ADD COLUMN locked_at TEXT DEFAULT NULL`],
  ];

  for (const [columnName, statement] of sessionMigrations) {
    if (!sessionColumns.has(columnName)) {
      rawDb.run(statement);
    }
  }

  rawDb.run(`
    UPDATE sessions
    SET session_type = COALESCE(NULLIF(session_type, ''), 'daily_hypnosis'),
        session_status = COALESCE(NULLIF(session_status, ''), 'active'),
        title = COALESCE(title, ''),
        last_message_at = COALESCE(NULLIF(last_message_at, ''), created_at)
  `);
}
