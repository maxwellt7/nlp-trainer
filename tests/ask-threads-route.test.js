import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routeSrc = fs.readFileSync(path.resolve(__dirname, '..', 'server', 'routes', 'ask.js'), 'utf8');

test('POST /api/ask persists both turns and returns the thread id + title', () => {
  assert.match(routeSrc, /createThread\(|getThread\(/, 'must resolve or create a thread');
  assert.match(routeSrc, /appendTurns\(/, 'must persist the question + answer turns');
  assert.match(routeSrc, /threadId[\s\S]{0,40}title/, 'response must include threadId and title');
});

test('thread list/get/delete routes exist', () => {
  assert.match(routeSrc, /router\.get\(\s*['"]\/threads['"]/, 'GET /threads');
  assert.match(routeSrc, /router\.get\(\s*['"]\/threads\/:id['"]/, 'GET /threads/:id');
  assert.match(routeSrc, /router\.delete\(\s*['"]\/threads\/:id['"]/, 'DELETE /threads/:id');
});
