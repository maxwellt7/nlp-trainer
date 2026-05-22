/**
 * Unit tests for server/middleware/tokens.js
 *
 * Run with:
 *   LEAD_TOKEN_HMAC_SECRET=test-lead-secret-32-chars-min-len \
 *   UNSUBSCRIBE_HMAC_SECRET=test-unsub-secret-32-chars-min-len \
 *   node --test server/middleware/tokens.test.js
 *
 * Uses Node's built-in test runner (node:test) — no external dependencies.
 * Secrets are manipulated per-test; each test restores the originals in `after`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  signLeadToken,
  verifyLeadToken,
  signUnsubToken,
  verifyUnsubToken,
} from './tokens.js';

// ── 1. Roundtrip — lead token ────────────────────────────────────────────────
test('1. roundtrip: verifyLeadToken(signLeadToken(123)) returns correct payload', () => {
  const token = signLeadToken(123);
  const result = verifyLeadToken(token);

  assert.ok(result !== null, 'Expected non-null result');
  assert.equal(result.lead_id, 123);
  assert.ok(typeof result.exp === 'number', 'exp should be a number');
  assert.ok(result.exp > Math.floor(Date.now() / 1000), 'exp should be in the future');
});

// ── 2. Roundtrip — unsub token ───────────────────────────────────────────────
test("2. roundtrip: verifyUnsubToken(signUnsubToken('a@b.com', 7)) returns correct payload", () => {
  const token = signUnsubToken('a@b.com', 7);
  const result = verifyUnsubToken(token);

  assert.ok(result !== null, 'Expected non-null result');
  assert.equal(result.email, 'a@b.com');
  assert.equal(result.lead_id, 7);
});

// ── 3. Tampering: payload portion ────────────────────────────────────────────
test('3. tampering: mutate one char in payload → verifyLeadToken returns null', () => {
  const token = signLeadToken(42);
  const [payload, sig] = token.split('.');

  // Flip the first character of the payload
  const tampered = payload[0] === 'a' ? 'b' + payload.slice(1) : 'a' + payload.slice(1);
  const tamperedToken = `${tampered}.${sig}`;

  assert.equal(verifyLeadToken(tamperedToken), null);
});

test('3b. tampering: mutate one char in payload → verifyUnsubToken returns null', () => {
  const token = signUnsubToken('x@y.com', 5);
  const [payload, sig] = token.split('.');

  const tampered = payload[0] === 'a' ? 'b' + payload.slice(1) : 'a' + payload.slice(1);
  const tamperedToken = `${tampered}.${sig}`;

  assert.equal(verifyUnsubToken(tamperedToken), null);
});

// ── 4. Tampering: signature portion ─────────────────────────────────────────
test('4. tampering: mutate one char in signature → verifyLeadToken returns null', () => {
  const token = signLeadToken(99);
  const [payload, sig] = token.split('.');

  // Flip the last character of the signature
  const lastChar = sig[sig.length - 1];
  const newLastChar = lastChar === 'f' ? '0' : 'f';
  const tamperedSig = sig.slice(0, -1) + newLastChar;
  const tamperedToken = `${payload}.${tamperedSig}`;

  assert.equal(verifyLeadToken(tamperedToken), null);
});

test('4b. tampering: mutate one char in signature → verifyUnsubToken returns null', () => {
  const token = signUnsubToken('q@r.com', 3);
  const [payload, sig] = token.split('.');

  const lastChar = sig[sig.length - 1];
  const newLastChar = lastChar === 'f' ? '0' : 'f';
  const tamperedSig = sig.slice(0, -1) + newLastChar;
  const tamperedToken = `${payload}.${tamperedSig}`;

  assert.equal(verifyUnsubToken(tamperedToken), null);
});

// ── 5. Wrong secret ──────────────────────────────────────────────────────────
test('5. wrong secret: token signed with secret A, verified with secret B → null', () => {
  const original = process.env.LEAD_TOKEN_HMAC_SECRET;
  try {
    process.env.LEAD_TOKEN_HMAC_SECRET = 'secret-A-32-chars-xxxxxxxxxxxxxxxxx';
    const token = signLeadToken(55);

    process.env.LEAD_TOKEN_HMAC_SECRET = 'secret-B-32-chars-xxxxxxxxxxxxxxxxx';
    assert.equal(verifyLeadToken(token), null);
  } finally {
    process.env.LEAD_TOKEN_HMAC_SECRET = original;
  }
});

// ── 6. Expired token ─────────────────────────────────────────────────────────
test('6. expired: token with 1-second TTL is null after 1.1s', { timeout: 5000 }, async () => {
  // Sign with a 1-second TTL by passing ttlMs override
  const token = signLeadToken(77, 1000); // 1 000 ms = 1 s

  // Should be valid immediately
  assert.ok(verifyLeadToken(token) !== null, 'Token should be valid immediately after signing');

  // Wait 1.1 seconds
  await new Promise((resolve) => setTimeout(resolve, 1100));

  assert.equal(verifyLeadToken(token), null, 'Token should be null after TTL elapses');
});

// ── 7. Bad format ────────────────────────────────────────────────────────────
test("7. bad format: '' → verifyLeadToken returns null", () => {
  assert.equal(verifyLeadToken(''), null);
});

test("7b. bad format: 'no-dot' → verifyLeadToken returns null", () => {
  assert.equal(verifyLeadToken('no-dot'), null);
});

test("7c. bad format: 'too.many.dots.here' → verifyLeadToken returns null", () => {
  assert.equal(verifyLeadToken('too.many.dots.here'), null);
});

test("7d. bad format: '' → verifyUnsubToken returns null", () => {
  assert.equal(verifyUnsubToken(''), null);
});

test("7e. bad format: 'no-dot' → verifyUnsubToken returns null", () => {
  assert.equal(verifyUnsubToken('no-dot'), null);
});

test("7f. bad format: 'too.many.dots.here' → verifyUnsubToken returns null", () => {
  assert.equal(verifyUnsubToken('too.many.dots.here'), null);
});

// ── 8. Wrong intent ───────────────────────────────────────────────────────────
test('8. wrong intent: lead token passed to verifyUnsubToken → null (no intent: "unsub")', () => {
  // Lead tokens use LEAD_TOKEN_HMAC_SECRET; unsub tokens use UNSUBSCRIBE_HMAC_SECRET.
  // Even if both secrets happened to match, the payload has no intent field.
  // In the normal case the secrets differ, so the signature check also fails.
  const leadToken = signLeadToken(10);
  assert.equal(verifyUnsubToken(leadToken), null);
});

// ── 9. Missing secret ─────────────────────────────────────────────────────────
test('9a. missing secret: signLeadToken throws when LEAD_TOKEN_HMAC_SECRET is unset', () => {
  const original = process.env.LEAD_TOKEN_HMAC_SECRET;
  try {
    delete process.env.LEAD_TOKEN_HMAC_SECRET;
    // signLeadToken MUST throw — a token cannot be created without a secret.
    // This is documented behavior: better to fail loudly at sign time than to
    // silently produce a token that can never be verified.
    assert.throws(() => signLeadToken(1), {
      message: /secret.*required|required.*secret/i,
    });
  } finally {
    process.env.LEAD_TOKEN_HMAC_SECRET = original;
  }
});

test('9b. missing secret: verifyLeadToken returns null when LEAD_TOKEN_HMAC_SECRET is unset', () => {
  const original = process.env.LEAD_TOKEN_HMAC_SECRET;
  let token;
  try {
    // Sign while secret is present
    token = signLeadToken(2);
  } finally {
    // Ensure we restore even if sign threw
  }

  try {
    delete process.env.LEAD_TOKEN_HMAC_SECRET;
    // verify must return null — no secret means the token cannot be trusted.
    assert.equal(verifyLeadToken(token), null);
  } finally {
    process.env.LEAD_TOKEN_HMAC_SECRET = original;
  }
});

test('9c. missing secret: signUnsubToken throws when UNSUBSCRIBE_HMAC_SECRET is unset', () => {
  const original = process.env.UNSUBSCRIBE_HMAC_SECRET;
  try {
    delete process.env.UNSUBSCRIBE_HMAC_SECRET;
    assert.throws(() => signUnsubToken('c@d.com', 3), {
      message: /secret.*required|required.*secret/i,
    });
  } finally {
    process.env.UNSUBSCRIBE_HMAC_SECRET = original;
  }
});

test('9d. missing secret: verifyUnsubToken returns null when UNSUBSCRIBE_HMAC_SECRET is unset', () => {
  const original = process.env.UNSUBSCRIBE_HMAC_SECRET;
  const token = signUnsubToken('e@f.com', 4);

  try {
    delete process.env.UNSUBSCRIBE_HMAC_SECRET;
    assert.equal(verifyUnsubToken(token), null);
  } finally {
    process.env.UNSUBSCRIBE_HMAC_SECRET = original;
  }
});
