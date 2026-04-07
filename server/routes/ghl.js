import express from 'express';
import {
  handleQuizLead,
  handleSignup,
  handleSubscription,
  handleChurn,
  updateEngagement,
  isConfigured,
} from '../services/ghl.js';

const router = express.Router();

// ── POST /api/ghl/quiz-lead — Push quiz lead to GHL ──
router.post('/quiz-lead', async (req, res) => {
  try {
    const { email, name, score, tier, answers } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const contact = await handleQuizLead({ email, name, score, tier, answers });
    res.json({ success: true, contactId: contact?.id || null });
  } catch (err) {
    console.error('[GHL Route] quiz-lead error:', err.message);
    res.status(500).json({ error: 'Failed to process quiz lead' });
  }
});

// ── POST /api/ghl/signup — Push signup to GHL ──
router.post('/signup', async (req, res) => {
  try {
    const { email, clerkUserId, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const contact = await handleSignup({ email, clerkUserId, name });
    res.json({ success: true, contactId: contact?.id || null });
  } catch (err) {
    console.error('[GHL Route] signup error:', err.message);
    res.status(500).json({ error: 'Failed to process signup' });
  }
});

// ── POST /api/ghl/subscription — Push subscription to GHL ──
router.post('/subscription', async (req, res) => {
  try {
    const { email, plan, amount } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const contact = await handleSubscription({ email, plan, amount });
    res.json({ success: true, contactId: contact?.id || null });
  } catch (err) {
    console.error('[GHL Route] subscription error:', err.message);
    res.status(500).json({ error: 'Failed to process subscription' });
  }
});

// ── POST /api/ghl/churn — Push churn to GHL ──
router.post('/churn', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const contact = await handleChurn({ email });
    res.json({ success: true, contactId: contact?.id || null });
  } catch (err) {
    console.error('[GHL Route] churn error:', err.message);
    res.status(500).json({ error: 'Failed to process churn' });
  }
});

// ── POST /api/ghl/engagement — Update engagement metrics ──
router.post('/engagement', async (req, res) => {
  try {
    const { email, sessionsCompleted, lastActiveDate } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    await updateEngagement({ email, sessionsCompleted, lastActiveDate });
    res.json({ success: true });
  } catch (err) {
    console.error('[GHL Route] engagement error:', err.message);
    res.status(500).json({ error: 'Failed to update engagement' });
  }
});

// ── GET /api/ghl/status — Check GHL integration status ──
router.get('/status', (req, res) => {
  res.json({
    configured: isConfigured(),
    locationId: process.env.GHL_LOCATION_ID || '5aJWX4BRf7medN5RImNo',
  });
});

export default router;
