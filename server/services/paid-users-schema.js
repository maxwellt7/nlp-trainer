// Canonical migration for the paid_users table.
//
// The history: server/index.js imports provision.js BEFORE admin-kb.js, and
// provision.js's module-load `CREATE TABLE IF NOT EXISTS paid_users` uses
// column name `provisioned_at`. The newer post-purchase code path
// (admin-kb welcome-status, welcome-email-backfill, customer-diagnostic
// `similar` ORDER BY) references `created_at`. On a fresh Railway deploy,
// every call to those endpoints would 500 with "no such column:
// created_at".
//
// This helper runs once at server bootstrap. It is fully idempotent and
// only ADDs columns — it never drops or renames anything, so existing
// data is safe.
//
// SQLite quirk: ADD COLUMN with a non-constant DEFAULT (datetime('now'))
// is not allowed, so we backfill in a second pass.

export function applyPaidUsersMigrations(db) {
  if (!db || typeof db.exec !== 'function') return;

  // Make sure the table exists at all — defensive for test fixtures and for
  // the rare case where neither provision.js nor stripe-webhook.js has run
  // yet by the time someone hits an admin endpoint.
  try {
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
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now')),
        UNIQUE(email)
      );
    `);
  } catch { /* table already there with a different shape — keep going */ }

  // Each of these ALTERs is a no-op if the column already exists; the
  // catch swallows the "duplicate column name" error sqlite raises.
  const additions = [
    ['welcome_email_sent_at', 'DATETIME'],
    ['created_at', 'DATETIME'],
    ['updated_at', 'DATETIME'],
    ['clerk_user_id', 'TEXT'],
    ['stripe_session_id', 'TEXT'],
    ['stripe_customer_id', 'TEXT'],
    ['name', 'TEXT'],
    ['paid_status', "TEXT DEFAULT 'active'"],
  ];
  for (const [col, type] of additions) {
    try { db.exec(`ALTER TABLE paid_users ADD COLUMN ${col} ${type}`); } catch { /* exists */ }
  }

  // Backfill: rows inserted before created_at/updated_at existed have NULL
  // there. The welcome-email backfill ORDERs by created_at ASC, so a NULL
  // would slot unpredictably. If the legacy provisioned_at column exists,
  // copy from it; otherwise stamp 'now'. Idempotent: only touches NULL rows.
  try {
    const cols = db.prepare(`PRAGMA table_info(paid_users)`).all();
    const hasProvisionedAt = cols.some((c) => c.name === 'provisioned_at');
    const hasCreatedAt = cols.some((c) => c.name === 'created_at');
    const hasUpdatedAt = cols.some((c) => c.name === 'updated_at');
    if (hasCreatedAt) {
      if (hasProvisionedAt) {
        db.exec(`UPDATE paid_users SET created_at = provisioned_at WHERE created_at IS NULL AND provisioned_at IS NOT NULL`);
      }
      db.exec(`UPDATE paid_users SET created_at = datetime('now') WHERE created_at IS NULL`);
    }
    if (hasUpdatedAt) {
      db.exec(`UPDATE paid_users SET updated_at = datetime('now') WHERE updated_at IS NULL`);
    }
  } catch { /* PRAGMA failed or backfill not possible — leave rows alone */ }

  // ADD COLUMN can't use datetime('now') as a default, so newly-inserted
  // rows on a legacy schema would land with created_at = NULL. A trigger
  // stamps them at insert time. Idempotent via IF NOT EXISTS.
  try {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS paid_users_set_created_at
      AFTER INSERT ON paid_users
      FOR EACH ROW
      WHEN NEW.created_at IS NULL
      BEGIN
        UPDATE paid_users SET created_at = datetime('now') WHERE rowid = NEW.rowid;
      END;
    `);
  } catch { /* trigger creation failed — backfill still keeps existing rows clean */ }
}
