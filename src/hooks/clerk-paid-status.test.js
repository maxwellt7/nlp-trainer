import test from 'node:test';
import assert from 'node:assert/strict';
import { derivePaidPlanFromClerk } from './clerk-paid-status.js';

test('returns the plan string when public_metadata.plan is a meaningful paid plan', () => {
  // De'Yona's actual public_metadata shape — copied verbatim from her
  // Clerk record. This is the dispute that prompted the fix.
  const user = {
    publicMetadata: {
      plan: 'alignment_engine',
      purchased_at: '2026-05-30T00:59:52.019Z',
      stripe_session_id: 'cs_live_b1txDOe6lr9LM92uMtCFBT3AiTRCRDxyvMGTsY7YGwpH9Qa7xtLp9OosXA',
    },
  };
  assert.equal(derivePaidPlanFromClerk(user), 'alignment_engine');
});

test('returns null when plan is missing, empty, or marks the user as unpaid', () => {
  assert.equal(derivePaidPlanFromClerk(null), null);
  assert.equal(derivePaidPlanFromClerk({}), null);
  assert.equal(derivePaidPlanFromClerk({ publicMetadata: {} }), null);
  assert.equal(derivePaidPlanFromClerk({ publicMetadata: { plan: '' } }), null);
  assert.equal(derivePaidPlanFromClerk({ publicMetadata: { plan: '   ' } }), null);
  assert.equal(derivePaidPlanFromClerk({ publicMetadata: { plan: 'unpaid' } }), null);
  assert.equal(derivePaidPlanFromClerk({ publicMetadata: { plan: 'Free' } }), null);
});

test('returns null when plan is not a string (defensive against weird metadata writes)', () => {
  assert.equal(derivePaidPlanFromClerk({ publicMetadata: { plan: 1 } }), null);
  assert.equal(derivePaidPlanFromClerk({ publicMetadata: { plan: true } }), null);
  assert.equal(derivePaidPlanFromClerk({ publicMetadata: { plan: { tier: 'pro' } } }), null);
});

test('accepts both camelCase publicMetadata and snake_case public_metadata', () => {
  // Clerk's frontend SDK exposes camelCase; the Backend API JSON uses
  // snake_case (which is what De'Yona's record looks like above). The
  // helper has to read both so it works regardless of where the user
  // object came from.
  assert.equal(
    derivePaidPlanFromClerk({ public_metadata: { plan: 'alignment_engine' } }),
    'alignment_engine',
  );
});
