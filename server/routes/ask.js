import express from 'express';
import anthropic from '../config/anthropic.js';
import { requireAuth } from '../middleware/auth.js';
import { retrieveRelevant, formatRetrievedForPrompt } from '../services/knowledge-base.js';
import { dedupeSources, isBelowRelevanceFloor } from '../services/ask.js';

const router = express.Router();
router.use(requireAuth);

const MIN_SCORE = Number(process.env.ASK_MIN_SCORE) || 0.15;
const NOT_FOUND = "I don't have anything on that in your library yet.";

// Per-user rate limit (30/min), same shape as the voice route.
const hits = new Map();
function limited(userId) {
  const now = Date.now();
  const windowHits = (hits.get(userId) || []).filter((t) => now - t < 60_000);
  windowHits.push(now);
  hits.set(userId, windowHits);
  return windowHits.length > 30;
}

const SYSTEM = [
  "You are a precise librarian answering questions ONLY from the user's own saved library.",
  'Use ONLY the SOURCES below. If they do not contain the answer, say the library does not cover it —',
  'never fall back on outside knowledge or guess. Be concise and direct. When the sources answer the',
  'question, treat them as authoritative.',
].join(' ');

// POST /api/ask — { question, history? } -> { answer, sources }
router.post('/', async (req, res) => {
  try {
    if (limited(req.userId)) {
      return res.status(429).json({ error: 'Too many questions — give it a minute.' });
    }
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    if (!question) return res.status(400).json({ error: 'Ask a question first.' });

    const rawHistory = Array.isArray(req.body?.history) ? req.body.history : [];
    const history = rawHistory
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    const chunks = await retrieveRelevant(question, { topK: 8 });
    if (isBelowRelevanceFloor(chunks, MIN_SCORE)) {
      return res.json({ answer: NOT_FOUND, sources: [] });
    }

    const system = `${SYSTEM}\n\nSOURCES:\n${formatRetrievedForPrompt(chunks)}`;
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages: [...history, { role: 'user', content: question }],
    });

    const answer = (response?.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim() || NOT_FOUND;

    res.json({ answer, sources: dedupeSources(chunks) });
  } catch (err) {
    console.error('[ask] failed:', err.message);
    res.status(500).json({ error: 'Something went wrong — try again.' });
  }
});

export default router;
