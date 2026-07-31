import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceToFilename, dedupeSources, isBelowRelevanceFloor } from './ask.js';

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
