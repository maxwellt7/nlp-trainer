import express from 'express';
import anthropic from '../config/anthropic.js';
import { requireAuth } from '../middleware/auth.js';
import { retrieveRelevant, formatRetrievedForPrompt } from '../services/knowledge-base.js';
import { recentUserQuery } from '../services/retrieval-query.js';
import { dedupeSources, dedupeChunks, isBelowRelevanceFloor } from '../services/ask.js';
import { createThread, appendTurns, listThreads, getThread, deleteThread } from '../services/ask-threads.js';

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
  "You are a knowledge-base teacher answering questions ONLY from the user's own saved library.",
  'Use ONLY the SOURCES below. If they do not contain the answer, say the library does not cover it —',
  'never fall back on outside knowledge or guess.',
  'When the sources answer the question, treat them as authoritative and teach from them:',
  "use the library's own terms, distinctions, sequences, and examples;",
  'quote a short passage when the exact wording matters;',
  'if sources have layers, caveats, or disagreements, surface those instead of flattening into a generic summary;',
  "go as deep as the sources go — a short answer is right when the library is short; a longer answer is right when the material is specific and rich;",
  "do not replace the source's framework with a simpler popular-psychology paraphrase.",
].join(' ');

// POST /api/ask — { question, history? } -> { answer, sources }
router.post('/', async (req, res) => {
  try {
    if (limited(req.userId)) {
      return res.status(429).json({ error: 'Too many questions — give it a minute.' });
    }
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    if (!question) return res.status(400).json({ error: 'Ask a question first.' });

    // Resolve the thread: reopen an existing one (history from its stored
    // messages) or start a new one titled by this question.
    let threadId = typeof req.body?.threadId === 'string' ? req.body.threadId : null;
    let title = '';
    let history = [];
    if (threadId) {
      const thread = getThread(threadId, req.userId);
      if (!thread) return res.status(404).json({ error: 'Thread not found.' });
      title = thread.title;
      history = thread.messages
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));
    }

    // throwOnError so a transient retrieval failure is reported as an error to
    // retry — NOT as the misleading "not in your library" (which a swallowed
    // error would otherwise produce for content that IS indexed).
    let chunks;
    try {
      const retrievalQuery = recentUserQuery(
        [...history, { role: 'user', content: question }],
        { maxTurns: 4, maxChars: 900 },
      );
      chunks = await retrieveRelevant(retrievalQuery, { topK: 16, throwOnError: true });
    } catch (retrievalErr) {
      console.error('[ask] retrieval failed:', retrievalErr.message);
      return res.status(503).json({ error: 'Trouble reaching your library right now — try again.' });
    }
    // Duplicate files index identical text; collapse so the LLM context and the
    // cited sources aren't crowded by copies.
    chunks = dedupeChunks(chunks);

    let answer;
    let sources = [];
    if (isBelowRelevanceFloor(chunks, MIN_SCORE)) {
      answer = NOT_FOUND;
    } else {
      const system = `${SYSTEM}\n\nSOURCES:\n${formatRetrievedForPrompt(chunks)}`;
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 3072,
        system,
        messages: [...history, { role: 'user', content: question }],
      });
      answer = (response?.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim() || NOT_FOUND;
      sources = dedupeSources(chunks);
    }

    // Persist: create the thread on the first turn, then append this Q&A.
    if (!threadId) {
      const created = createThread(req.userId, question);
      threadId = created.id;
      title = created.title;
    }
    appendTurns(threadId, req.userId, [
      { role: 'user', content: question },
      { role: 'assistant', content: answer, sources },
    ]);

    res.json({ answer, sources, threadId, title });
  } catch (err) {
    console.error('[ask] failed:', err.message);
    res.status(500).json({ error: 'Something went wrong — try again.' });
  }
});

// GET /api/ask/threads — the user's threads, newest first
router.get('/threads', (req, res) => {
  res.json({ threads: listThreads(req.userId) });
});

// GET /api/ask/threads/:id — a full thread to reopen
router.get('/threads/:id', (req, res) => {
  const thread = getThread(req.params.id, req.userId);
  if (!thread) return res.status(404).json({ error: 'Thread not found.' });
  res.json(thread);
});

// DELETE /api/ask/threads/:id
router.delete('/threads/:id', (req, res) => {
  deleteThread(req.params.id, req.userId);
  res.json({ ok: true });
});

export default router;
