// Lexical retrieval over the user's coaching sessions. Ask uses this so
// answers can cite past chats alongside the Dropbox/Pinecone library.
// Scoring is local (no extra embedding call) so every historical session is
// searchable immediately, including ones that were never upserted to Pinecone.

import { looksLikeRawJson, sanitizeAssistantContent } from './message-sanitizer.js';

const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'for', 'on', 'with',
  'what', 'did', 'we', 'talk', 'about', 'my', 'i', 'you', 'is', 'it',
  'that', 'this', 'have', 'had', 'been', 'from', 'your', 'our', 'me',
  'do', 'does', 'how', 'why', 'when', 'where', 'who', 'can', 'could',
  'would', 'should', 'just', 'like', 'also', 'any', 'there', 'was',
  'were', 'be', 'as', 'at', 'so', 'if', 'not', 'no', 'yes', 'please',
  'tell', 'ask', 'something', 'anything', 'into', 'out', 'up', 'its',
]);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function tokenizeQuery(text) {
  return [...new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP.has(t)),
  )];
}

export function scoreText(text, terms) {
  if (!Array.isArray(terms) || terms.length === 0) return 0;
  const hay = String(text || '').toLowerCase();
  if (!hay) return 0;
  let hits = 0;
  let weight = 0;
  for (const term of terms) {
    let count = 0;
    let from = 0;
    while (from < hay.length) {
      const i = hay.indexOf(term, from);
      if (i < 0) break;
      count += 1;
      from = i + term.length;
      if (count >= 8) break;
    }
    if (count > 0) {
      hits += 1;
      weight += Math.min(3, count);
    }
  }
  return (hits / terms.length) * 0.75 + Math.min(0.25, weight * 0.04);
}

export function sessionLabel(session) {
  const title = String(session?.title || '').trim();
  if (title) return title;
  const kind = session?.session_type === 'daily_hypnosis' ? 'Daily session' : 'Coaching';
  const date = formatDateKey(session?.date_key);
  return date ? `${kind} · ${date}` : kind;
}

export function formatDateKey(dateKey) {
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return typeof dateKey === 'string' ? dateKey : '';
  }
  const [, month, day] = dateKey.split('-').map(Number);
  return `${MONTHS[month - 1]} ${day}`;
}

export function flattenSessionText(session) {
  const parts = [];
  const title = String(session?.title || '').trim();
  if (title) parts.push(title);
  const summary = String(session?.chat_summary || '').trim();
  if (summary) parts.push(summary);

  let themes = session?.key_themes;
  if (typeof themes === 'string') {
    try { themes = JSON.parse(themes); } catch { themes = []; }
  }
  if (Array.isArray(themes) && themes.length > 0) {
    parts.push(themes.filter(Boolean).join(', '));
  }

  let messages = session?.chat_messages;
  if (typeof messages === 'string') {
    try { messages = JSON.parse(messages); } catch { messages = []; }
  }
  if (Array.isArray(messages)) {
    for (const m of messages) {
      if (!m || typeof m.content !== 'string') continue;
      const raw = m.role === 'assistant' ? sanitizeAssistantContent(m.content) : m.content;
      const content = String(raw || '').trim();
      if (!content || looksLikeRawJson(content)) continue;
      const role = m.role === 'assistant' ? 'Coach' : m.role === 'user' ? 'You' : m.role;
      parts.push(`${role}: ${content}`);
    }
  }

  return parts.join('\n');
}

export function excerptAroundMatches(text, terms, maxChars = 1400) {
  const body = String(text || '');
  if (!body) return '';
  const lower = body.toLowerCase();
  let matchAt = 0;
  let found = false;
  for (const term of terms || []) {
    const i = lower.indexOf(term);
    if (i >= 0) {
      matchAt = i;
      found = true;
      break;
    }
  }
  const lookback = Math.min(220, Math.floor(maxChars / 3));
  const start = found ? Math.max(0, matchAt - lookback) : 0;
  let slice = body.slice(start, start + maxChars).trim();
  if (start > 0) slice = `…${slice}`;
  if (start + maxChars < body.length) slice = `${slice}…`;
  return slice;
}

function recencyChunks(sessions, topK) {
  const out = [];
  for (const session of sessions || []) {
    const text = flattenSessionText(session);
    if (!text.trim()) continue;
    const score = Math.max(0.2, 0.85 - out.length * 0.08);
    out.push({
      source: `conversation:${session.id}`,
      filename: sessionLabel(session),
      text: excerptAroundMatches(text, [], 1400),
      score,
    });
    if (out.length >= topK) break;
  }
  return out;
}

/**
 * Rank coaching sessions against a query. `sessions` is injected so tests
 * don't need SQLite. Vague questions (almost no content terms) fall back to
 * the most recent sessions so "what have we been working on?" still lands.
 */
export function retrieveConversationChunks(query, sessions, { topK = 6, minScore = 0.34 } = {}) {
  const terms = tokenizeQuery(query);
  if (!Array.isArray(sessions) || sessions.length === 0) return [];
  if (terms.length < 2) return recencyChunks(sessions, Math.min(4, topK));

  const scored = [];
  for (const session of sessions) {
    const text = flattenSessionText(session);
    if (!text.trim()) continue;
    const score = scoreText(text, terms);
    if (score < minScore) continue;
    scored.push({
      source: `conversation:${session.id}`,
      filename: sessionLabel(session),
      text: excerptAroundMatches(text, terms),
      score,
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
