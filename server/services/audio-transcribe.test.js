import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIO_EXT,
  WHISPER_MAX_BYTES,
  isAudioExtension,
  transcribeAudio,
  whisperFileName,
} from './audio-transcribe.js';

test('whisperFileName maps Dropbox audio extensions to Whisper-accepted names', () => {
  assert.equal(whisperFileName('m4a'), 'audio.m4a');
  assert.equal(whisperFileName('.M4A'), 'audio.m4a');
  assert.equal(whisperFileName('mp3'), 'audio.mp3');
  assert.equal(whisperFileName('wav'), 'audio.wav');
});

test('isAudioExtension covers coaching-call formats and ignores documents', () => {
  assert.equal(isAudioExtension('m4a'), true);
  assert.equal(isAudioExtension('mp3'), true);
  assert.equal(AUDIO_EXT.has('pdf'), false);
  assert.equal(isAudioExtension('txt'), false);
});

test('transcribeAudio sends small files to Whisper without ffmpeg', async () => {
  const calls = [];
  const buf = Buffer.alloc(2000, 1);
  const text = await transcribeAudio(buf, 'm4a', {
    transcribeFile: async (chunk, filename) => {
      calls.push({ size: chunk.length, filename });
      return 'hello from the call';
    },
    runFfmpeg: async () => { throw new Error('ffmpeg should not run'); },
  });
  assert.equal(text, 'hello from the call');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].filename, 'audio.m4a');
});

test('transcribeAudio splits files over Whisper\'s 25 MB cap', async () => {
  const buf = Buffer.alloc(WHISPER_MAX_BYTES + 10, 1);
  const ffmpegArgs = [];
  const text = await transcribeAudio(buf, 'm4a', {
    runFfmpeg: async (args) => {
      ffmpegArgs.push(args);
      const out = args.at(-1);
      const { writeFile } = await import('node:fs/promises');
      const { dirname, join } = await import('node:path');
      const dir = dirname(out);
      await writeFile(join(dir, 'chunk-000.mp3'), Buffer.alloc(1500, 2));
      await writeFile(join(dir, 'chunk-001.mp3'), Buffer.alloc(1500, 3));
    },
    transcribeFile: async (_chunk, filename) => `part:${filename}`,
  });
  assert.equal(ffmpegArgs.length, 1);
  assert.ok(ffmpegArgs[0].includes('libmp3lame'));
  assert.ok(ffmpegArgs[0].includes('segment'));
  assert.equal(text, 'part:chunk-000.mp3\n\npart:chunk-001.mp3');
});
