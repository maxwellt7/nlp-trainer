import test from 'node:test';
import assert from 'node:assert/strict';
import { truncateSpeakText, audioFileName, MAX_SPEAK_CHARS } from './voice.js';

test('truncateSpeakText passes short text through trimmed', () => {
  assert.equal(truncateSpeakText('  Hello there.  '), 'Hello there.');
  assert.equal(truncateSpeakText(''), '');
  assert.equal(truncateSpeakText(null), '');
});

test('truncateSpeakText cuts long text at a sentence boundary', () => {
  const sentence = 'This is a sentence that keeps going for a while. ';
  const long = sentence.repeat(60); // ~3000 chars
  const out = truncateSpeakText(long);
  assert.ok(out.length <= MAX_SPEAK_CHARS);
  assert.ok(out.endsWith('.'), `should end at a sentence, got: …${out.slice(-20)}`);
});

test('truncateSpeakText hard-cuts with ellipsis when no sentence boundary exists', () => {
  const out = truncateSpeakText('x'.repeat(3000));
  assert.equal(out.length, MAX_SPEAK_CHARS + 1);
  assert.ok(out.endsWith('…'));
});

test('audioFileName maps browser MIME types to Whisper-accepted names', () => {
  assert.equal(audioFileName('audio/mp4'), 'audio.mp4');            // Safari
  assert.equal(audioFileName('audio/webm;codecs=opus'), 'audio.webm'); // Chrome
  assert.equal(audioFileName('audio/wav'), 'audio.wav');
  assert.equal(audioFileName(''), 'audio.webm');
});
