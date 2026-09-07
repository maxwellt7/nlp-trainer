import express from 'express';
import anthropic from '../config/anthropic.js';
import { requireAuth } from '../middleware/auth.js';
import { retrieveRelevant, formatRetrievedForPrompt } from '../services/knowledge-base.js';
import { recentUserQuery } from '../services/retrieval-query.js';
import { dedupeChunks, isBelowRelevanceFloor, mergeAskSources, shouldSkipAskLlm } from '../services/ask.js';
import { createThread, appendTurns, listThreads, getThread, deleteThread } from '../services/ask-threads.js';
import { getSessionsForAskMemory } from '../services/memory.js';
import { retrieveConversationChunks } from '../services/conversation-retrieve.js';

const router = express.Router();
router.use(requireAuth);

const MIN_SCORE = Number(process.env.ASK_MIN_SCORE) || 0.15;
const NOT_FOUND = "I don't have anything on that in your library or past conversations yet.";

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
  "You are a knowledge-base teacher answering questions from TWO collections the user owns:",
  "their saved library (uploaded documents) and their own coaching conversations with this app.",
  'Use ONLY the SOURCES below. If they do not contain the answer, say it is not in the library or past conversations —',
  'never fall back on outside knowledge or guess.',
  'When the sources answer the question, treat them as authoritative and teach from them:',
  "use the library's own terms, distinctions, sequences, and examples;",
  'quote a short passage when the exact wording matters;',
  'if sources have layers, caveats, or disagreements, surface those instead of flattening into a generic summary;',
  "go as deep as the sources go — a short answer is right when the library is short; a longer answer is right when the material is specific and rich;",
  "do not replace the source's framework with a simpler popular-psychology paraphrase.",
  'When CONVERSATION MEMORY and LIBRARY SOURCES both speak to the question, use both:',
  'the library for the teaching, the conversations for what this person has already lived through or named.',
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

    const retrievalQuery = recentUserQuery(
      [...history, { role: 'user', content: question }],
      { maxTurns: 4, maxChars: 900 },
    );

    // throwOnError so a transient Pinecone failure is distinct from "nothing
    // matched." If the library is unreachable we can still answer from
    // conversation memory; only 503 when both are empty.
    let chunks = [];
    let retrievalFailed = false;
    try {
      chunks = await retrieveRelevant(retrievalQuery, { topK: 16, throwOnError: true });
    } catch (retrievalErr) {
      console.error('[ask] retrieval failed:', retrievalErr.message);
      retrievalFailed = true;
    }
    chunks = dedupeChunks(chunks);

    const conversationChunks = retrieveConversationChunks(
      retrievalQuery,
      getSessionsForAskMemory(req.userId),
    );

    let answer;
    let sources = [];
    if (shouldSkipAskLlm(chunks, conversationChunks, MIN_SCORE)) {
      if (retrievalFailed) {
        return res.status(503).json({ error: 'Trouble reaching your library right now — try again.' });
      }
      answer = NOT_FOUND;
    } else {
      const libraryChunks = isBelowRelevanceFloor(chunks, MIN_SCORE) ? [] : chunks;
      const sections = [];
      if (libraryChunks.length) sections.push(`LIBRARY SOURCES:\n${formatRetrievedForPrompt(libraryChunks)}`);
      if (conversationChunks.length) sections.push(`CONVERSATION MEMORY:\n${formatRetrievedForPrompt(conversationChunks)}`);
      const system = `${SYSTEM}\n\n${sections.join('\n\n')}`;
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
      sources = mergeAskSources(libraryChunks, conversationChunks);
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
