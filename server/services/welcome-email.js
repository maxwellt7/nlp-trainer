// Post-purchase welcome email.
//
// Sent from the Stripe webhook after a successful checkout so the customer
// actually knows where to log in. Before this existed, paying customers got
// no instructions at all (the team had assumed GHL native automation would
// handle it, but the workflow wasn't wired up). De'Yona Moore disputed
// access; she was not unlucky — every customer hit the same gap.

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const APP_URL = 'https://heart.sovereignty.app';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmail({ email, name }) {
  const firstName = (name || '').trim().split(/\s+/)[0] || '';
  // Plain text uses the raw name; HTML uses the escaped form. Don't share
  // the escaped greeting between both — the text version would otherwise
  // show "Hi De&#39;Yona," literally in mail clients that render text/plain.
  const greetingText = firstName ? `Hi ${firstName},` : 'Hi there,';
  const greetingHtml = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi there,';
  // We send the customer to /sign-in with their email pre-filled so they
  // only need to click the magic link Clerk sends them. Even without the
  // prefill working, the URL gets them to the right place.
  const loginUrl = `${APP_URL}/sign-in?email=${encodeURIComponent(email)}`;

  const subject = 'Your Alignment Engine access is ready';

  const text = [
    greetingText,
    '',
    'Thanks for picking up the Alignment Engine — your access is live.',
    '',
    `To sign in, go to ${loginUrl} and enter this email (${email}).`,
    'You\'ll receive a one-time verification code; no password required.',
    '',
    'Once you\'re in, your dashboard will guide you through your first session.',
    '',
    'Reply to this email if anything looks off and I\'ll sort it out personally.',
    '',
    '— Max',
    'Sovereignty / Alignment Engine',
  ].join('\n');

  const html = `
<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a; line-height: 1.6;">
    <p style="margin: 0 0 16px;">${greetingHtml}</p>
    <p style="margin: 0 0 16px;">Thanks for picking up the Alignment Engine — your access is live.</p>
    <p style="margin: 0 0 24px;">
      <a href="${loginUrl}" style="display: inline-block; background: #d4a853; color: #1a1a1a; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
        Sign in to your dashboard
      </a>
    </p>
    <p style="margin: 0 0 16px; font-size: 14px; color: #555;">
      Or visit <a href="${loginUrl}" style="color: #1a1a1a;">${loginUrl}</a> and enter <strong>${escapeHtml(email)}</strong>.
      You'll receive a one-time verification code — no password required.
    </p>
    <p style="margin: 24px 0 16px;">Once you're in, your dashboard will guide you through your first session.</p>
    <p style="margin: 24px 0 0; font-size: 14px; color: #555;">
      Reply to this email if anything looks off and I'll sort it out personally.
    </p>
    <p style="margin: 24px 0 0;">— Max<br/><span style="color: #888; font-size: 13px;">Sovereignty / Alignment Engine</span></p>
  </body>
</html>`.trim();

  return { subject, text, html };
}

/**
 * Send the post-purchase welcome email via Resend.
 *
 * @returns {Promise<
 *   { ok: true, id: string } |
 *   { ok: false, skipped: true } |
 *   { ok: false, error: string, status?: number }
 * >}
 */
export async function sendWelcomeEmail(
  { email, name } = {},
  {
    fetch: fetchImpl = globalThis.fetch,
    apiKey = process.env.RESEND_API_KEY || '',
    from = process.env.RESEND_FROM_EMAIL || 'Sovereignty <support@sovereignty.app>',
  } = {},
) {
  if (!email || !String(email).trim()) {
    return { ok: false, error: 'missing recipient email' };
  }
  if (!apiKey) {
    // Skipped silently so the Stripe webhook in environments without Resend
    // (local dev, preview) doesn't surface a misleading error.
    console.warn('[WelcomeEmail] RESEND_API_KEY not set — skipping send');
    return { ok: false, skipped: true };
  }

  const { subject, text, html } = buildEmail({ email, name });
  const payload = {
    from,
    to: [String(email).trim()],
    subject,
    html,
    text,
  };

  try {
    const response = await fetchImpl(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const msg = errBody?.message || errBody?.name || `HTTP ${response.status}`;
      console.error(`[WelcomeEmail] Resend ${response.status}:`, JSON.stringify(errBody));
      return { ok: false, status: response.status, error: msg };
    }

    const body = await response.json();
    return { ok: true, id: body?.id || '' };
  } catch (err) {
    console.error('[WelcomeEmail] fetch error:', err.message);
    return { ok: false, error: err.message };
  }
}
