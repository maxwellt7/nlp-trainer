import test from 'node:test';
import assert from 'node:assert/strict';
import { sendWelcomeEmail } from './welcome-email.js';

function makeFetchSpy({ ok = true, status = 200, body = { id: 'msg-123' } } = {}) {
  const calls = [];
  const fetchSpy = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  };
  return { calls, fetchSpy };
}

test('sendWelcomeEmail posts a Resend email with the customer email, name, and login URL', async () => {
  const { calls, fetchSpy } = makeFetchSpy();
  const result = await sendWelcomeEmail(
    { email: 'deyona@example.com', name: "De'Yona Moore" },
    { fetch: fetchSpy, apiKey: 'rs_test_key', from: 'Sovereignty <support@sovereignty.app>' },
  );

  assert.equal(result.ok, true);
  assert.equal(result.id, 'msg-123');
  assert.equal(calls.length, 1);

  const { url, opts } = calls[0];
  assert.equal(url, 'https://api.resend.com/emails');
  assert.equal(opts.method, 'POST');
  assert.equal(opts.headers.Authorization, 'Bearer rs_test_key');
  assert.equal(opts.headers['Content-Type'], 'application/json');

  const body = JSON.parse(opts.body);
  assert.equal(body.from, 'Sovereignty <support@sovereignty.app>');
  assert.deepEqual(body.to, ['deyona@example.com']);
  assert.match(body.subject, /Alignment Engine|welcome|access|ready/i);
  // The HTML and text bodies must contain the login URL and address the
  // customer by name. This is the whole point of the email. The HTML may
  // entity-escape the apostrophe in "De'Yona" — tolerate that.
  assert.match(body.html, /heart\.sovereignty\.app/);
  assert.match(body.html, /De[^Y]{0,8}Yona/);
  assert.match(body.text, /heart\.sovereignty\.app/);
  assert.match(body.text, /De.?Yona/);
});

test('sendWelcomeEmail handles a missing name gracefully', async () => {
  const { calls, fetchSpy } = makeFetchSpy();
  const result = await sendWelcomeEmail(
    { email: 'no-name@example.com', name: null },
    { fetch: fetchSpy, apiKey: 'rs_test_key', from: 'support@sovereignty.app' },
  );
  assert.equal(result.ok, true);
  const body = JSON.parse(calls[0].opts.body);
  // Greeting must still land (e.g. "Hi there,") — never address as "null" or "undefined".
  assert.doesNotMatch(body.html, /null|undefined/i);
  assert.doesNotMatch(body.text, /null|undefined/i);
});

test('sendWelcomeEmail skips silently (ok:false, skipped:true) when no API key is configured', async () => {
  // The Stripe webhook must NOT crash on environments without RESEND_API_KEY
  // (e.g. local dev, preview). Return a structured "skipped" result so the
  // caller can log without surfacing a real error.
  const { calls, fetchSpy } = makeFetchSpy();
  const result = await sendWelcomeEmail(
    { email: 'a@b.com', name: 'A' },
    { fetch: fetchSpy, apiKey: '', from: 'support@sovereignty.app' },
  );
  assert.equal(result.ok, false);
  assert.equal(result.skipped, true);
  assert.equal(calls.length, 0, 'must not hit Resend without an API key');
});

test('sendWelcomeEmail returns ok:false with the Resend error body when the API call fails', async () => {
  const { calls, fetchSpy } = makeFetchSpy({
    ok: false,
    status: 422,
    body: { name: 'validation_error', message: 'invalid recipient' },
  });
  const result = await sendWelcomeEmail(
    { email: 'bad', name: 'X' },
    { fetch: fetchSpy, apiKey: 'rs_test_key', from: 'support@sovereignty.app' },
  );
  assert.equal(result.ok, false);
  assert.equal(result.skipped, undefined);
  assert.equal(result.status, 422);
  assert.match(result.error, /invalid recipient|validation_error/);
  assert.equal(calls.length, 1);
});

test('sendWelcomeEmail returns ok:false when email is missing — never silently no-ops the caller', async () => {
  const { calls, fetchSpy } = makeFetchSpy();
  const result = await sendWelcomeEmail(
    { email: '', name: 'X' },
    { fetch: fetchSpy, apiKey: 'rs_test_key', from: 'support@sovereignty.app' },
  );
  assert.equal(result.ok, false);
  assert.equal(result.error, 'missing recipient email');
  assert.equal(calls.length, 0);
});
