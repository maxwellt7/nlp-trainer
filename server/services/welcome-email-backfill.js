// One-shot backfill for the post-purchase welcome email gap.
//
// Until the welcome-email step was wired into the Stripe webhook, every
// paying customer was provisioned but never told where to log in. This
// service finds every customer in `paid_users` who never received the
// email and sends it now. Safe to re-run: it never marks a row as sent
// unless the send actually succeeded.

export async function runWelcomeEmailBackfill({ db, sendFn, onProgress } = {}) {
  if (!db) throw new Error('runWelcomeEmailBackfill: db is required');
  if (typeof sendFn !== 'function') {
    throw new Error('runWelcomeEmailBackfill: sendFn is required');
  }

  const candidates = db
    .prepare(`SELECT email, name FROM paid_users WHERE welcome_email_sent_at IS NULL ORDER BY created_at ASC`)
    .all();

  const summary = {
    candidates: candidates.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  const updateStmt = db.prepare(
    `UPDATE paid_users SET welcome_email_sent_at = datetime('now') WHERE email = ?`,
  );

  for (const row of candidates) {
    const email = (row.email || '').toLowerCase().trim();
    if (!email) {
      summary.failed += 1;
      summary.errors.push({ email: row.email, error: 'empty email' });
      continue;
    }

    let result;
    try {
      result = await sendFn({ email, name: row.name || null });
    } catch (err) {
      result = { ok: false, error: err.message };
    }

    if (result?.ok) {
      summary.sent += 1;
      try {
        updateStmt.run(email);
      } catch (dbErr) {
        // Mark-sent failed but the email DID go out. Surface this loudly so
        // the operator knows the row may re-send on the next backfill.
        summary.errors.push({ email, error: `email sent but mark failed: ${dbErr.message}` });
      }
    } else if (result?.skipped) {
      summary.skipped += 1;
    } else {
      summary.failed += 1;
      summary.errors.push({ email, error: result?.error || 'unknown error' });
    }

    if (typeof onProgress === 'function') {
      try { onProgress({ email, result }); } catch { /* progress is best-effort */ }
    }
  }

  return summary;
}
