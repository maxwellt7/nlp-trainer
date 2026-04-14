/**
 * Email routes
 *
 * GET  /api/email/unsubscribe        — one-click unsubscribe (CAN-SPAM)
 * POST /api/email/register-trial     — register a new free trial signup for drip sequence
 * GET  /api/email/sends              — admin: list recent sends
 */

import express from 'express';
import db from '../db/index.js';
import {
  verifyUnsubToken,
  unsubscribeEmail,
  registerTrialSignup,
} from '../services/emailScheduler.js';

const router = express.Router();

// ── GET /api/email/unsubscribe ─────────────────────────────────────────────────
// Linked from every email footer. Validates HMAC token before unsubscribing.

router.get('/unsubscribe', (req, res) => {
  const { email, token } = req.query;

  if (!email || !token) {
    return res.status(400).send(unsubPage('Missing email or token.', false));
  }

  if (!verifyUnsubToken(email, token)) {
    return res.status(403).send(unsubPage('Invalid or expired unsubscribe link.', false));
  }

  try {
    unsubscribeEmail(email);
    console.log(`[Email] Unsubscribed: ${email}`);
    return res.send(unsubPage(`You've been unsubscribed from all Sacred Heart emails.`, true));
  } catch (err) {
    console.error('[Email] Unsubscribe error:', err.message);
    return res.status(500).send(unsubPage('Something went wrong. Please try again.', false));
  }
});

// ── POST /api/email/register-trial ────────────────────────────────────────────
// Called by the frontend (or Clerk webhook) when a user creates a free account.
// Body: { email, name?, clerkUserId? }

router.post('/register-trial', (req, res) => {
  const { email, name, clerkUserId } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  try {
    registerTrialSignup({ email, name, clerkUserId });
    return res.json({ success: true });
  } catch (err) {
    console.error('[Email] register-trial error:', err.message);
    return res.status(500).json({ error: 'Failed to register trial signup' });
  }
});

// ── GET /api/email/sends ───────────────────────────────────────────────────────
// Admin view of recent sends. Simple auth via PROVISION_SECRET.

router.get('/sends', (req, res) => {
  const secret = process.env.PROVISION_SECRET;
  if (secret) {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ') || auth.slice(7) !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const offset = parseInt(req.query.offset) || 0;

    const sends = db.prepare(`
      SELECT user_email, sequence_type, template_id, sent_at, opened_at, clicked_at
      FROM email_sends
      ORDER BY sent_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const total = db.prepare('SELECT COUNT(*) as count FROM email_sends').get();

    const prefs = db.prepare(`
      SELECT COUNT(*) as count FROM email_preferences WHERE unsubscribed = 1
    `).get();

    return res.json({
      sends,
      total: total?.count || 0,
      unsubscribed: prefs?.count || 0,
    });
  } catch (err) {
    console.error('[Email] sends list error:', err.message);
    return res.status(500).json({ error: 'Failed to load sends' });
  }
});

// ── Unsubscribe confirmation HTML page ────────────────────────────────────────

function unsubPage(message, success) {
  const color = success ? '#6B3FA0' : '#cc4444';
  const icon = success ? '✓' : '✗';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Sacred Heart — Unsubscribe</title>
  <style>
    body { margin: 0; background: #f0ede8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 10px; padding: 48px 44px; max-width: 420px; width: 90%; text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
    .icon { width: 56px; height: 56px; border-radius: 50%; background: ${color}; color: #fff; font-size: 24px; line-height: 56px; margin: 0 auto 20px; }
    h1 { margin: 0 0 12px; font-size: 20px; color: #1a1a1a; }
    p { margin: 0 0 24px; color: #666; font-size: 14px; line-height: 1.6; }
    a { color: ${color}; text-decoration: none; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>Sacred Heart</h1>
    <p>${message}</p>
    <a href="https://heart.sovereignty.app">← Back to Sacred Heart</a>
  </div>
</body>
</html>`;
}

export default router;
