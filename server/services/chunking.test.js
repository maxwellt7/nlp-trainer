import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkDocument } from './chunking.js';

test('chunkDocument returns empty array for empty/whitespace input', () => {
  assert.deepEqual(chunkDocument(''), []);
  assert.deepEqual(chunkDocument('   \n\n  '), []);
});

test('chunkDocument keeps small documents as a single chunk', () => {
  const text = 'A short paragraph.\n\nAnother short one.';
  const chunks = chunkDocument(text);
  assert.equal(chunks.length, 1);
  assert.match(chunks[0].text, /A short paragraph/);
  assert.match(chunks[0].text, /Another short one/);
  assert.equal(chunks[0].chunkIndex, 0);
});

test('chunkDocument splits when paragraphs would exceed targetChars', () => {
  const para1 = 'a'.repeat(1500);
  const para2 = 'b'.repeat(1500);
  const text = `${para1}\n\n${para2}`;
  const chunks = chunkDocument(text, { targetChars: 1600, overlapChars: 0 });
  assert.equal(chunks.length, 2);
  assert.ok(chunks[0].text.startsWith('a'));
  assert.ok(chunks[1].text.startsWith('b'));
});

test('chunkDocument breaks oversized paragraphs by sentence', () => {
  const sentence = 'This is a sentence. ';
  const para = sentence.repeat(200); // ~4000 chars
  const chunks = chunkDocument(para, { targetChars: 800, overlapChars: 0 });
  assert.ok(chunks.length >= 4);
  for (const c of chunks) {
    assert.ok(c.text.length <= 1200, `chunk ${c.chunkIndex} too big: ${c.text.length}`);
  }
});

test('chunkDocument applies overlap between chunks (text from prev chunk reappears in next)', () => {
  const para1 = 'The first paragraph contains a very specific marker UNIQUE_ALPHA at the end.';
  const para2 = 'The second paragraph contains another unique phrase UNIQUE_BETA somewhere.';
  const para3 = 'The third paragraph completes the document with UNIQUE_GAMMA.';
  const text = `${para1.repeat(40)}\n\n${para2.repeat(40)}\n\n${para3.repeat(40)}`;
  const chunks = chunkDocument(text, { targetChars: 2000, overlapChars: 200 });
  assert.ok(chunks.length >= 2);
  // Second chunk should have some content from first chunk's tail.
  assert.match(chunks[1].text, /UNIQUE_(ALPHA|BETA|GAMMA)/);
});

test('chunkDocument preserves chunkIndex monotonically', () => {
  const text = 'Para one.\n\n' + 'x'.repeat(2500) + '\n\n' + 'Para three.';
  const chunks = chunkDocument(text, { targetChars: 1000, overlapChars: 50 });
  for (let i = 0; i < chunks.length; i += 1) {
    assert.equal(chunks[i].chunkIndex, i);
  }
});

test('chunkDocument hard-splits sentences that exceed HARD_MAX_CHARS', () => {
  const giant = 'word '.repeat(2000); // ~10000 chars, no sentence boundaries
  const chunks = chunkDocument(giant, { targetChars: 2000, overlapChars: 0 });
  assert.ok(chunks.length >= 2);
});
