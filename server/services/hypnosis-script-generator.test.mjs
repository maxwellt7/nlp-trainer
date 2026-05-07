import test from 'node:test';
import assert from 'node:assert/strict';
import { generateChunkedScript, SEGMENT_PLAN } from './hypnosis-script-generator.js';

const trivialParseJson = (text) => JSON.parse(text);

function makeMockLlm(perCallResponses) {
  const calls = [];
  let i = 0;
  return {
    calls,
    fn: async (payload) => {
      calls.push(payload);
      const next = perCallResponses[i] ?? perCallResponses[perCallResponses.length - 1];
      i += 1;
      return { content: [{ text: typeof next === 'string' ? next : JSON.stringify(next) }] };
    },
  };
}

test('generateChunkedScript runs SEGMENT_PLAN.length sequential calls and stitches output', async () => {
  const mock = makeMockLlm([
    { title: 'Returning to Yourself', sessionSummary: 'A summary.', keyThemes: ['safety', 'agency'], script: 'SEG1_TEXT' },
    { script: 'SEG2_TEXT' },
    { script: 'SEG3_TEXT' },
    { script: 'SEG4_TEXT' },
  ]);

  const result = await generateChunkedScript({
    systemPrompt: 'system goes here',
    apiMessages: [{ role: 'user', content: 'I was anxious all day.' }],
    llm: mock.fn,
    parseJson: trivialParseJson,
  });

  assert.equal(mock.calls.length, SEGMENT_PLAN.length);
  assert.equal(result.title, 'Returning to Yourself');
  assert.equal(result.sessionSummary, 'A summary.');
  assert.deepEqual(result.keyThemes, ['safety', 'agency']);
  assert.deepEqual(result.segments, ['SEG1_TEXT', 'SEG2_TEXT', 'SEG3_TEXT', 'SEG4_TEXT']);
  assert.equal(result.script, 'SEG1_TEXT\n\nSEG2_TEXT\n\nSEG3_TEXT\n\nSEG4_TEXT');
  assert.equal(result.estimatedMinutes, SEGMENT_PLAN.reduce((s, p) => s + p.targetMinutes, 0));
});

test('generateChunkedScript passes previous segments into each subsequent call for continuity', async () => {
  const mock = makeMockLlm([
    { title: 't', sessionSummary: 's', keyThemes: [], script: 'AAA' },
    { script: 'BBB' },
    { script: 'CCC' },
    { script: 'DDD' },
  ]);

  await generateChunkedScript({
    systemPrompt: 'sys',
    apiMessages: [{ role: 'user', content: 'I need help.' }],
    llm: mock.fn,
    parseJson: trivialParseJson,
  });

  // Call 2's instruction should include AAA in the prev context, but NOT BBB/CCC/DDD.
  const call2Inst = mock.calls[1].messages.at(-1).content;
  assert.match(call2Inst, /AAA/);
  assert.doesNotMatch(call2Inst, /BBB/);

  // Call 4's instruction should include AAA, BBB, CCC, but NOT DDD.
  const call4Inst = mock.calls[3].messages.at(-1).content;
  assert.match(call4Inst, /AAA/);
  assert.match(call4Inst, /BBB/);
  assert.match(call4Inst, /CCC/);
  assert.doesNotMatch(call4Inst, /DDD/);
});

test('generateChunkedScript falls back to raw text if a segment returns invalid JSON', async () => {
  // First call valid (so we get metadata), second call returns malformed JSON.
  const mock = makeMockLlm([
    { title: 't', sessionSummary: 's', keyThemes: ['x'], script: 'first' },
    'not json at all but here is some script text',
    { script: 'third' },
    { script: 'fourth' },
  ]);

  const result = await generateChunkedScript({
    systemPrompt: 'sys',
    apiMessages: [{ role: 'user', content: 'help' }],
    llm: mock.fn,
    parseJson: trivialParseJson,
  });

  assert.equal(result.segments[1], 'not json at all but here is some script text');
  assert.equal(result.title, 't');
});

test('generateChunkedScript throws if any segment is empty (script generation must fail loud)', async () => {
  const mock = makeMockLlm([
    { title: 't', sessionSummary: 's', keyThemes: [], script: 'first' },
    { script: '' },
    { script: 'third' },
    { script: 'fourth' },
  ]);

  await assert.rejects(
    () => generateChunkedScript({
      systemPrompt: 'sys',
      apiMessages: [{ role: 'user', content: 'help' }],
      llm: mock.fn,
      parseJson: trivialParseJson,
    }),
    /segment 2.*empty/i,
  );
});

test('generateChunkedScript only the FIRST segment is asked for metadata', async () => {
  const mock = makeMockLlm([
    { title: 't', sessionSummary: 's', keyThemes: [], script: 'a' },
    { script: 'b' },
    { script: 'c' },
    { script: 'd' },
  ]);

  await generateChunkedScript({
    systemPrompt: 'sys',
    apiMessages: [{ role: 'user', content: 'help' }],
    llm: mock.fn,
    parseJson: trivialParseJson,
  });

  // First call's instruction should request title/sessionSummary/keyThemes; later calls should not.
  assert.match(mock.calls[0].messages.at(-1).content, /title/);
  assert.match(mock.calls[0].messages.at(-1).content, /sessionSummary/);
  for (const idx of [1, 2, 3]) {
    assert.doesNotMatch(mock.calls[idx].messages.at(-1).content, /sessionSummary/);
  }
});
