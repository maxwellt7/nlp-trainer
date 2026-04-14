/**
 * Email Drip Scheduler
 *
 * Cron job (hourly) that sends sequenced nurture emails based on user lifecycle stage.
 *
 * Sequences:
 *   quiz_lead  — took quiz, didn't sign up   (Day 1, 3, 7)
 *   free_trial — signed up, didn't purchase  (Day 0, 2, 4, 7, 14)
 *
 * Tables: email_sends, email_preferences, free_trial_signups
 */

import nodemailer from 'nodemailer';
import cron from 'node-cron';
import crypto from 'crypto';
import db from '../db/index.js';

// ── Table setup ────────────────────────────────────────────────────────────────

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_sends (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email    TEXT NOT NULL,
      sequence_type TEXT NOT NULL,
      template_id   TEXT NOT NULL,
      sent_at       TEXT DEFAULT (datetime('now')),
      opened_at     TEXT DEFAULT NULL,
      clicked_at    TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS email_preferences (
      email            TEXT PRIMARY KEY,
      unsubscribed     INTEGER DEFAULT 0,
      unsubscribed_at  TEXT DEFAULT NULL,
      updated_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS free_trial_signups (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT NOT NULL UNIQUE,
      name          TEXT,
      clerk_user_id TEXT,
      created_at    TEXT DEFAULT (datetime('now'))
    );
  `);
}

// ── Nodemailer ─────────────────────────────────────────────────────────────────

function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.warn('[EmailScheduler] GMAIL_USER or GMAIL_APP_PASSWORD not set — emails disabled');
    return null;
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

// ── Unsubscribe helpers ────────────────────────────────────────────────────────

const UNSUB_SECRET = process.env.UNSUB_TOKEN_SECRET || 'sacred-heart-unsub-2025';

export function generateUnsubToken(email) {
  return crypto
    .createHmac('sha256', UNSUB_SECRET)
    .update(email.toLowerCase().trim())
    .digest('hex')
    .slice(0, 20);
}

export function verifyUnsubToken(email, token) {
  return generateUnsubToken(email) === token;
}

function unsubUrl(email) {
  const apiBase =
    process.env.API_BASE_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : 'https://nlp-trainer-production.up.railway.app');
  const token = generateUnsubToken(email);
  return `${apiBase}/api/email/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

export function unsubscribeEmail(email) {
  const lower = email.toLowerCase().trim();
  db.prepare(`
    INSERT INTO email_preferences (email, unsubscribed, unsubscribed_at, updated_at)
    VALUES (?, 1, datetime('now'), datetime('now'))
    ON CONFLICT(email) DO UPDATE SET
      unsubscribed = 1,
      unsubscribed_at = datetime('now'),
      updated_at = datetime('now')
  `).run(lower);
}

function isUnsubscribed(email) {
  const row = db
    .prepare('SELECT unsubscribed FROM email_preferences WHERE email = ?')
    .get(email.toLowerCase().trim());
  return row?.unsubscribed === 1;
}

// ── Send tracking ──────────────────────────────────────────────────────────────

function alreadySent(email, templateId) {
  const row = db
    .prepare('SELECT id FROM email_sends WHERE user_email = ? AND template_id = ?')
    .get(email.toLowerCase().trim(), templateId);
  return !!row;
}

function recordSend(email, sequenceType, templateId) {
  const lower = email.toLowerCase().trim();
  db.prepare(`
    INSERT INTO email_sends (user_email, sequence_type, template_id)
    VALUES (?, ?, ?)
  `).run(lower, sequenceType, templateId);

  // Analytics
  try {
    db.prepare(`
      INSERT INTO analytics_events (event_type, email, metadata)
      VALUES (?, ?, ?)
    `).run(
      'email_sent',
      lower,
      JSON.stringify({ template_id: templateId, sequence_type: sequenceType }),
    );
  } catch (_) {
    // analytics table may not exist yet on first boot
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function daysSince(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / 86_400_000);
}

// ── HTML email builder ─────────────────────────────────────────────────────────

const BRAND_COLOR = '#6B3FA0';
const BRAND_ACCENT = '#D4A843';
const BRAND_NAME = 'Sacred Heart';
const BRAND_URL = 'https://heart.sovereignty.app';
const FROM_ADDRESS = () =>
  `"${BRAND_NAME}" <${process.env.GMAIL_USER || 'noreply@sovereignty.app'}>`;

function btn(label, href) {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px auto 0;">
  <tr>
    <td style="background:${BRAND_COLOR};border-radius:6px;">
      <a href="${href}" style="display:inline-block;padding:14px 34px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.3px;">${label}</a>
    </td>
  </tr>
</table>`;
}

function wrap({ subject, preheader, bodyHtml, email }) {
  const unsub = unsubUrl(email);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f0ede8;">${preheader}&nbsp;‌&zwnj;&nbsp;‌&zwnj;&nbsp;‌&zwnj;&nbsp;</div>
<table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">

        <!-- Header bar -->
        <tr>
          <td style="background:${BRAND_COLOR};padding:28px 40px 24px;text-align:center;">
            <p style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">${BRAND_NAME}</p>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.65);font-size:12px;letter-spacing:0.8px;text-transform:uppercase;">AI Hypnosis &amp; Personal Development</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 44px 36px;">
            ${bodyHtml}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f7f5;border-top:1px solid #ede9e3;padding:22px 44px;text-align:center;">
            <p style="margin:0 0 6px;color:#999;font-size:11px;line-height:1.5;">
              ${BRAND_NAME} · Sovereignty App · San Francisco, CA
            </p>
            <p style="margin:0;color:#999;font-size:11px;line-height:1.5;">
              You received this because you took the Sacred Heart Alignment Assessment.<br>
              <a href="${unsub}" style="color:${BRAND_COLOR};text-decoration:underline;">Unsubscribe</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function p(text) {
  return `<p style="margin:0 0 18px;color:#333;font-size:15px;line-height:1.7;">${text}</p>`;
}
function h2(text) {
  return `<h2 style="margin:0 0 20px;color:#1a1a1a;font-size:20px;font-weight:700;line-height:1.3;">${text}</h2>`;
}
function li(items) {
  return `<ul style="margin:0 0 20px;padding-left:18px;">${items.map(i => `<li style="color:#444;font-size:15px;line-height:1.7;margin-bottom:6px;">${i}</li>`).join('')}</ul>`;
}
function divider() {
  return `<hr style="border:none;border-top:1px solid #ede9e3;margin:28px 0;">`;
}
function quote(text, attr) {
  return `<blockquote style="margin:0 0 20px;padding:14px 18px;background:#f8f4ff;border-left:4px solid ${BRAND_COLOR};border-radius:4px;">
  <p style="margin:0 0 8px;color:#444;font-size:15px;font-style:italic;line-height:1.6;">"${text}"</p>
  ${attr ? `<p style="margin:0;color:#888;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">— ${attr}</p>` : ''}
</blockquote>`;
}

// ── Quiz Lead Templates ────────────────────────────────────────────────────────

function buildQuizLeadDay1({ email, name, tier }) {
  const first = name?.split(' ')[0] || 'Friend';
  const archetype = tier || 'Seeker';
  const bodyHtml = [
    h2(`Your ${archetype} Results Are Ready, ${first}`),
    p(`You completed the Sacred Heart Alignment Assessment — and what it revealed about you as a <strong>${archetype}</strong> is genuinely worth exploring.`),
    p(`Most people take the quiz, skim the score, and move on. But your archetype is a map — it shows you <em>exactly</em> where your subconscious patterns are creating friction in your life.`),
    p(`Here's what Sacred Heart is designed to do for someone in your position:`),
    li([
      `Reprogram the limiting patterns specific to the <strong>${archetype}</strong> profile`,
      `Build a daily AI hypnosis practice calibrated to your score and life areas`,
      `Track real change across identity, relationships, career, and health`,
      `Surface insights your conscious mind keeps missing`,
    ]),
    btn('Start Your Free Journey', BRAND_URL),
    divider(),
    p(`No credit card. No commitment. Just your first session — free.<br><span style="color:#888;font-size:13px;">Takes less than 10 minutes.</span>`),
  ].join('');

  return {
    subject: `Your ${archetype} results + what they mean for you`,
    preheader: `Here's what your Sacred Heart score reveals — and one action to take today.`,
    bodyHtml,
  };
}

function buildQuizLeadDay3({ email, name, tier }) {
  const first = name?.split(' ')[0] || 'Friend';
  const archetype = tier || 'Seeker';
  const bodyHtml = [
    h2(`${first}, your patterns haven't changed — yet`),
    p(`Three days ago you took the Alignment Assessment. You're still a <strong>${archetype}</strong> — which means the same subconscious loops are still running.`),
    p(`The research is clear: awareness without action cements patterns rather than breaking them. The window where insight creates change is narrow.`),
    quote(`I've done therapy, journaling, and meditation for years. Sacred Heart was the first thing that actually moved the needle on my identity patterns.`, `Sacred Heart member, ${archetype} profile`),
    p(`People who start within the first week of taking the quiz are <strong>3× more likely</strong> to report meaningful shifts in the first month. The ones who wait typically don't come back.`),
    p(`You still have full access to start — free, no card required.`),
    btn('Begin My First Session', BRAND_URL),
    divider(),
    p(`<span style="color:#888;font-size:13px;">Not the right time? <a href="${BRAND_URL}" style="color:${BRAND_COLOR};">Reply to this email</a> and let me know what's in the way.</span>`),
  ].join('');

  return {
    subject: `The ${archetype} pattern that's still running (3 days later)`,
    preheader: `Awareness alone doesn't change patterns — here's what does.`,
    bodyHtml,
  };
}

function buildQuizLeadDay7({ email, name, tier }) {
  const first = name?.split(' ')[0] || 'Friend';
  const archetype = tier || 'Seeker';
  const bodyHtml = [
    h2(`Last message, ${first} — I want to be straight with you`),
    p(`It's been a week since your Alignment Assessment. I've sent you two messages about what your <strong>${archetype}</strong> profile means and how Sacred Heart can help you move through it.`),
    p(`This is my last one.`),
    p(`I'm not going to tell you this offer lasts forever — most things don't. What I <em>will</em> tell you is this:`),
    quote(`The cost of inaction isn't zero. Every week the same patterns run, they get more entrenched. The ${archetype} profile is especially prone to analysis paralysis — and that tendency shows up right here, in this moment.`, ``),
    p(`If you're ready to actually change something — one session, on your schedule, starting today:`),
    btn('Claim My Free Session Now', BRAND_URL),
    divider(),
    p(`If this isn't for you, no hard feelings. I won't send you anything else.<br><span style="color:#888;font-size:13px;">— The Sacred Heart Team</span>`),
  ].join('');

  return {
    subject: `Final message: your ${archetype} profile + one last invitation`,
    preheader: `One week. Same patterns. This is the last nudge — I promise.`,
    bodyHtml,
  };
}

// ── Free Trial Templates ───────────────────────────────────────────────────────

function buildTrialDay0({ email, name }) {
  const first = name?.split(' ')[0] || 'Friend';
  const bodyHtml = [
    h2(`Welcome to Sacred Heart, ${first}`),
    p(`You're in. Your Sacred Heart account is live and your first AI-powered hypnosis session is waiting for you.`),
    p(`Here's how to get the most out of your first week:`),
    li([
      `<strong>Start with the Alignment Check-in</strong> — it personalizes your hypnosis scripts from day one`,
      `<strong>Do your first session tonight</strong> — 10–20 minutes before sleep works best`,
      `<strong>Rate the experience</strong> after — the AI uses your feedback to adjust`,
      `<strong>Check your Identity Score</strong> in the Profile tab to see your baseline`,
    ]),
    btn('Open Sacred Heart', BRAND_URL),
    divider(),
    p(`Questions? Just reply to this email — I read every one.<br><span style="color:#888;font-size:13px;">— The Sacred Heart Team</span>`),
  ].join('');

  return {
    subject: `Welcome to Sacred Heart — here's how to start`,
    preheader: `Your first session is waiting. Here's the 4-step quick-start guide.`,
    bodyHtml,
  };
}

function buildTrialDay2({ email, name }) {
  const first = name?.split(' ')[0] || 'Friend';
  const bodyHtml = [
    h2(`How hypnosis actually works, ${first}`),
    p(`Two days in — let's talk about what's actually happening in your Sacred Heart sessions.`),
    p(`Hypnosis isn't about swinging watches or losing control. It's a state of <strong>focused, receptive attention</strong> where the critical filter of the conscious mind relaxes — and direct communication with the subconscious becomes possible.`),
    p(`Here's what to expect at each stage:`),
    li([
      `<strong>Induction (0–3 min):</strong> Your nervous system slows. Brainwaves shift from beta to alpha/theta.`,
      `<strong>Deepener (3–7 min):</strong> You enter a light trance. You're still aware — just highly focused.`,
      `<strong>Script (7–18 min):</strong> The AI delivers personalized suggestions calibrated to your profile.`,
      `<strong>Emergence (18–20 min):</strong> Gradual return. Most people feel calm, clear, and lighter.`,
    ]),
    p(`The changes aren't always dramatic at first — they often show up as subtle shifts in how you react, decide, or feel. Track them in your journal.`),
    btn('Continue My Journey', BRAND_URL),
  ].join('');

  return {
    subject: `What's actually happening inside your sessions`,
    preheader: `The neuroscience of hypnosis — explained simply.`,
    bodyHtml,
  };
}

function buildTrialDay4({ email, name }) {
  const first = name?.split(' ')[0] || 'Friend';
  const bodyHtml = [
    h2(`Checking in — how's it going, ${first}?`),
    p(`Four days into your Sacred Heart journey. I wanted to check in.`),
    p(`Here's what people typically notice in the first week:`),
    li([
      `Slightly improved sleep quality after evening sessions`,
      `More awareness of their automatic thought patterns`,
      `A quieter inner critic during the day`,
      `Moments of unexpected clarity`,
    ]),
    p(`Some people notice a lot. Some notice a little. Both are normal — the subconscious works on its own timeline.`),
    p(`The one thing that consistently predicts results: <strong>consistency</strong>. Even 3 sessions in the first week produces measurably different outcomes than 1.`),
    quote(`I almost gave up after the first two sessions — nothing felt different. By session five, something shifted. I started catching my old story mid-thought.`, `Sacred Heart member`),
    btn('Log Today\'s Session', BRAND_URL),
    divider(),
    p(`<span style="color:#888;font-size:13px;">Anything not working the way you expected? Reply and let me know — I want to help.</span>`),
  ].join('');

  return {
    subject: `Day 4: How's your Sacred Heart experience going?`,
    preheader: `A quick check-in — and what most people notice in week one.`,
    bodyHtml,
  };
}

function buildTrialDay7({ email, name }) {
  const first = name?.split(' ')[0] || 'Friend';
  const bodyHtml = [
    h2(`Your first week is almost over, ${first}`),
    p(`You've had a full week with Sacred Heart. Whether you've done 1 session or 7, you've seen a glimpse of what's possible.`),
    p(`Your free access includes the core practice. The full Sacred Heart journey unlocks:`),
    li([
      `<strong>Unlimited AI hypnosis sessions</strong> — no daily caps`,
      `<strong>Advanced identity analysis</strong> — deep pattern mapping across 12 dimensions`,
      `<strong>Custom audio generation</strong> — sessions with your preferred music, voice, and length`,
      `<strong>Full journey arc</strong> — a 90-day transformation sequence built around your profile`,
      `<strong>Memory & continuity</strong> — the AI remembers your history and adapts over time`,
    ]),
    p(`This is the system for people who are serious about change. It's $7 — a single cup of coffee.`),
    btn('Unlock the Full Journey — $7', `${BRAND_URL}/upgrade`),
    divider(),
    p(`<span style="color:#888;font-size:13px;">Free access continues — no pressure. This is just for ${first}'s who want more.</span>`),
  ].join('');

  return {
    subject: `Week 1 complete — unlock the full Sacred Heart journey`,
    preheader: `What's waiting inside the full experience — and why it's $7.`,
    bodyHtml,
  };
}

function buildTrialDay14({ email, name }) {
  const first = name?.split(' ')[0] || 'Friend';
  const bodyHtml = [
    h2(`${first} — we miss you`),
    p(`It's been a couple of weeks. Sacred Heart is still here, your profile is still saved, and your journey is exactly where you left it.`),
    p(`Life gets busy. That's not an excuse — it's a reason. The question is: what would shift if you carved out 15 minutes tonight?`),
    p(`Here's what your Sacred Heart profile says about right now:`),
    li([
      `Your subconscious patterns haven't changed — they need practice to shift`,
      `The longer the gap, the higher the threshold to re-enter a practice`,
      `Re-engagement sessions are specially designed to meet you where you are`,
    ]),
    p(`No guilt. No pressure. Just one session — to remind yourself what this feels like.`),
    btn('Return to My Journey', BRAND_URL),
    divider(),
    p(`If Sacred Heart isn't the right fit, I'd genuinely like to know why. Just reply — it helps us build something better.<br><span style="color:#888;font-size:13px;">— The Sacred Heart Team</span>`),
  ].join('');

  return {
    subject: `${first}, we saved your spot`,
    preheader: `It's been 2 weeks. Your Sacred Heart journey is still here waiting for you.`,
    bodyHtml,
  };
}

// ── Core send function ─────────────────────────────────────────────────────────

async function sendEmail(transporter, { to, fromAddress, subject, preheader, bodyHtml, email }) {
  const html = wrap({ subject, preheader, bodyHtml, email: to });
  await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    html,
    headers: {
      'List-Unsubscribe': `<${unsubUrl(to)}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
}

// ── Sequence processors ────────────────────────────────────────────────────────

async function processQuizLeads(transporter) {
  const SEQUENCE = [
    { templateId: 'quiz_lead_day1', minDays: 1, maxDays: 2, builder: buildQuizLeadDay1 },
    { templateId: 'quiz_lead_day3', minDays: 3, maxDays: 4, builder: buildQuizLeadDay3 },
    { templateId: 'quiz_lead_day7', minDays: 7, maxDays: 10, builder: buildQuizLeadDay7 },
  ];

  // Leads that have NOT purchased
  const leads = db.prepare(`
    SELECT ql.email, ql.name, ql.tier, ql.score, ql.created_at
    FROM quiz_leads ql
    WHERE ql.email NOT IN (SELECT email FROM paid_users WHERE paid_status = 'active')
    ORDER BY ql.created_at ASC
  `).all();

  let sent = 0;
  for (const lead of leads) {
    if (isUnsubscribed(lead.email)) continue;
    const age = daysSince(lead.created_at);

    for (const step of SEQUENCE) {
      if (age < step.minDays || age > step.maxDays) continue;
      if (alreadySent(lead.email, step.templateId)) continue;

      try {
        const { subject, preheader, bodyHtml } = step.builder({
          email: lead.email,
          name: lead.name,
          tier: lead.tier,
        });
        await sendEmail(transporter, {
          to: lead.email,
          fromAddress: FROM_ADDRESS(),
          subject,
          preheader,
          bodyHtml,
        });
        recordSend(lead.email, 'quiz_lead', step.templateId);
        console.log(`[EmailScheduler] Sent ${step.templateId} → ${lead.email}`);
        sent++;
      } catch (err) {
        console.error(`[EmailScheduler] Failed to send ${step.templateId} to ${lead.email}:`, err.message);
      }
    }
  }
  return sent;
}

async function processTrialUsers(transporter) {
  const SEQUENCE = [
    { templateId: 'trial_day0',  minDays: 0,  maxDays: 1,  builder: buildTrialDay0 },
    { templateId: 'trial_day2',  minDays: 2,  maxDays: 3,  builder: buildTrialDay2 },
    { templateId: 'trial_day4',  minDays: 4,  maxDays: 5,  builder: buildTrialDay4 },
    { templateId: 'trial_day7',  minDays: 7,  maxDays: 9,  builder: buildTrialDay7 },
    { templateId: 'trial_day14', minDays: 14, maxDays: 17, builder: buildTrialDay14 },
  ];

  // Trial users who have NOT purchased
  const users = db.prepare(`
    SELECT ft.email, ft.name, ft.created_at
    FROM free_trial_signups ft
    WHERE ft.email NOT IN (SELECT email FROM paid_users WHERE paid_status = 'active')
    ORDER BY ft.created_at ASC
  `).all();

  let sent = 0;
  for (const user of users) {
    if (isUnsubscribed(user.email)) continue;
    const age = daysSince(user.created_at);

    for (const step of SEQUENCE) {
      if (age < step.minDays || age > step.maxDays) continue;
      if (alreadySent(user.email, step.templateId)) continue;

      try {
        const { subject, preheader, bodyHtml } = step.builder({
          email: user.email,
          name: user.name,
        });
        await sendEmail(transporter, {
          to: user.email,
          fromAddress: FROM_ADDRESS(),
          subject,
          preheader,
          bodyHtml,
        });
        recordSend(user.email, 'free_trial', step.templateId);
        console.log(`[EmailScheduler] Sent ${step.templateId} → ${user.email}`);
        sent++;
      } catch (err) {
        console.error(`[EmailScheduler] Failed to send ${step.templateId} to ${user.email}:`, err.message);
      }
    }
  }
  return sent;
}

// ── Main heartbeat ─────────────────────────────────────────────────────────────

async function runSchedulerHeartbeat() {
  console.log('[EmailScheduler] Heartbeat starting...');
  const transporter = createTransporter();
  if (!transporter) {
    console.log('[EmailScheduler] No transporter — skipping run');
    return;
  }

  try {
    const quizSent = await processQuizLeads(transporter);
    const trialSent = await processTrialUsers(transporter);
    console.log(`[EmailScheduler] Heartbeat complete — quiz_lead: ${quizSent}, free_trial: ${trialSent}`);
  } catch (err) {
    console.error('[EmailScheduler] Heartbeat error:', err.message);
  }
}

// ── Register a new free trial signup ──────────────────────────────────────────

export function registerTrialSignup({ email, name, clerkUserId }) {
  if (!email) return;
  const lower = email.toLowerCase().trim();
  try {
    db.prepare(`
      INSERT INTO free_trial_signups (email, name, clerk_user_id)
      VALUES (?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, name),
        clerk_user_id = COALESCE(EXCLUDED.clerk_user_id, clerk_user_id)
    `).run(lower, name || null, clerkUserId || null);
    console.log(`[EmailScheduler] Registered trial signup: ${lower}`);
  } catch (err) {
    console.error('[EmailScheduler] registerTrialSignup error:', err.message);
  }
}

// ── Init & export ──────────────────────────────────────────────────────────────

let schedulerTask = null;

export function initEmailScheduler() {
  try {
    initTables();
    console.log('[EmailScheduler] Tables ready');

    // Run once on startup (catches any missed sends after deploy)
    runSchedulerHeartbeat();

    // Hourly cron: "0 * * * *"
    schedulerTask = cron.schedule('0 * * * *', runSchedulerHeartbeat, {
      scheduled: true,
      timezone: 'America/Los_Angeles',
    });

    console.log('[EmailScheduler] Cron scheduled (hourly)');
  } catch (err) {
    console.error('[EmailScheduler] Init error:', err.message);
  }
}

export function stopEmailScheduler() {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
  }
}

export { runSchedulerHeartbeat };
