// Admin-only operational endpoints.
//
// - POST /api/admin/sync-kb        — force an immediate Dropbox→Pinecone sync.
// - GET  /api/admin/welcome-status — count paid customers still missing the welcome email.
// - POST /api/admin/backfill-welcome-emails — send the welcome email to every missed customer.

import { Router } from 'express';
import db from '../db/index.js';
import { requireAdmin } from '../middleware/auth.js';
import { runSyncOnce } from '../services/dropbox-sync.js';
import { sendWelcomeEmail } from '../services/welcome-email.js';
import { runWelcomeEmailBackfill } from '../services/welcome-email-backfill.js';

// Defensive migration so the admin endpoints below don't 500 on a
// freshly-deployed instance where no Stripe webhook has fired yet (the
// webhook handler is the other place this ALTER is run).
try { db.exec(`ALTER TABLE paid_users ADD COLUMN welcome_email_sent_at DATETIME`); } catch { /* already there or table missing */ }

// Exposed as a factory so the test can inject a fake `runSync` and verify
// the response shaping without touching Dropbox / Pinecone for real.
export function syncKbHandler({ runSync }) {
  return async function handler(_req, res) {
    try {
      const summary = await runSync();
      if (summary && summary.skipped) {
        return res.status(503).json({
          ok: false,
          skipped: summary.skipped,
        });
      }
      return res.status(200).json({ ok: true, summary });
    } catch (err) {
      console.error('[admin/sync-kb] failed:', err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  };
}

const router = Router();

// POST /api/admin/sync-kb — force an immediate Dropbox → Pinecone sync.
router.post('/sync-kb', requireAdmin, syncKbHandler({ runSync: runSyncOnce }));

// GET /api/admin/welcome-status — how many paying customers never got the
// welcome email (the "De'Yona gap"). Read-only so admins can quantify the
// impact before pulling the trigger on a backfill.
router.get('/welcome-status', requireAdmin, (_req, res) => {
  try {
    const total = db.prepare(`SELECT COUNT(*) AS n FROM paid_users`).get();
    const missing = db
      .prepare(`SELECT COUNT(*) AS n FROM paid_users WHERE welcome_email_sent_at IS NULL`)
      .get();
    const recent = db
      .prepare(`SELECT email, name, created_at FROM paid_users WHERE welcome_email_sent_at IS NULL ORDER BY created_at DESC LIMIT 20`)
      .all();
    res.json({
      ok: true,
      total_paid: total?.n || 0,
      missing_welcome_email: missing?.n || 0,
      recent_missing: recent,
    });
  } catch (err) {
    console.error('[admin/welcome-status] failed:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/admin/backfill-welcome-emails — send the welcome email to every
// paid customer who never got one. Safe to re-run.
router.post('/backfill-welcome-emails', requireAdmin, async (_req, res) => {
  try {
    const summary = await runWelcomeEmailBackfill({
      db,
      sendFn: ({ email, name }) => sendWelcomeEmail({ email, name }),
    });
    console.log('[admin/backfill-welcome-emails] summary:', JSON.stringify(summary));
    return res.status(200).json({ ok: true, summary });
  } catch (err) {
    console.error('[admin/backfill-welcome-emails] failed:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
