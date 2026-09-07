import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (...p) => fs.readFileSync(path.resolve(__dirname, '..', ...p), 'utf8');
const routeSrc = read('server', 'routes', 'ask.js');
const indexSrc = read('server', 'index.js');

test('ask route is auth-gated and retrieves from the knowledge base and conversation memory', () => {
  assert.match(routeSrc, /requireAuth/, 'must require auth');
  assert.match(routeSrc, /retrieveRelevant\(/, 'must retrieve KB chunks');
  assert.match(routeSrc, /retrieveConversationChunks\(/, 'must retrieve coaching conversation memory');
  assert.match(routeSrc, /getSessionsForAskMemory\(/, 'must load this user\'s sessions');
  assert.match(routeSrc, /recentUserQuery\(/, 'must retrieve against recent conversation, not only the latest question');
  assert.match(routeSrc, /formatRetrievedForPrompt\(/, 'must format chunks into the prompt');
});

test('ask route grounds strictly and returns answer + sources', () => {
  assert.match(routeSrc, /mergeAskSources\(/, 'must build de-duplicated library + conversation sources');
  assert.match(routeSrc, /shouldSkipAskLlm\(/, 'must short-circuit only when library AND memory miss');
  assert.match(routeSrc, /anthropic\.messages\.create/, 'must call the LLM abstraction');
  assert.match(routeSrc, /knowledge-base teacher/, 'must teach from the library rather than summarize as a librarian');
  assert.match(routeSrc, /CONVERSATION MEMORY/, 'must inject past chats as a distinct source block');
  assert.match(routeSrc, /go as deep as the sources go/, 'must let answer length follow the source material');
  assert.match(routeSrc, /max_tokens:\s*3072/, 'must allow a source-deep answer to finish');
  assert.doesNotMatch(routeSrc, /Be concise and direct/, 'must not flatten answers to a concise paraphrase');
});

test('ask route is mounted in server index', () => {
  assert.match(indexSrc, /routes\/ask\.js/, 'must import the ask route');
  assert.match(indexSrc, /app\.use\(\s*['"]\/api\/ask['"]/, 'must mount at /api/ask');
  assert.match(indexSrc, /limit:\s*'4mb'/, 'must accept screenshot payloads larger than 1mb');
});

test('ask route OCRs attached screenshots into a source block', () => {
  assert.match(routeSrc, /parseAskImage\(/, 'must validate the image payload');
  assert.match(routeSrc, /extractScreenshotText\(/, 'must OCR the screenshot');
  assert.match(routeSrc, /SCREENSHOT TRANSCRIPT/, 'must inject the extracted transcript');
  assert.match(routeSrc, /light markdown/, 'must ask the model for markdown the UI can render');
});
