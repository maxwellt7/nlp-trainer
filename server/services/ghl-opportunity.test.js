import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureOpportunityForContact } from './ghl-opportunity.js';

function makeDeps({ findResults = [[]], createResult = { id: 'created-opp' }, updateResult = { ok: true } } = {}) {
  let findIdx = 0;
  const calls = { find: 0, create: 0, update: 0 };
  return {
    calls,
    deps: {
      find: async () => {
        calls.find += 1;
        const r = findResults[findIdx] ?? findResults[findResults.length - 1];
        findIdx += 1;
        return r;
      },
      create: async () => {
        calls.create += 1;
        return typeof createResult === 'function' ? createResult() : createResult;
      },
      update: async (id, opts) => {
        calls.update += 1;
        return typeof updateResult === 'function' ? updateResult(id, opts) : { id, ...opts };
      },
    },
  };
}

test('ensureOpportunityForContact updates the existing opportunity when one is found', async () => {
  const { deps, calls } = makeDeps({ findResults: [[{ id: 'opp-1' }]] });
  const result = await ensureOpportunityForContact('contact-A', { stageId: 'stage-X', monetaryValue: 19 }, deps);
  assert.equal(result.id, 'opp-1');
  assert.equal(calls.create, 0, 'create must NOT be called when an opp already exists');
  assert.equal(calls.update, 1);
});

test('ensureOpportunityForContact creates a new opportunity when none is found', async () => {
  const { deps, calls } = makeDeps({ findResults: [[]], createResult: { id: 'new-opp' } });
  const result = await ensureOpportunityForContact('contact-A', { stageId: 'stage-X' }, deps);
  assert.equal(result.id, 'new-opp');
  assert.equal(calls.create, 1);
  assert.equal(calls.update, 0);
});

test('ensureOpportunityForContact recovers from GHL "duplicate" by re-finding and updating', async () => {
  // Reproduces the Railway-log bug: first find returns empty (filter race or
  // pipeline-scoped search misses an opp that exists in a sibling pipeline),
  // GHL then rejects create with a duplicate-contact error (surfaced as
  // null/undefined from ghlFetch). The recovery path re-finds and updates,
  // so the webhook doesn't log a scary error nor leave the contact stale.
  const { deps, calls } = makeDeps({
    findResults: [[], [{ id: 'opp-recovered' }]],
    createResult: null,
  });
  const result = await ensureOpportunityForContact('contact-A', { stageId: 'stage-X' }, deps);
  assert.equal(result.id, 'opp-recovered');
  assert.equal(calls.find, 2, 'must re-find after create fails');
  assert.equal(calls.update, 1, 'must update the recovered opp');
});

test('ensureOpportunityForContact returns null when neither create nor recovery succeeds', async () => {
  const { deps, calls } = makeDeps({
    findResults: [[], []],
    createResult: null,
  });
  const result = await ensureOpportunityForContact('contact-A', { stageId: 'stage-X' }, deps);
  assert.equal(result, null);
  assert.equal(calls.find, 2);
  assert.equal(calls.create, 1);
  assert.equal(calls.update, 0);
});

test('ensureOpportunityForContact treats find errors (null return) the same as empty', async () => {
  // If find throws or returns a non-array, callers expect graceful degradation.
  const { deps } = makeDeps({ findResults: [null, [{ id: 'opp-on-retry' }]], createResult: null });
  const result = await ensureOpportunityForContact('contact-A', { stageId: 'stage-X' }, deps);
  assert.equal(result.id, 'opp-on-retry');
});
