// Transcribe Dropbox (and other) audio into plain text for KB ingest.
// OpenAI Whisper accepts 25 MB; coaching recordings are often larger, so we
// re-encode to 16 kHz mono MP3 and split on a time boundary first.

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import OpenAI, { toFile } from 'openai';

export const AUDIO_EXT = new Set(['mp3', 'm4a', 'wav', 'mp4', 'mpeg', 'mpga', 'ogg', 'webm', 'aac']);
export const WHISPER_MAX_BYTES = 24 * 1024 * 1024;
const SEGMENT_SECONDS = 480;

export function isAudioExtension(extension) {
  const ext = (extension || '').toLowerCase().replace(/^\./, '');
  return AUDIO_EXT.has(ext);
}

export function whisperFileName(extension) {
  const ext = (extension || '').toLowerCase().replace(/^\./, '');
  if (ext === 'm4a' || ext === 'aac') return 'audio.m4a';
  if (ext === 'mp3' || ext === 'mpeg' || ext === 'mpga') return 'audio.mp3';
  if (ext === 'mp4') return 'audio.mp4';
  if (ext === 'wav') return 'audio.wav';
  if (ext === 'ogg') return 'audio.ogg';
  if (ext === 'webm') return 'audio.webm';
  return `audio.${ext || 'm4a'}`;
}

function openaiClient() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function defaultTranscribeFile(buf, filename) {
  if (!Buffer.isBuffer(buf) || buf.length < 1000) return '';
  if (buf.length > WHISPER_MAX_BYTES) {
    throw new Error(`Audio chunk ${filename} is still over Whisper's 25 MB limit`);
  }
  const file = await toFile(buf, filename);
  const result = await openaiClient().audio.transcriptions.create({
    model: 'whisper-1',
    file,
  });
  return String(result.text || '').trim();
}

function defaultRunFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

async function splitForWhisper(buf, ext, { runFfmpeg = defaultRunFfmpeg } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'kb-audio-'));
  const input = join(dir, `input.${ext || 'm4a'}`);
  try {
    await writeFile(input, buf);
    const pattern = join(dir, 'chunk-%03d.mp3');
    await runFfmpeg([
      '-y', '-i', input,
      '-vn', '-ac', '1', '-ar', '16000',
      '-c:a', 'libmp3lame', '-b:a', '64k',
      '-f', 'segment', '-segment_time', String(SEGMENT_SECONDS),
      '-reset_timestamps', '1',
      pattern,
    ]);
    const names = (await readdir(dir))
      .filter((name) => /^chunk-\d+\.mp3$/.test(name))
      .sort();
    if (names.length === 0) throw new Error('ffmpeg produced no audio chunks');
    const chunks = [];
    for (const name of names) {
      const part = await readFile(join(dir, name));
      if (part.length >= 1000) chunks.push({ filename: name, buf: part });
    }
    if (chunks.length === 0) throw new Error('ffmpeg produced empty audio chunks');
    return chunks;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * @param {Buffer} buf
 * @param {string} extension
 * @param {object} [deps]
 * @returns {Promise<string>}
 */
export async function transcribeAudio(buf, extension, deps = {}) {
  if (!Buffer.isBuffer(buf) || buf.length < 1000) return '';
  const ext = (extension || '').toLowerCase().replace(/^\./, '');
  const transcribeFile = deps.transcribeFile || defaultTranscribeFile;
  const runFfmpeg = deps.runFfmpeg || defaultRunFfmpeg;

  if (buf.length <= WHISPER_MAX_BYTES) {
    return transcribeFile(buf, whisperFileName(ext));
  }

  const chunks = await splitForWhisper(buf, ext, { runFfmpeg });
  const parts = [];
  for (const chunk of chunks) {
    const text = await transcribeFile(chunk.buf, chunk.filename);
    if (text) parts.push(text);
  }
  return parts.join('\n\n').trim();
}
