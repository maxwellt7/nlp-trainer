import test from 'node:test';
import assert from 'node:assert/strict';
import { recentUserQuery } from './retrieval-query.js';

test('recentUserQuery joins the last N user turns in chronological order', () => {
  const q = recentUserQuery([
    { role: 'user', content: 'first' },
    { role: 'assistant', content: 'ok' },
    { role: 'user', content: 'second' },
    { role: 'assistant', content: 'got it' },
    { role: 'user', content: 'third' },
  ], { maxTurns: 2 });
  assert.equal(q, 'second\nthird');
});

test('recentUserQuery skips blank and non-user messages', () => {
  const q = recentUserQuery([
    { role: 'user', content: '   ' },
    { role: 'system', content: 'ignore' },
    { role: 'user', content: 'alive' },
  ]);
  assert.equal(q, 'alive');
});

test('recentUserQuery keeps the most recent tail when over maxChars', () => {
  const q = recentUserQuery([
    { role: 'user', content: 'abcdefghij' },
    { role: 'user', content: 'xyz' },
  ], { maxTurns: 2, maxChars: 6 });
  assert.equal(q, 'ij\nxyz');
});

test('recentUserQuery returns empty for missing or empty input', () => {
  assert.equal(recentUserQuery(null), '');
  assert.equal(recentUserQuery([]), '');
  assert.equal(recentUserQuery([{ role: 'assistant', content: 'hi' }]), '');
});
