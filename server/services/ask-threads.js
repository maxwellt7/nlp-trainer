import db from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { safeJsonParse } from './safe-json.js';

// Single mapping boundary for ask_threads: DB row (snake_case, JSON-in-TEXT) <->
// app shape (camelCase, parsed messages). Every read/write is ownership-scoped.

// Millisecond-precision timestamp so list ordering is deterministic even when
// threads are created/updated within the same second (default datetime('now')
// is second-granularity).
const NOW_MS = "strftime('%Y-%m-%d %H:%M:%f','now')";

export function createThread(userId, firstQuestion) {
  const id = `ask-${Date.now()}-${uuidv4().slice(0, 8)}`;
  const title = String(firstQuestion || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  db.prepare(`INSERT INTO ask_threads (id, user_id, title, messages, created_at, updated_at) VALUES (?, ?, ?, '[]', ${NOW_MS}, ${NOW_MS})`)
    .run(id, userId, title);
  return { id, title };
}

export function appendTurns(threadId, userId, turns) {
  const row = db.prepare('SELECT messages FROM ask_threads WHERE id = ? AND user_id = ?').get(threadId, userId);
  if (!row) return; // not owned / missing — no-op
  const messages = safeJsonParse(row.messages, []);
  for (const t of turns || []) messages.push(t);
  db.prepare(`UPDATE ask_threads SET messages = ?, updated_at = ${NOW_MS} WHERE id = ? AND user_id = ?`)
    .run(JSON.stringify(messages), threadId, userId);
}

export function listThreads(userId) {
  return db.prepare('SELECT id, title, updated_at FROM ask_threads WHERE user_id = ? ORDER BY updated_at DESC')
    .all(userId)
    .map((r) => ({ id: r.id, title: r.title, updatedAt: r.updated_at }));
}

export function getThread(threadId, userId) {
  const row = db.prepare('SELECT id, title, messages FROM ask_threads WHERE id = ? AND user_id = ?').get(threadId, userId);
  if (!row) return null;
  return { id: row.id, title: row.title, messages: safeJsonParse(row.messages, []) };
}

export function deleteThread(threadId, userId) {
  db.prepare('DELETE FROM ask_threads WHERE id = ? AND user_id = ?').run(threadId, userId);
}
