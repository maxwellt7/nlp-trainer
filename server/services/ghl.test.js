/**
 * Tests for ghl.js — Align funnel extensions (Task A.5)
 *
 * Strategy:
 *   - `buildFunnelTags` and `buildFunnelCustomFields` are pure functions; tested directly.
 *   - `handleQuizLead` uses `globalThis.fetch` (Node built-in) and checks GHL_API_KEY.
 *     Because ghl.js reads env vars at CALL TIME (not module-load time), we can set env
 *     vars in each test and the functions will pick them up immediately — no cache-busting
 *     or dynamic import needed.
 *
 * Run:
 *   node --test server/services/ghl.test.js
 *   (from the nlp-trainer root, or: node --test from server/ with absolute path)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ── Pure helper tests (no HTTP) ─────────────────────────────────────────────

import { buildFunnelTags, buildFunnelCustomFields, handleQuizLead } from './ghl.js';

// ── buildFunnelTags ──────────────────────────────────────────────────────────

test('buildFunnelTags — returns empty array when result_program is absent (legacy caller)', () => {
  assert.deepEqual(buildFunnelTags({}), []);
  assert.deepEqual(buildFunnelTags({ depth_band: 'surface' }), []);
  assert.deepEqual(buildFunnelTags(), []);
});

test('buildFunnelTags — includes funnel:align + program tag when result_program is present', () => {
  const tags = buildFunnelTags({ result_program: 'over-preparer', depth_band: 'established' });
  assert.ok(tags.includes('funnel:align'), 'should include funnel:align');
  assert.ok(tags.includes('program:over-preparer'), 'should include program:over-preparer');
  assert.ok(tags.includes('depth:established'), 'should include depth:established');
});

test('buildFunnelTags — result_program=loop, depth_band=surface', () => {
  const tags = buildFunnelTags({ result_program: 'loop', depth_band: 'surface' });
  assert.ok(tags.includes('funnel:align'));
  assert.ok(tags.includes('program:loop'));
  assert.ok(tags.includes('depth:surface'));
  assert.equal(tags.length, 3);
});

test('buildFunnelTags — no depth tag when depth_band is absent', () => {
  const tags = buildFunnelTags({ result_program: 'self-censor' });
  assert.ok(tags.includes('funnel:align'));
  assert.ok(tags.includes('program:self-censor'));
  assert.ok(!tags.some(t => t.startsWith('depth:')), 'no depth tag expected');
  assert.equal(tags.length, 2);
});

test('buildFunnelTags — all four programs produce distinct program tags', () => {
  const programs = ['over-preparer', 'self-censor', 'invisible-ceiling', 'loop'];
  const seen = new Set();
  for (const p of programs) {
    const tags = buildFunnelTags({ result_program: p });
    const programTag = tags.find(t => t.startsWith('program:'));
    assert.ok(programTag, `expected program tag for ${p}`);
    assert.ok(!seen.has(programTag), `program tag should be unique: ${programTag}`);
    seen.add(programTag);
  }
});

test('buildFunnelTags — all three depth bands produce distinct depth tags', () => {
  const bands = ['surface', 'established', 'deep-rooted'];
  const seen = new Set();
  for (const band of bands) {
    const tags = buildFunnelTags({ result_program: 'loop', depth_band: band });
    const depthTag = tags.find(t => t.startsWith('depth:'));
    assert.ok(depthTag, `expected depth tag for ${band}`);
    assert.ok(!seen.has(depthTag), `depth tag should be unique: ${depthTag}`);
    seen.add(depthTag);
  }
});

// Issue 2: toLowerCase normalization
test('buildFunnelTags — normalises mixed-case result_program and depth_band to lowercase', () => {
  const tags = buildFunnelTags({ result_program: 'Over-Preparer', depth_band: 'Established' });
  assert.ok(tags.includes('program:over-preparer'), 'program tag must be lowercase');
  assert.ok(tags.includes('depth:established'), 'depth tag must be lowercase');
  assert.ok(!tags.includes('program:Over-Preparer'), 'mixed-case program tag must not appear');
  assert.ok(!tags.includes('depth:Established'), 'mixed-case depth tag must not appear');
});

// ── buildFunnelCustomFields ──────────────────────────────────────────────────

test('buildFunnelCustomFields — returns null when both fields are absent', () => {
  assert.equal(buildFunnelCustomFields({}), null);
  assert.equal(buildFunnelCustomFields(), null);
});

test('buildFunnelCustomFields — includes q9_fear as string when present', () => {
  const cf = buildFunnelCustomFields({ q9_fear: 'That nothing will change' });
  assert.ok(cf !== null);
  assert.equal(cf.q9_fear, 'That nothing will change');
  assert.ok(!('pattern_scores' in cf));
});

test('buildFunnelCustomFields — JSON-stringifies pattern_scores object', () => {
  const scores = { A: 5, B: 2, C: 0, D: 0 };
  const cf = buildFunnelCustomFields({ pattern_scores: scores });
  assert.ok(cf !== null);
  assert.equal(cf.pattern_scores, JSON.stringify(scores));
  assert.ok(!('q9_fear' in cf));
});

test('buildFunnelCustomFields — passes through pattern_scores when already a string', () => {
  const cf = buildFunnelCustomFields({ pattern_scores: '{"A":5,"B":2}' });
  assert.ok(cf !== null);
  assert.equal(cf.pattern_scores, '{"A":5,"B":2}');
});

test('buildFunnelCustomFields — includes both fields when both are present', () => {
  const cf = buildFunnelCustomFields({
    q9_fear: 'Fear text',
    pattern_scores: { A: 3, B: 1, C: 2, D: 1 },
  });
  assert.ok(cf !== null);
  assert.equal(cf.q9_fear, 'Fear text');
  assert.equal(cf.pattern_scores, JSON.stringify({ A: 3, B: 1, C: 2, D: 1 }));
});

// ── handleQuizLead integration-style tests ──────────────────────────────────
//
// ghl.js reads GHL_API_KEY, GHL_LOCATION_ID, GHL_CF_Q9_FEAR, GHL_CF_PATTERN_SCORES
// at CALL TIME (not at module load), so we can set env vars here and they take effect
// immediately in all subsequent calls.

// Convenience: build a minimal fetch stub that records calls and returns canned responses.
function makeFetchStub(contactId = 'cid-test') {
  const calls = [];
  const stub = async (url, opts) => {
    calls.push({ url, opts });
    const method = opts?.method || 'GET';

    // findContactByEmail — GET search (returns no existing contact → force create path)
    if (url.includes('/contacts/?locationId') && method === 'GET') {
      return { ok: true, json: async () => ({ contacts: [] }) };
    }
    // upsertContact POST (create)
    if (url.endsWith('/contacts/') && method === 'POST') {
      const body = opts?.body ? JSON.parse(opts.body) : {};
      return { ok: true, json: async () => ({ contact: { id: contactId, ...body } }) };
    }
    // addTags POST
    if (url.includes('/tags') && method === 'POST') {
      return { ok: true, json: async () => ({}) };
    }
    // createOpportunity POST
    if (url.includes('/opportunities/') && method === 'POST') {
      return { ok: true, json: async () => ({ opportunity: { id: 'opp-1' } }) };
    }
    return { ok: true, json: async () => ({}) };
  };
  stub.calls = calls;
  return stub;
}

test('handleQuizLead — returns null when GHL is not configured (no API key)', async () => {
  // Ensure GHL_API_KEY is absent for this test.
  const saved = process.env.GHL_API_KEY;
  delete process.env.GHL_API_KEY;

  const result = await handleQuizLead({
    email: 'test@example.com',
    name: 'Test User',
    score: 7,
    tier: 'aligned',
    answers: {},
    result_program: 'over-preparer',
    depth_band: 'established',
    q9_fear: 'Fear text',
    pattern_scores: { A: 5, B: 2, C: 0, D: 0 },
  });
  assert.equal(result, null);

  process.env.GHL_API_KEY = saved || 'test-fake-key';
});

// Issue 1: empty-string custom field ID is silently dropped.
test('handleQuizLead — unset GHL_CF_Q9_FEAR env var: q9_fear dropped, pattern_scores included, contact created OK', async () => {
  process.env.GHL_API_KEY = 'test-fake-key';
  process.env.GHL_LOCATION_ID = 'test-loc-id';
  // q9_fear ID intentionally absent (simulates unset env var)
  delete process.env.GHL_CF_Q9_FEAR;
  // pattern_scores has a real ID
  process.env.GHL_CF_PATTERN_SCORES = 'cf-pattern-scores-id';

  const stub = makeFetchStub('cid-issue1');
  const origFetch = globalThis.fetch;
  globalThis.fetch = stub;

  try {
    const result = await handleQuizLead({
      email: 'issue1@example.com',
      name: 'Issue One',
      score: 8,
      tier: 'over-preparer',
      answers: {},
      q9_fear: 'Staying stuck forever',
      pattern_scores: { A: 5, B: 2, C: 0, D: 0 },
    });

    // Contact creation must succeed (not null)
    assert.ok(result !== null, 'contact creation should succeed even with one missing CF id');
    assert.equal(result.id, 'cid-issue1');

    // Find the POST /contacts/ call
    const createCall = stub.calls.find(
      c => c.url.endsWith('/contacts/') && c.opts?.method === 'POST'
    );
    assert.ok(createCall, 'expected a POST /contacts/ call');

    const body = JSON.parse(createCall.opts.body);
    const cfIds = body.customFields.map(cf => cf.id);

    // pattern_scores should be present (has a real ID)
    assert.ok(cfIds.includes('cf-pattern-scores-id'), 'pattern_scores CF should be included');

    // q9_fear should be absent (empty string ID silently dropped, not sent as `{ id: '' }`)
    assert.ok(!cfIds.includes(''), 'no empty-string id should appear in customFields');
    const q9FearEntry = body.customFields.find(cf => cf.id === '');
    assert.equal(q9FearEntry, undefined, 'q9_fear entry with empty id must not be present');
  } finally {
    globalThis.fetch = origFetch;
    delete process.env.GHL_CF_PATTERN_SCORES;
  }
});

// Issue 3: four integration scenarios that actually call handleQuizLead end-to-end.

test('fetch-stub integration: legacy caller — no funnel tags, no funnel custom fields sent to GHL', async () => {
  process.env.GHL_API_KEY = 'test-fake-key';
  process.env.GHL_LOCATION_ID = 'test-loc-id';
  delete process.env.GHL_CF_Q9_FEAR;
  delete process.env.GHL_CF_PATTERN_SCORES;

  const stub = makeFetchStub('cid-legacy');
  const origFetch = globalThis.fetch;
  globalThis.fetch = stub;

  try {
    const result = await handleQuizLead({
      email: 'legacy@example.com',
      name: 'Legacy User',
      score: 5,
      tier: 'aligned',
      answers: {},
      // No result_program / depth_band / q9_fear / pattern_scores
    });

    assert.ok(result !== null, 'legacy call must succeed');

    const createCall = stub.calls.find(
      c => c.url.endsWith('/contacts/') && c.opts?.method === 'POST'
    );
    assert.ok(createCall, 'expected POST /contacts/');
    const body = JSON.parse(createCall.opts.body);

    // Tags must NOT include funnel:align
    assert.ok(!body.tags.includes('funnel:align'), 'legacy caller must not get funnel:align tag');

    // addTags calls — none should mention funnel tags
    const tagCalls = stub.calls.filter(
      c => c.url.includes('/tags') && c.opts?.method === 'POST'
    );
    for (const tc of tagCalls) {
      const tagBody = JSON.parse(tc.opts.body);
      assert.ok(
        !tagBody.tags.some(t => t.startsWith('program:') || t.startsWith('depth:')),
        'legacy caller must not get program: or depth: tags'
      );
    }
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('fetch-stub integration: funnel caller — over-preparer / established tags + q9_fear + pattern_scores sent to GHL', async () => {
  process.env.GHL_API_KEY = 'test-fake-key';
  process.env.GHL_LOCATION_ID = 'test-loc-id';
  process.env.GHL_CF_Q9_FEAR = 'cf-q9-fear-id';
  process.env.GHL_CF_PATTERN_SCORES = 'cf-pattern-scores-id';

  const stub = makeFetchStub('cid-funnel-op');
  const origFetch = globalThis.fetch;
  globalThis.fetch = stub;

  try {
    const result = await handleQuizLead({
      email: 'funnel@example.com',
      name: 'Funnel User',
      score: 9,
      tier: 'over-preparer',
      answers: {},
      result_program: 'over-preparer',
      depth_band: 'established',
      q9_fear: 'That I will stay stuck',
      pattern_scores: { A: 5, B: 2, C: 0, D: 0 },
    });

    assert.ok(result !== null, 'funnel call must succeed');

    // Verify POST /contacts/ body contains expected customFields
    const createCall = stub.calls.find(
      c => c.url.endsWith('/contacts/') && c.opts?.method === 'POST'
    );
    assert.ok(createCall, 'expected POST /contacts/');
    const body = JSON.parse(createCall.opts.body);
    const cfIds = body.customFields.map(cf => cf.id);
    assert.ok(cfIds.includes('cf-q9-fear-id'), 'q9_fear CF must be present');
    assert.ok(cfIds.includes('cf-pattern-scores-id'), 'pattern_scores CF must be present');

    // Verify funnel tags were added via addTags
    const tagCalls = stub.calls.filter(
      c => c.url.includes('/tags') && c.opts?.method === 'POST'
    );
    const allAddedTags = tagCalls.flatMap(tc => JSON.parse(tc.opts.body).tags);
    assert.ok(allAddedTags.includes('funnel:align'), 'funnel:align must be added');
    assert.ok(allAddedTags.includes('program:over-preparer'), 'program:over-preparer must be added');
    assert.ok(allAddedTags.includes('depth:established'), 'depth:established must be added');
  } finally {
    globalThis.fetch = origFetch;
    delete process.env.GHL_CF_Q9_FEAR;
    delete process.env.GHL_CF_PATTERN_SCORES;
  }
});

test('fetch-stub integration: funnel caller — loop / surface tags sent to GHL', async () => {
  process.env.GHL_API_KEY = 'test-fake-key';
  process.env.GHL_LOCATION_ID = 'test-loc-id';
  delete process.env.GHL_CF_Q9_FEAR;
  delete process.env.GHL_CF_PATTERN_SCORES;

  const stub = makeFetchStub('cid-loop');
  const origFetch = globalThis.fetch;
  globalThis.fetch = stub;

  try {
    const result = await handleQuizLead({
      email: 'loop@example.com',
      name: 'Loop User',
      score: 6,
      tier: 'loop',
      answers: {},
      result_program: 'loop',
      depth_band: 'surface',
    });

    assert.ok(result !== null, 'loop/surface call must succeed');

    const tagCalls = stub.calls.filter(
      c => c.url.includes('/tags') && c.opts?.method === 'POST'
    );
    const allAddedTags = tagCalls.flatMap(tc => JSON.parse(tc.opts.body).tags);
    assert.ok(allAddedTags.includes('funnel:align'), 'funnel:align must be added');
    assert.ok(allAddedTags.includes('program:loop'), 'program:loop must be added');
    assert.ok(allAddedTags.includes('depth:surface'), 'depth:surface must be added');
    assert.ok(!allAddedTags.includes('program:over-preparer'), 'over-preparer tag must not appear');
    assert.ok(!allAddedTags.includes('depth:established'), 'established tag must not appear');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('fetch-stub integration: partial funnel caller — only result_program, no depth/q9_fear/pattern_scores sent to GHL', async () => {
  process.env.GHL_API_KEY = 'test-fake-key';
  process.env.GHL_LOCATION_ID = 'test-loc-id';
  delete process.env.GHL_CF_Q9_FEAR;
  delete process.env.GHL_CF_PATTERN_SCORES;

  const stub = makeFetchStub('cid-partial');
  const origFetch = globalThis.fetch;
  globalThis.fetch = stub;

  try {
    const result = await handleQuizLead({
      email: 'partial@example.com',
      name: 'Partial User',
      score: 7,
      tier: 'self-censor',
      answers: {},
      result_program: 'self-censor',
      // no depth_band, no q9_fear, no pattern_scores
    });

    assert.ok(result !== null, 'partial funnel call must succeed');

    const tagCalls = stub.calls.filter(
      c => c.url.includes('/tags') && c.opts?.method === 'POST'
    );
    const allAddedTags = tagCalls.flatMap(tc => JSON.parse(tc.opts.body).tags);
    assert.ok(allAddedTags.includes('funnel:align'), 'funnel:align must be added');
    assert.ok(allAddedTags.includes('program:self-censor'), 'program:self-censor must be added');
    assert.ok(!allAddedTags.some(t => t.startsWith('depth:')), 'no depth tag should be added');

    // Verify no empty-id CFs were sent
    const createCall = stub.calls.find(
      c => c.url.endsWith('/contacts/') && c.opts?.method === 'POST'
    );
    const body = JSON.parse(createCall.opts.body);
    const cfIds = body.customFields.map(cf => cf.id);
    assert.ok(!cfIds.includes(''), 'no empty-string CF ids in partial funnel call');
  } finally {
    globalThis.fetch = origFetch;
  }
});
