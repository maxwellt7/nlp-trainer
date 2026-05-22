/**
 * HMAC token helpers for lead and unsubscribe tokens.
 *
 * Two token families:
 *   - Lead tokens   — HMAC over { lead_id, exp } using LEAD_TOKEN_HMAC_SECRET
 *   - Unsub tokens  — HMAC over { email, lead_id, intent: "unsub" } using UNSUBSCRIBE_HMAC_SECRET
 *
 * Token format: <base64url-JSON-payload>.<hex-HMAC-SHA256-signature>
 *
 * Secrets are read from process.env at call time (not at import time) so that
 * tests can manipulate them freely.
 *
 * Missing secret behavior:
 *   - sign*: throws — a token cannot be created without a secret.
 *   - verify*: returns null — a token without a matching secret is invalid.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

// ─── Internal helpers ────────────────────────────────────────────────────────

const DEFAULT_LEAD_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Encode a plain Buffer / string as base64url (no padding). */
function toBase64url(input) {
  const b64 = Buffer.from(input).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Decode a base64url string to a UTF-8 string. Returns null on failure. */
function fromBase64url(str) {
  // Restore standard base64 padding
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  const standard = padded.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return Buffer.from(standard, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

/** Build a hex HMAC-SHA256 over the given data string using secret. */
function hmacHex(secret, data) {
  return createHmac('sha256', secret).update(data).digest('hex');
}

/** Constant-time comparison of two hex strings. Returns false if lengths differ. */
function hexEqual(a, b) {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

/** Sign an arbitrary payload object with the given secret. Returns the token string. */
function buildToken(payload, secret) {
  if (!secret) {
    throw new Error('Token secret is required but was not set in environment.');
  }
  const payloadB64 = toBase64url(JSON.stringify(payload));
  const sig = hmacHex(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

/**
 * Verify a token against the given secret. Returns the parsed payload object
 * on success, or null on any failure (bad format, bad sig, wrong secret,
 * missing secret).
 */
function verifyToken(token, secret) {
  if (!secret) return null;

  if (typeof token !== 'string') return null;
  const parts = token.split('.');

  // Must be exactly two parts: payload and sig
  if (parts.length !== 2) return null;

  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;

  // Recompute expected sig
  const expected = hmacHex(secret, payloadB64);

  // Constant-time comparison — expected length equals actual hex length (64 chars)
  if (!hexEqual(sig, expected)) return null;

  // Decode payload
  const raw = fromBase64url(payloadB64);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Sign a lead token for the given leadId.
 * @param {number} leadId
 * @param {number} [ttlMs] - TTL in milliseconds (default 30 days)
 * @returns {string} token
 * @throws if LEAD_TOKEN_HMAC_SECRET is not set
 */
export function signLeadToken(leadId, ttlMs = DEFAULT_LEAD_TTL_MS) {
  const secret = process.env.LEAD_TOKEN_HMAC_SECRET;
  const exp = Math.floor((Date.now() + ttlMs) / 1000); // unix seconds
  return buildToken({ lead_id: leadId, exp }, secret);
}

/**
 * Verify a lead token.
 * @param {string} token
 * @returns {{ lead_id: number, exp: number } | null}
 */
export function verifyLeadToken(token) {
  const secret = process.env.LEAD_TOKEN_HMAC_SECRET;
  const payload = verifyToken(token, secret);
  if (!payload) return null;

  // Check expiration — token is considered expired at (and after) its exp second.
  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) return null;

  if (typeof payload.lead_id !== 'number') return null;

  return { lead_id: payload.lead_id, exp: payload.exp };
}

/**
 * Sign an unsubscribe token for the given email + leadId.
 * No expiration — unsub links should remain valid as long as the secret is.
 * @param {string} email
 * @param {number} leadId
 * @returns {string} token
 * @throws if UNSUBSCRIBE_HMAC_SECRET is not set
 */
export function signUnsubToken(email, leadId) {
  const secret = process.env.UNSUBSCRIBE_HMAC_SECRET;
  return buildToken({ email, lead_id: leadId, intent: 'unsub' }, secret);
}

/**
 * Verify an unsubscribe token.
 * @param {string} token
 * @returns {{ email: string, lead_id: number } | null}
 */
export function verifyUnsubToken(token) {
  const secret = process.env.UNSUBSCRIBE_HMAC_SECRET;
  const payload = verifyToken(token, secret);
  if (!payload) return null;

  // Must carry the correct intent
  if (payload.intent !== 'unsub') return null;

  if (typeof payload.email !== 'string' || typeof payload.lead_id !== 'number') return null;

  return { email: payload.email, lead_id: payload.lead_id };
}
