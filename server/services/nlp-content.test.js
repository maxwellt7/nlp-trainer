import test from 'node:test';
import assert from 'node:assert/strict';
import { jsonToMarkdown, loadNlpFiles, renderNlpDigest } from './nlp-content.js';

test('jsonToMarkdown trims long primitive arrays to maxArrayItems with a (+N more) marker', () => {
  const md = jsonToMarkdown({ examples: ['a', 'b', 'c', 'd', 'e'] }, { maxArrayItems: 2 });
  assert.match(md, /a; b/);
  assert.match(md, /\(\+3 more\)/);
  assert.ok(!md.includes('d'), 'should not include trimmed items');
});

test('jsonToMarkdown renders nested objects as labelled markdown, not JSON', () => {
  const md = jsonToMarkdown({ pattern: { name: 'Mind Reading', definition: 'claims to know thoughts' } });
  assert.match(md, /\*\*Name:\*\* Mind Reading/);
  assert.match(md, /\*\*Definition:\*\* claims to know thoughts/);
  assert.ok(!md.includes('{'), 'should not contain raw JSON braces');
});

test('renderNlpDigest is substantially smaller than the raw JSON dump but keeps technique names', () => {
  const files = loadNlpFiles();
  assert.ok(files.length >= 5, 'expected the curated NLP corpus to load');
  const nlpContent = Object.fromEntries(files.map((f) => [f.name, f.data]));
  const raw = JSON.stringify(nlpContent, null, 2);
  const digest = renderNlpDigest(nlpContent, { maxArrayItems: 3 });

  assert.ok(digest.length < raw.length * 0.5, 'digest should be <50% the size of the raw dump');
  // Knowledge preserved: a few signature techniques survive condensation.
  for (const term of ['Mind Reading', 'Embedded Commands', 'Cartesian']) {
    assert.ok(digest.includes(term), `digest should still mention "${term}"`);
  }
});
