import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (...p) => fs.readFileSync(path.resolve(__dirname, '..', ...p), 'utf8');
const routeSrc = read('server', 'routes', 'ask.js');
const indexSrc = read('server', 'index.js');

test('ask route is auth-gated and retrieves from the knowledge base', () => {
  assert.match(routeSrc, /requireAuth/, 'must require auth');
  assert.match(routeSrc, /retrieveRelevant\(/, 'must retrieve KB chunks');
  assert.match(routeSrc, /formatRetrievedForPrompt\(/, 'must format chunks into the prompt');
});

test('ask route grounds strictly and returns answer + sources', () => {
  assert.match(routeSrc, /dedupeSources\(/, 'must build de-duplicated sources');
  assert.match(routeSrc, /isBelowRelevanceFloor\(/, 'must short-circuit below the relevance floor');
  assert.match(routeSrc, /anthropic\.messages\.create/, 'must call the LLM abstraction');
});

test('ask route is mounted in server index', () => {
  assert.match(indexSrc, /routes\/ask\.js/, 'must import the ask route');
  assert.match(indexSrc, /app\.use\(\s*['"]\/api\/ask['"]/, 'must mount at /api/ask');
});
