import express from 'express';
import OpenAI, { toFile } from 'openai';
import { requireAuth } from '../middleware/auth.js';
import { resolveVoiceSelection } from '../services/audio-voices.js';
import { truncateSpeakText, audioFileName } from '../services/voice.js';

const router = express.Router();
router.use(requireAuth);

// Voice turns are short (≤60s of Opus/AAC ≈ well under 15 MB) but far bigger
// than the app-wide 1 MB JSON limit, so this route takes the raw audio body.
const rawAudio = express.raw({ type: () => true, limit: '15mb' });

let _openai = null;
function openai() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// Simple per-user rate limit to protect API spend (30 calls/min per endpoint).
const hits = new Map();
function limited(userId, endpoint) {
  const key = `${userId}:${endpoint}`;
  const now = Date.now();
  const windowHits = (hits.get(key) || []).filter((t) => now - t < 60_000);
  windowHits.push(now);
  hits.set(key, windowHits);
  return windowHits.length > 30;
}

// POST /api/voice/transcribe — raw audio body (+ x-audio-mime header) → { text }
router.post('/transcribe', rawAudio, async (req, res) => {
  try {
    if (limited(req.userId, 'transcribe')) {
      return res.status(429).json({ error: 'Too many requests — give it a minute.' });
    }
    const audio = req.body;
    if (!Buffer.isBuffer(audio) || audio.length < 1000) {
      return res.status(400).json({ error: "Didn't catch that — try again." });
    }
    const mime = req.get('x-audio-mime') || 'audio/webm';
    const file = await toFile(audio, audioFileName(mime), { type: mime });
    const result = await openai().audio.transcriptions.create({
      model: 'whisper-1',
      file,
    });
    const text = String(result.text || '').trim();
    if (!text) {
      return res.status(400).json({ error: "Didn't catch that — try again." });
    }
    res.json({ text });
  } catch (err) {
    console.error('[Voice] transcribe error:', err.message);
    res.status(500).json({ error: 'Transcription failed — try again.' });
  }
});

// POST /api/voice/speak — { text } → audio/mpeg body (ElevenLabs, default voice)
router.post('/speak', async (req, res) => {
  try {
    if (limited(req.userId, 'speak')) {
      return res.status(429).json({ error: 'Too many requests — give it a minute.' });
    }
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Voice is not configured.' });
    const text = truncateSpeakText(req.body?.text);
    if (!text) return res.status(400).json({ error: 'Nothing to say.' });

    const voice = resolveVoiceSelection(req.body?.voiceId);
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.id}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0.1, use_speaker_boost: false },
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error('[Voice] ElevenLabs error:', response.status, detail.slice(0, 200));
      return res.status(502).json({ error: 'Could not generate speech.' });
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'no-store');
    res.send(buffer);
  } catch (err) {
    console.error('[Voice] speak error:', err.message);
    res.status(500).json({ error: 'Could not generate speech.' });
  }
});

export default router;
