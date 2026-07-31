import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceToFilename, dedupeSources, isBelowRelevanceFloor, dedupeChunks } from './ask.js';

test('sourceToFilename strips the dropbox prefix and returns the basename', () => {
  assert.equal(sourceToFilename('dropbox:/01. Professional/AI Tools/foo.pdf'), 'foo.pdf');
  assert.equal(sourceToFilename('dropbox:/nested/path/a b c.md'), 'a b c.md');
  assert.equal(sourceToFilename('bare.txt'), 'bare.txt');
  assert.equal(sourceToFilename(''), '');
  assert.equal(sourceToFilename(null), '');
});

test('dedupeSources keeps the highest score per file, sorted desc, capped at 5', () => {
  const chunks = [
    { source: 'dropbox:/x/a.pdf', score: 0.4 },
    { source: 'dropbox:/x/a.pdf', score: 0.9 }, // same file, higher
    { source: 'dropbox:/x/b.pdf', score: 0.6 },
    { source: 'dropbox:/x/c.pdf', score: 0.1 },
    { source: 'dropbox:/x/d.pdf', score: 0.2 },
    { source: 'dropbox:/x/e.pdf', score: 0.3 },
    { source: 'dropbox:/x/f.pdf', score: 0.35 },
  ];
  const out = dedupeSources(chunks);
  assert.equal(out.length, 5);
  assert.deepEqual(out[0], { filename: 'a.pdf', score: 0.9 });
  assert.deepEqual(out[1], { filename: 'b.pdf', score: 0.6 });
  assert.ok(out.every((s, i) => i === 0 || out[i - 1].score >= s.score));
});

test('dedupeSources tolerates empty/missing sources', () => {
  assert.deepEqual(dedupeSources([]), []);
  assert.deepEqual(dedupeSources([{ source: '', score: 0.9 }]), []);
});

test('isBelowRelevanceFloor is true when empty or top score below the floor', () => {
  assert.equal(isBelowRelevanceFloor([], 0.15), true);
  assert.equal(isBelowRelevanceFloor([{ score: 0.1 }], 0.15), true);
  assert.equal(isBelowRelevanceFloor([{ score: 0.2 }, { score: 0.9 }], 0.15), false);
});

test('dedupeSources collapses Dropbox " (N)" duplicate-copy families to one clean name', () => {
  const chunks = [
    { source: 'dropbox:/x/Mastering Influence Transcript.txt', score: 0.41 },
    { source: 'dropbox:/x/Mastering Influence Transcript (3).txt', score: 0.41 },
    { source: 'dropbox:/x/Mastering Influence Transcript (1).txt', score: 0.30 },
    { source: 'dropbox:/x/Other.pdf', score: 0.25 },
  ];
  const out = dedupeSources(chunks);
  assert.deepEqual(out, [
    { filename: 'Mastering Influence Transcript.txt', score: 0.41 },
    { filename: 'Other.pdf', score: 0.25 },
  ]);
});

test('dedupeChunks drops chunks with identical text, preserving order', () => {
  const chunks = [
    { source: 'a.txt', text: 'clarity without control', score: 0.4 },
    { source: 'a (3).txt', text: 'clarity without control', score: 0.4 }, // dup text
    { source: 'b.txt', text: 'no codependency', score: 0.3 },
    { source: 'c.txt', text: '   ', score: 0.2 }, // blank -> dropped
  ];
  const out = dedupeChunks(chunks);
  assert.equal(out.length, 2);
  assert.equal(out[0].text, 'clarity without control');
  assert.equal(out[1].text, 'no codependency');
});
