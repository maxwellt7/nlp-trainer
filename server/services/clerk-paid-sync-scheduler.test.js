import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_INTERVAL_MIN,
  intervalToCron,
} from './clerk-paid-sync-scheduler.js';

test('DEFAULT_INTERVAL_MIN is 10 — fast enough to feel near-instant after purchase, gentle on Clerk rate limits', () => {
  // Belt-and-suspenders for the Stripe webhook. If the webhook drops a
  // delivery (network blip, Stripe retry exhaustion), the cron is the
  // backstop so the customer still gets emailed within ~10 minutes.
  assert.equal(DEFAULT_INTERVAL_MIN, 10);
});

test('intervalToCron with no override produces a 10-minute cron expression', () => {
  assert.equal(intervalToCron(undefined), '*/10 * * * *');
  assert.equal(intervalToCron(null), '*/10 * * * *');
});

test('intervalToCron clamps to the [5, 720] window', () => {
  assert.equal(intervalToCron(1), '*/5 * * * *');
  assert.equal(intervalToCron(15), '*/15 * * * *');
  assert.equal(intervalToCron(60), '0 * * * *');
  assert.equal(intervalToCron(120), '0 */2 * * *');
  assert.equal(intervalToCron(10_000), '0 */12 * * *');
});
