import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAskImage, parseExtractedText, screenshotChunk } from './screenshot-ocr.js';

test('parseAskImage returns null when no image is attached', () => {
  assert.equal(parseAskImage({}), null);
  assert.equal(parseAskImage({ question: 'hi' }), null);
});

test('parseAskImage accepts a data-URL and a raw payload', () => {
  const data = 'A'.repeat(120);
  const fromUrl = parseAskImage({ image: { data: `data:image/png;base64,${data}` } });
  assert.equal(fromUrl.mime, 'image/png');
  assert.equal(fromUrl.data, data);
  const fromParts = parseAskImage({ image: { mime: 'image/jpeg', data } });
  assert.equal(fromParts.mime, 'image/jpeg');
});

test('parseAskImage rejects disallowed types and empty payloads', () => {
  assert.throws(() => parseAskImage({ image: { mime: 'application/pdf', data: 'A'.repeat(120) } }), /PNG, JPEG, or WebP/);
  assert.throws(() => parseAskImage({ image: { mime: 'image/png', data: 'abc' } }), /empty/);
});

test('parseExtractedText reads JSON, fenced JSON, or plain text', () => {
  assert.equal(parseExtractedText('{"text":"Hello Max"}'), 'Hello Max');
  assert.equal(parseExtractedText('```json\n{"text":"quoted"}\n```'), 'quoted');
  assert.equal(parseExtractedText('just the transcript'), 'just the transcript');
  assert.equal(parseExtractedText(''), '');
});

test('screenshotChunk is skipped when OCR is blank', () => {
  assert.equal(screenshotChunk(''), null);
  assert.deepEqual(screenshotChunk('  You: I freeze  '), {
    source: 'screenshot:upload',
    filename: 'Uploaded screenshot',
    text: 'You: I freeze',
    score: 1,
  });
});
