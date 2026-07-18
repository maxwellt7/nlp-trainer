// Pure helpers for the voice routes (transcribe/speak). Kept separate from the
// route so they can be unit-tested without mocking express.

// ElevenLabs pricing + latency both scale with characters; coaching replies are
// short, so anything beyond this is an anomaly — cut at a sentence when we can.
export const MAX_SPEAK_CHARS = 2000;

export function truncateSpeakText(text) {
  const t = String(text || '').trim();
  if (t.length <= MAX_SPEAK_CHARS) return t;
  const slice = t.slice(0, MAX_SPEAK_CHARS);
  const lastSentence = slice.lastIndexOf('. ');
  if (lastSentence > MAX_SPEAK_CHARS * 0.5) return slice.slice(0, lastSentence + 1);
  return slice + '…';
}

// Map an uploaded audio MIME type to a filename Whisper accepts. Safari records
// audio/mp4 (AAC), Chrome audio/webm (Opus).
export function audioFileName(mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'audio.mp4';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'audio.mp3';
  if (mime.includes('wav')) return 'audio.wav';
  if (mime.includes('ogg')) return 'audio.ogg';
  return 'audio.webm';
}
