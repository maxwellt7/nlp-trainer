import express from 'express';
import crypto from 'crypto';
import { requireAdmin } from '../middleware/auth.js';
import { signLeadToken } from '../middleware/tokens.js';

const router = express.Router();

// Meta CAPI config
const PIXEL_ID = '2035820893688270';
const CAPI_TOKEN = process.env.META_CAPI_TOKEN || '';
const CAPI_URL = `https://graph.facebook.com/v19.0/${PIXEL_ID}/events`;

// ── In-memory lead storage (persists in SQLite below) ──

import db from '../db/index.js';
import { handleQuizLead } from '../services/ghl.js';

// Ensure quiz_leads table exists
try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS quiz_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      name TEXT,
      score INTEGER,
      tier TEXT,
      answers TEXT,
      source_url TEXT,
      user_agent TEXT,
      fbp TEXT,
      fbc TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      user_id TEXT,
      email TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  // ── Additive migrations for quiz_leads (idempotent via try/catch) ──
  function tryAddColumn(table, columnDef) {
    try {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`).run();
    } catch (err) {
      // SQLite throws "duplicate column name" when column already exists; ignore it
      if (!String(err.message || '').includes('duplicate column')) throw err;
    }
  }

  tryAddColumn('quiz_leads', 'pattern_scores TEXT DEFAULT NULL');
  tryAddColumn('quiz_leads', 'result_program TEXT DEFAULT NULL');
  tryAddColumn('quiz_leads', 'depth_score INTEGER DEFAULT NULL');
  tryAddColumn('quiz_leads', 'depth_band TEXT DEFAULT NULL');
  tryAddColumn('quiz_leads', 'q2_style TEXT DEFAULT NULL');
  tryAddColumn('quiz_leads', 'q9_fear TEXT DEFAULT NULL');
  tryAddColumn('quiz_leads', 'utm_source TEXT DEFAULT NULL');
  tryAddColumn('quiz_leads', 'utm_medium TEXT DEFAULT NULL');
  tryAddColumn('quiz_leads', 'utm_campaign TEXT DEFAULT NULL');
  tryAddColumn('quiz_leads', 'utm_content TEXT DEFAULT NULL');
  tryAddColumn('quiz_leads', 'gate_at TEXT DEFAULT NULL');
  tryAddColumn('quiz_leads', 'unsubscribed INTEGER DEFAULT 0');
  tryAddColumn('quiz_leads', 'purchased INTEGER DEFAULT 0');
  tryAddColumn('quiz_leads', 'bump_purchased INTEGER DEFAULT 0');

  // ── New table: quiz_email_sends ──
  db.prepare(`
    CREATE TABLE IF NOT EXISTS quiz_email_sends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_lead_id INTEGER NOT NULL REFERENCES quiz_leads(id),
      email_num INTEGER NOT NULL,
      status TEXT NOT NULL,
      resend_message_id TEXT,
      error_message TEXT,
      scheduled_for TEXT NOT NULL,
      sent_at TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (quiz_lead_id, email_num)
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_qes_due
      ON quiz_email_sends (status, scheduled_for)
  `).run();
} catch (err) {
  console.error('Failed to create quiz_leads table:', err.message);
}

// ── POST /api/quiz/lead — Store quiz lead + fire CAPI Lead event ──
//
// Supports two caller paths:
//   Legacy path  — POST { email, name, score, tier, answers, sourceUrl, userAgent, fbp, fbc }
//                  → returns { success: true }
//   New funnel   — POST with any of pattern_scores | result_program | depth_score also present
//                  → persists funnel fields + enqueues 6 drip emails in quiz_email_sends
//                  → returns { success: true, lead_id, lead_token }
//
// NOTE on idempotence: duplicate POSTs (e.g. double-tap) will create duplicate rows.
// Deduplication via ON CONFLICT(email) is deferred to a future task.
//
// Drip email schedule offsets from gate_at (hours): 1, 24, 48, 72, 96, 144
const DRIP_OFFSETS_HOURS = [1, 24, 48, 72, 96, 144];

router.post('/lead', async (req, res) => {
  try {
    const {
      // Legacy fields
      email, name, score, tier, answers,
      sourceUrl, userAgent, fbp, fbc,
      // New funnel fields (all optional)
      pattern_scores,
      result_program,
      depth_score,
      depth_band,
      q2_style,
      q9_fear,
      utm,
    } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Determine whether this is a new-funnel submission.
    // Presence of any of these three fields signals the align funnel.
    const isFunnelSubmission = (
      pattern_scores !== undefined ||
      result_program !== undefined ||
      depth_score !== undefined
    );

    // Flatten utm object → individual columns
    const utmSource   = utm?.source   || null;
    const utmMedium   = utm?.medium   || null;
    const utmCampaign = utm?.campaign || null;
    const utmContent  = utm?.content  || null;

    let leadId;

    if (isFunnelSubmission) {
      // ── New funnel path: all inserts in one transaction ──
      // db.transaction() uses rawDb directly (no intermediate save()) to avoid
      // sql.js's export()-triggered auto-commit that would break BEGIN/COMMIT.
      try {
        leadId = db.transaction((txDb) => {
          txDb.prepare(`
            INSERT INTO quiz_leads (
              email, name, score, tier, answers,
              source_url, user_agent, fbp, fbc,
              pattern_scores, result_program, depth_score, depth_band,
              q2_style, q9_fear,
              utm_source, utm_medium, utm_campaign, utm_content,
              gate_at
            )
            VALUES (
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?,
              ?, ?, ?, ?,
              datetime('now')
            )
          `).run(
            email,
            name || null,
            score != null ? score : null,
            tier || null,
            answers ? JSON.stringify(answers) : null,
            sourceUrl || null,
            userAgent || null,
            fbp || null,
            fbc || null,
            pattern_scores ? JSON.stringify(pattern_scores) : null,
            result_program || null,
            depth_score != null ? depth_score : null,
            depth_band || null,
            q2_style || null,
            q9_fear || null,
            utmSource,
            utmMedium,
            utmCampaign,
            utmContent,
          );

          // Get the auto-incremented lead id
          const row = txDb.prepare('SELECT last_insert_rowid() as rowid').get();
          const newLeadId = row.rowid;

          // Enqueue 6 drip emails
          const insertSend = txDb.prepare(`
            INSERT INTO quiz_email_sends (quiz_lead_id, email_num, status, scheduled_for)
            VALUES (?, ?, 'queued', datetime('now', ? || ' hours'))
          `);
          for (let i = 0; i < DRIP_OFFSETS_HOURS.length; i++) {
            insertSend.run(newLeadId, i + 1, String('+' + DRIP_OFFSETS_HOURS[i]));
          }

          return newLeadId;
        });
      } catch (txErr) {
        console.error('Quiz lead transaction error:', txErr.message);
        return res.status(500).json({ error: 'Failed to save lead' });
      }
    } else {
      // ── Legacy path: single insert, no transaction needed ──
      db.prepare(`
        INSERT INTO quiz_leads (email, name, score, tier, answers, source_url, user_agent, fbp, fbc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        email,
        name || null,
        score != null ? score : null,
        tier || null,
        answers ? JSON.stringify(answers) : null,
        sourceUrl || null,
        userAgent || null,
        fbp || null,
        fbc || null
      );
    }

    // Fire CAPI Lead event (both paths)
    await sendCapiEvent('Lead', {
      email,
      sourceUrl,
      userAgent,
      fbp,
      fbc,
      customData: {
        content_name: 'Alignment Assessment Email',
        content_category: 'quiz_funnel',
        value: 0,
        currency: 'USD',
      },
    });

    // Push to GoHighLevel CRM (async, don't block response).
    // Pass funnel fields through so A.5 can use them when it extends handleQuizLead.
    handleQuizLead({
      email, name, score, tier, answers,
      result_program, depth_band, q9_fear, pattern_scores,
    }).catch(err => {
      console.error('[GHL] Quiz lead push failed:', err.message);
    });

    if (isFunnelSubmission) {
      const lead_token = signLeadToken(leadId);
      return res.json({ success: true, lead_id: leadId, lead_token });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Quiz lead error:', err.message);
    res.status(500).json({ error: 'Failed to save lead' });
  }
});

// ── POST /api/quiz/event — Fire arbitrary CAPI events ──
router.post('/event', async (req, res) => {
  try {
    const { eventName, email, score, tier, step, sourceUrl, userAgent, fbp, fbc } = req.body;

    if (!eventName) {
      return res.status(400).json({ error: 'eventName is required' });
    }

    // Map custom event names to standard Meta events where applicable
    const eventMap = {
      'ViewContent': 'ViewContent',
      'Lead': 'Lead',
      'Subscribe': 'Subscribe',
      'StartTrial': 'StartTrial',
      'AddToCart': 'AddToCart',
      'Purchase': 'Purchase',
      'AddPaymentInfo': 'AddPaymentInfo',
      'QuizStart': 'ViewContent',
      'QuizComplete': 'ViewContent',
      'QuizProgress': 'ViewContent',
    };

    const mappedEvent = eventMap[eventName] || eventName;

    const customData = {
      content_name: 'Alignment Assessment',
      content_category: 'quiz_funnel',
    };

    if (score !== undefined) customData.score = score;
    if (tier) customData.tier = tier;
    if (step !== undefined) customData.step = step;

    db.prepare(`
      INSERT INTO analytics_events (event_type, email, metadata)
      VALUES (?, ?, ?)
    `).run(
      eventName,
      email || null,
      JSON.stringify({
        score,
        tier,
        step,
        sourceUrl: sourceUrl || null,
      })
    );

    await sendCapiEvent(mappedEvent, {
      email,
      sourceUrl,
      userAgent,
      fbp,
      fbc,
      customData,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Quiz event error:', err.message);
    res.status(500).json({ error: 'Failed to send event' });
  }
});

// ── GET /api/quiz/leads — List leads (admin only) ──
router.get('/leads', requireAdmin, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const leads = db.prepare(
      'SELECT * FROM quiz_leads ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(limit, offset);
    const total = db.prepare('SELECT COUNT(*) as count FROM quiz_leads').get();
    res.json({ leads, total: total.count });
  } catch (err) {
    console.error('Quiz leads list error:', err.message);
    res.status(500).json({ error: 'Failed to list leads' });
  }
});

// ── Meta Conversions API Helper ──

async function sendCapiEvent(eventName, { email, sourceUrl, userAgent, fbp, fbc, customData }) {
  if (!CAPI_TOKEN || CAPI_TOKEN === 'YOUR_CAPI_TOKEN') {
    console.log(`[CAPI] Skipping ${eventName} — no token configured`);
    return;
  }

  try {
    const eventData = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_source_url: sourceUrl || 'https://heart.sovereignty.app/quiz',
      action_source: 'website',
      user_data: {},
    };

    // Hash PII for Meta (SHA-256, lowercase, trimmed)
    if (email) {
      eventData.user_data.em = [hashForMeta(email.toLowerCase().trim())];
    }

    // Browser identifiers
    if (fbp) eventData.user_data.fbp = fbp;
    if (fbc) eventData.user_data.fbc = fbc;
    if (userAgent) eventData.user_data.client_user_agent = userAgent;

    // Custom data
    if (customData) {
      eventData.custom_data = customData;
    }

    const response = await fetch(CAPI_URL + `?access_token=${CAPI_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [eventData],
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error(`[CAPI] ${eventName} failed:`, result);
    } else {
      console.log(`[CAPI] ${eventName} sent successfully`);
    }
  } catch (err) {
    console.error(`[CAPI] ${eventName} error:`, err.message);
  }
}

function hashForMeta(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export default router;
