// Self-heal helpers for the in-memory sql.js database.
//
// sql.js keeps the whole database in WASM linear memory. On a long-running
// process that memory can grow (every save() exports a full copy of the DB)
// until SQLite starts reporting fatal, sticky errors like "disk I/O error"
// for EVERY subsequent query — reads included — even though the on-disk file
// is perfectly healthy. Once wedged, every DB-backed endpoint returns 500
// ("Failed to get sessions", "Failed to get profile", …) until the process
// is manually restarted.
//
// These helpers detect that class of error and let the DB layer throw away
// the wedged in-memory database and reload a fresh copy from the last good
// on-disk snapshot, then retry the operation once.

const FATAL_DB_ERROR =
  /disk i\/o error|out of memory|database disk image is malformed|file is not a database|unable to open database|database is locked/i;

export function isFatalDbError(err) {
  const message = err && err.message ? err.message : String(err || '');
  return FATAL_DB_ERROR.test(message);
}

// Run a database operation. If it fails with a fatal/wedging error, run the
// `reload` callback once and retry. A second failure (or any non-fatal error)
// is rethrown unchanged.
export function withRecovery(work, { reload, isFatal = isFatalDbError } = {}) {
  try {
    return work();
  } catch (err) {
    if (typeof reload !== 'function' || !isFatal(err)) throw err;
    reload();
    return work();
  }
}
