import test from 'node:test';
import assert from 'node:assert/strict';
import { safeJsonParse } from './safe-json.js';

test('safeJsonParse returns the parsed value for valid JSON', () => {
  assert.deepEqual(safeJsonParse('[1,2,3]', []), [1, 2, 3]);
  assert.deepEqual(safeJsonParse('{"a":1}', {}), { a: 1 });
  assert.equal(safeJsonParse('"hello"', null), 'hello');
});

test('safeJsonParse returns the fallback for malformed JSON', () => {
  assert.deepEqual(safeJsonParse('[1,2,', []), []);
  assert.deepEqual(safeJsonParse('{not json', {}), {});
  assert.equal(safeJsonParse(']]', 'default'), 'default');
});

test('safeJsonParse returns the fallback for nullish / empty input', () => {
  assert.deepEqual(safeJsonParse(null, []), []);
  assert.deepEqual(safeJsonParse(undefined, []), []);
  assert.deepEqual(safeJsonParse('', []), []);
});

test('safeJsonParse returns the fallback for non-string input', () => {
  // Avoid surprises if a caller forgets the column actually came back as a
  // number / object / Buffer.
  assert.deepEqual(safeJsonParse(123, []), []);
  assert.deepEqual(safeJsonParse({}, []), []);
});
