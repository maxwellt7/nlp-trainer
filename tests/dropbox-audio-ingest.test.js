import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (...p) => fs.readFileSync(path.resolve(__dirname, '..', ...p), 'utf8');
const syncSrc = read('server', 'services', 'dropbox-sync.js');

test('Dropbox sync lists audio coaching recordings, not only PDFs and text', () => {
  assert.match(syncSrc, /AUDIO_EXT/, 'must import audio extensions');
  assert.match(syncSrc, /transcribeAudio\(/, 'must Whisper-transcribe audio before ingest');
  assert.match(syncSrc, /ingestedFingerprint\(/, 'must skip unchanged audio by Dropbox content hash');
  assert.match(syncSrc, /isAudioExtension\(/);
});
