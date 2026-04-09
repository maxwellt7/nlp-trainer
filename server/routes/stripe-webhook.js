/**
 * Stripe Webhook Route
 * 
 * Receives Stripe webhook events directly from Stripe Dashboard.
 * On checkout.session.completed:
 *   1. Provisions paid access in the database
 *   2. Fires Meta CAPI Purchase event
 *   3. Updates GHL pipeline (moves opportunity to Subscribed, marks won)
 * 
 * Endpoint: POST /api/stripe-webhook
 * 
 * IMPORTANT: This route must receive the RAW body for signature verification.
 * It is mounted BEFORE express.json() in index.js.
 */

import express from 'express';
import crypto from 'crypto';
import db from '../db/index.js';
import { ensureUser } from '../services/profile.js';
import { handleSubscription, upsertContact, addTags } from '../services/ghl.js';

const router = express.Router();

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const META_PIXEL_ID = '1917548505548972';
const META_CAPI_TOKEN = process.env.META_CAPI_TOKEN || '';

/**
 * Verify Stripe webhook signature
 */
function verifyStripeSignature(payload, sigHeader, secret) {
  if (!secret) {
    console.error('[Stripe Webhook] No STRIPE_WEBHOOK_SECRET configured');
    return false;
  }

  const parts = sigHeader.split(',');
  let timestamp = null;
  let signatures = [];

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't') timestamp = value;
    if (key === 'v1') signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) {
    console.error('[Stripe Webhook] Invalid signature header format');
    return false;
  }

  // Check timestamp tolerance (5 minutes)
  const tolerance = 300;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > tolerance) {
    console.error('[Stripe Webhook] Timestamp outside tolerance');
    return false;
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  // Compare with constant-time comparison
  return signatures.some(sig => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSig, 'hex'),
        Buffer.from(sig, 'hex')
      );
    } catch {
      return false;
    }
  });
}

/**
 * Fire Meta Conversions API Purchase event (server-side)
 */
async function sendCapiPurchaseEvent(email, amount, eventSourceUrl) {
  if (!META_CAPI_TOKEN) {
    console.warn('[Stripe Webhook] No META_CAPI_TOKEN — skipping CAPI event');
    return;
  }

  const hashedEmail = crypto
    .createHash('sha256')
    .update(email.toLowerCase().trim())
    .digest('hex');

  const eventData = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_source_url: eventSourceUrl || 'https://start.sovereignty.app/success',
    action_source: 'website',
    user_data: {
      em: [hashedEmail],
    },
    custom_data: {
      currency: 'USD',
      value: amount,
      content_name: 'Alignment Engine Full Access',
      content_ids: ['alignment-engine-full-access'],
      content_type: 'product',
    },
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events?access_token=${META_CAPI_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [eventData] }),
      }
    );

    const result = await response.json();
    console.log(`[Stripe Webhook] CAPI Purchase event sent for ${email}:`, result);
  } catch (err) {
    console.error(`[Stripe Webhook] CAPI event failed:`, err.message);
  }
}

/**
 * Provision paid access in the database
 */
function provisionAccess(email, name, stripeSessionId, stripeCustomerId) {
  const normalizedEmail = email.toLowerCase().trim();

  // Ensure paid_users table exists
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
      updated_at DATETIME DEFAULT (datetime('now'))
    )
  `);

  const existing = db.prepare('SELECT * FROM paid_users WHERE email = ?').get(normalizedEmail);

  if (existing) {
    db.prepare(`
      UPDATE paid_users 
      SET paid_status = 'active', 
          stripe_session_id = COALESCE(?, stripe_session_id),
          stripe_customer_id = COALESCE(?, stripe_customer_id),
          name = COALESCE(?, name),
          updated_at = datetime('now')
      WHERE email = ?
    `).run(stripeSessionId, stripeCustomerId, name, normalizedEmail);

    console.log(`[Stripe Webhook] Updated existing paid user: ${email}`);
  } else {
    db.prepare(`
      INSERT INTO paid_users (email, name, stripe_session_id, stripe_customer_id, paid_status)
      VALUES (?, ?, ?, ?, 'active')
    `).run(normalizedEmail, name, stripeSessionId, stripeCustomerId);

    console.log(`[Stripe Webhook] Created new paid user: ${email}`);
  }

  // Also ensure they have a profile
  try {
    ensureUser(normalizedEmail);
  } catch (err) {
    console.warn(`[Stripe Webhook] Profile creation non-blocking error:`, err.message);
  }
}

/**
 * POST /api/stripe-webhook
 * 
 * Receives raw body (not JSON-parsed) for signature verification.
 * Must be mounted with express.raw() middleware.
 */
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    console.error('[Stripe Webhook] Missing stripe-signature header');
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  const rawBody = req.body.toString('utf8');

  // Verify signature
  if (!verifyStripeSignature(rawBody, sig, STRIPE_WEBHOOK_SECRET)) {
    console.error('[Stripe Webhook] Signature verification failed');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    console.error('[Stripe Webhook] Invalid JSON:', err.message);
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);

  // Handle checkout.session.completed
  if (event.type === 'checkout.session.completed') {
    const session = event.data?.object;
    if (!session) {
      console.error('[Stripe Webhook] No session object in event');
      return res.status(400).json({ error: 'No session object' });
    }

    const email = session.customer_details?.email || session.customer_email;
    const name = session.customer_details?.name || null;
    const stripeSessionId = session.id;
    const stripeCustomerId = typeof session.customer === 'string' ? session.customer : null;
    const amountTotal = session.amount_total ? session.amount_total / 100 : 7;

    if (!email) {
      console.error('[Stripe Webhook] No email in checkout session:', stripeSessionId);
      return res.status(200).json({ received: true, warning: 'No email found' });
    }

    console.log(`[Stripe Webhook] Processing checkout for: ${email} ($${amountTotal})`);

    // 1. Provision paid access in database
    try {
      provisionAccess(email, name, stripeSessionId, stripeCustomerId);
    } catch (err) {
      console.error(`[Stripe Webhook] Provision failed:`, err.message);
    }

    // 2. Fire Meta CAPI Purchase event (server-side)
    try {
      await sendCapiPurchaseEvent(email, amountTotal);
    } catch (err) {
      console.error(`[Stripe Webhook] CAPI failed:`, err.message);
    }

    // 3. Update GHL pipeline — move to Subscribed stage, mark as won
    try {
      await handleSubscription({
        email: email.toLowerCase().trim(),
        plan: 'Alignment Engine Full Access ($7)',
        amount: amountTotal,
      });
      console.log(`[Stripe Webhook] GHL updated for: ${email}`);
    } catch (err) {
      console.error(`[Stripe Webhook] GHL failed:`, err.message);
    }

    console.log(`[Stripe Webhook] ✅ All post-purchase actions completed for: ${email}`);
  }

  // Always return 200 to acknowledge receipt
  res.status(200).json({ received: true });
});

export default router;
// Stripe webhook v1 - 20260409200504
