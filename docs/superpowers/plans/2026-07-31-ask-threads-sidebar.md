# Ask Threads + Sidebar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (or subagent-driven-development). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Persist Ask Q&A as multi-turn threads with a History-style sidebar + New button.

**Architecture:** New `ask_threads` table + `ask-threads.js` service (map boundary, ownership-checked), extend `server/routes/ask.js` (persist on POST + thread CRUD routes), extend `Ask.tsx` with a drawer sidebar. Spec: `docs/superpowers/specs/2026-07-31-ask-threads-sidebar-design.md`.

## Global Constraints
- Reuse the goals table/service pattern (`server/services/goals.js`), `safeJsonParse`, `uuid`.
- `rd` design language on the frontend; mirror the coaching chat's History drawer pattern from `src/pages/Hypnosis.tsx`.
- Ownership-checked everywhere (a user can only see/modify their own threads).
- Don't touch the coaching `sessions` table.
- All suites green after each task.

---

### Task 1: `ask_threads` table + service

**Files:**
- Modify: `server/db/index.js` (add table to SCHEMA_SQL)
- Create: `server/services/ask-threads.js`
- Test: `server/services/ask-threads.test.js`

**Interfaces (Produces):** `createThread(userId, firstQuestion) -> {id,title}`, `appendTurns(threadId, userId, turns)`, `listThreads(userId) -> [{id,title,updatedAt}]`, `getThread(threadId, userId) -> {id,title,messages}|null`, `deleteThread(threadId, userId)`.

- [ ] **Step 1: Add the table** to `SCHEMA_SQL` in `server/db/index.js`, after the `goals` table + index:

```sql
    CREATE TABLE IF NOT EXISTS ask_threads (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      title      TEXT NOT NULL DEFAULT '',
      messages   TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ask_threads_user ON ask_threads(user_id);
```

- [ ] **Step 2: Write the failing tests** — `server/services/ask-threads.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createThread, appendTurns, listThreads, getThread, deleteThread } from './ask-threads.js';

test('create -> get returns the thread with its title and empty messages', () => {
  const { id, title } = createThread('u1', 'What is clean influence?');
  assert.equal(title, 'What is clean influence?');
  const t = getThread(id, 'u1');
  assert.equal(t.id, id);
  assert.deepEqual(t.messages, []);
});

test('title is trimmed to 80 chars', () => {
  const { title } = createThread('u1', 'x'.repeat(200));
  assert.equal(title.length, 80);
});

test('appendTurns stores turns and getThread returns them', () => {
  const { id } = createThread('u1', 'q');
  appendTurns(id, 'u1', [
    { role: 'user', content: 'q' },
    { role: 'assistant', content: 'a', sources: [{ filename: 'f.txt', score: 0.4 }] },
  ]);
  const t = getThread(id, 'u1');
  assert.equal(t.messages.length, 2);
  assert.equal(t.messages[1].sources[0].filename, 'f.txt');
});

test('listThreads returns newest updated first', () => {
  const a = createThread('u2', 'first');
  const b = createThread('u2', 'second');
  appendTurns(a.id, 'u2', [{ role: 'user', content: 'later' }]); // bumps a.updated_at
  const list = listThreads('u2');
  assert.equal(list[0].id, a.id);
  assert.ok(list.every((t) => 'title' in t && 'updatedAt' in t));
});

test('ownership: another user cannot read, append to, or delete a thread', () => {
  const { id } = createThread('owner', 'secret');
  assert.equal(getThread(id, 'intruder'), null);
  appendTurns(id, 'intruder', [{ role: 'user', content: 'x' }]); // no-op
  assert.equal(getThread(id, 'owner').messages.length, 0);
  deleteThread(id, 'intruder'); // no-op
  assert.ok(getThread(id, 'owner'));
  deleteThread(id, 'owner');
  assert.equal(getThread(id, 'owner'), null);
});
```

- [ ] **Step 3: Run to verify failure** — `node --test server/services/ask-threads.test.js` → module not found.

- [ ] **Step 4: Implement** — `server/services/ask-threads.js`:

```js
import db from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { safeJsonParse } from './safe-json.js';

// Single mapping boundary for ask_threads: DB row (snake_case, JSON-in-TEXT) <->
// app shape (camelCase, parsed messages). Every read/write is ownership-scoped.

export function createThread(userId, firstQuestion) {
  const id = `ask-${Date.now()}-${uuidv4().slice(0, 8)}`;
  const title = String(firstQuestion || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  db.prepare('INSERT INTO ask_threads (id, user_id, title, messages) VALUES (?, ?, ?, ?)')
    .run(id, userId, title, '[]');
  return { id, title };
}

export function appendTurns(threadId, userId, turns) {
  const row = db.prepare('SELECT messages FROM ask_threads WHERE id = ? AND user_id = ?').get(threadId, userId);
  if (!row) return; // not owned / missing — no-op
  const messages = safeJsonParse(row.messages, []);
  for (const t of turns || []) messages.push(t);
  db.prepare("UPDATE ask_threads SET messages = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?")
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
```

- [ ] **Step 5: Verify** — `node --test server/services/ask-threads.test.js` all pass.
- [ ] **Step 6: Commit** — `git add server/db/index.js server/services/ask-threads.js server/services/ask-threads.test.js && git commit -m "feat(ask): ask_threads table + ownership-scoped CRUD service"`

---

### Task 2: Persist on POST /api/ask + thread routes

**Files:**
- Modify: `server/routes/ask.js`
- Test: `tests/ask-threads-route.test.js`

**Interfaces:** `POST /api/ask {question, threadId?}` -> `{answer, sources, threadId, title}`; `GET /api/ask/threads`; `GET /api/ask/threads/:id`; `DELETE /api/ask/threads/:id`.

- [ ] **Step 1: Write the failing test** — `tests/ask-threads-route.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routeSrc = fs.readFileSync(path.resolve(__dirname, '..', 'server', 'routes', 'ask.js'), 'utf8');

test('POST /api/ask persists both turns and returns the thread id + title', () => {
  assert.match(routeSrc, /createThread\(|getThread\(/, 'must resolve or create a thread');
  assert.match(routeSrc, /appendTurns\(/, 'must persist the question + answer turns');
  assert.match(routeSrc, /threadId[\s\S]{0,40}title/, 'response must include threadId and title');
});

test('thread list/get/delete routes exist', () => {
  assert.match(routeSrc, /router\.get\(\s*['"]\/threads['"]/, 'GET /threads');
  assert.match(routeSrc, /router\.get\(\s*['"]\/threads\/:id['"]/, 'GET /threads/:id');
  assert.match(routeSrc, /router\.delete\(\s*['"]\/threads\/:id['"]/, 'DELETE /threads/:id');
});
```

- [ ] **Step 2: Run to verify failure** — `node --test tests/ask-threads-route.test.js` → fails.

- [ ] **Step 3: Implement** — in `server/routes/ask.js`:

Add the import:
```js
import { createThread, appendTurns, listThreads, getThread, deleteThread } from '../services/ask-threads.js';
```

Replace the POST `/` handler body so it (a) resolves history from the stored thread, (b) persists both turns, (c) returns `threadId` + `title`. Replace the current history-from-body logic and the final `res.json`:

```js
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

    let chunks;
    try {
      chunks = await retrieveRelevant(question, { topK: 12, throwOnError: true });
    } catch (retrievalErr) {
      console.error('[ask] retrieval failed:', retrievalErr.message);
      return res.status(503).json({ error: 'Trouble reaching your library right now — try again.' });
    }
    chunks = dedupeChunks(chunks);

    let answer;
    let sources = [];
    if (isBelowRelevanceFloor(chunks, MIN_SCORE)) {
      answer = NOT_FOUND;
    } else {
      const system = `${SYSTEM}\n\nSOURCES:\n${formatRetrievedForPrompt(chunks)}`;
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
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

    // Persist: create the thread on first turn, then append this Q&A.
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
```

(Remove the now-unused `rawHistory`/`history` from-body block from the old handler.)

- [ ] **Step 4: Verify** — `node --test tests/ask-threads-route.test.js` passes. Boot-probe: `PORT=3011 node server/index.js`, then `curl -s -X POST localhost:3011/api/ask -d '{"question":"hi"}' -H 'Content-Type: application/json'` returns `{answer,sources,threadId,title}`; `curl localhost:3011/api/ask/threads` lists it; `curl localhost:3011/api/ask/threads/<id>` returns the two turns.
- [ ] **Step 5: Commit** — `git add server/routes/ask.js tests/ask-threads-route.test.js && git commit -m "feat(ask): persist Q&A to threads; thread list/get/delete routes"`

---

### Task 3: API client methods

**Files:** Modify `src/services/api.ts`.

- [ ] **Step 1: Implement** — replace the existing `ask` method and add the thread methods:

```ts
  // ── Ask (knowledge-base Q&A) ──
  ask: (question: string, threadId?: string | null) =>
    request<{ answer: string; sources: { filename: string; score: number }[]; threadId: string; title: string }>(
      '/ask',
      { method: 'POST', body: JSON.stringify({ question, threadId: threadId || undefined }) },
    ),
  askThreads: () =>
    request<{ threads: { id: string; title: string; updatedAt: string }[] }>('/ask/threads'),
  askThread: (id: string) =>
    request<{ id: string; title: string; messages: { role: 'user' | 'assistant'; content: string; sources?: { filename: string; score: number }[] }[] }>(
      `/ask/threads/${encodeURIComponent(id)}`,
    ),
  deleteAskThread: (id: string) =>
    request<{ ok: boolean }>(`/ask/threads/${encodeURIComponent(id)}`, { method: 'DELETE' }),
```

- [ ] **Step 2: Verify** — `npx tsc -b` clean (Ask.tsx still compiles — it calls `api.ask(q, history)`; Task 4 updates the call. If tsc errors on the arg type, proceed to Task 4 which fixes the caller.)
- [ ] **Step 3: Commit** — `git add src/services/api.ts && git commit -m "feat(ask): thread api client methods"`

---

### Task 4: Ask sidebar UI

**Files:** Modify `src/pages/rd/Ask.tsx`.

- [ ] **Step 1: Rewrite `Ask.tsx`** to add threads + sidebar. Full file:

```tsx
import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';

interface Source { filename: string; score: number }
interface Turn { question: string; answer: string; sources: Source[] }
interface ThreadMeta { id: string; title: string; updatedAt: string }

export default function Ask() {
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadMeta[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshThreads = () => { api.askThreads().then((d) => setThreads(d.threads)).catch(() => {}); };
  useEffect(() => { refreshThreads(); }, []);

  const scrollToEnd = () => requestAnimationFrame(() =>
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setError(null);
    setLoading(true);
    try {
      const { answer, sources, threadId: tid } = await api.ask(q, threadId);
      setTurns((prev) => [...prev, { question: q, answer, sources }]);
      const isNew = !threadId;
      setThreadId(tid);
      if (isNew) refreshThreads();
      scrollToEnd();
    } catch (err: any) {
      setError(err.message || 'Something went wrong — try again.');
    } finally {
      setLoading(false);
    }
  };

  const openThread = async (id: string) => {
    setSidebarOpen(false);
    setError(null);
    try {
      const t = await api.askThread(id);
      const loaded: Turn[] = [];
      for (let i = 0; i < t.messages.length; i += 1) {
        const m = t.messages[i];
        if (m.role === 'user') {
          const a = t.messages[i + 1];
          loaded.push({ question: m.content, answer: a?.role === 'assistant' ? a.content : '', sources: a?.sources || [] });
          if (a?.role === 'assistant') i += 1;
        }
      }
      setTurns(loaded);
      setThreadId(t.id);
      scrollToEnd();
    } catch {
      setError('Could not open that thread.');
    }
  };

  const startNew = () => { setThreadId(null); setTurns([]); setError(null); setSidebarOpen(false); };

  const removeThread = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (id === threadId) startNew();
    try { await api.deleteAskThread(id); } catch { /* already gone from view */ }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: 'var(--rd-ink)', fontFamily: 'var(--font-sans)', position: 'relative' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 'calc(env(safe-area-inset-top) + 14px) 16px 12px', borderBottom: '1px solid var(--rd-border)' }}>
        <button onClick={() => setSidebarOpen(true)} aria-label="History" style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)', borderRadius: 999, padding: '7px 14px', color: 'var(--rd-muted)', fontSize: 13, cursor: 'pointer' }}>History</button>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>Ask your library</div>
        <button onClick={startNew} aria-label="New question" style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)', borderRadius: 999, padding: '7px 14px', color: 'var(--rd-accent-bright)', fontSize: 13, cursor: 'pointer' }}>New</button>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 20px 12px' }}>
        <div style={{ maxWidth: 440, margin: '0 auto' }}>
          {turns.length === 0 && !loading && (
            <div style={{ fontSize: 14, color: 'var(--rd-muted-2)', lineHeight: 1.6, marginTop: 8 }}>
              Answers come only from what you've saved. Ask anything — “What does the material say about clean influence?”
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i} style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                <div style={{ background: 'var(--rd-surface-2)', border: '1px solid var(--rd-border)', borderRadius: 16, padding: '10px 14px', fontSize: 14, maxWidth: '85%' }}>{t.question}</div>
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--rd-ink-soft)', whiteSpace: 'pre-wrap' }}>{t.answer}</div>
              {t.sources.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {t.sources.map((s) => (
                    <span key={s.filename} style={{ fontSize: 11, color: 'var(--rd-muted)', background: 'var(--rd-surface)', border: '1px solid var(--rd-border)', borderRadius: 999, padding: '3px 10px' }}>{s.filename}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && <div style={{ fontSize: 14, color: 'var(--rd-muted)', fontStyle: 'italic' }}>Searching your library…</div>}
          {error && <div style={{ fontSize: 13, color: 'var(--rd-danger)', marginTop: 8 }}>{error}</div>}
        </div>
      </div>

      {/* Composer */}
      <form onSubmit={submit} style={{ flexShrink: 0, padding: '10px 16px calc(env(safe-area-inset-bottom) + 10px)', borderTop: '1px solid var(--rd-border)', background: 'var(--rd-bg)' }}>
        <div style={{ maxWidth: 440, margin: '0 auto', display: 'flex', gap: 8 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question…" style={{ flex: 1, background: 'var(--rd-surface)', border: '1px solid var(--rd-border)', borderRadius: 999, padding: '11px 16px', color: 'var(--rd-ink)', fontSize: 15, fontFamily: 'var(--font-sans)' }} />
          <button type="submit" disabled={!input.trim() || loading} style={{ flexShrink: 0, border: 'none', borderRadius: 999, padding: '0 18px', fontSize: 14, fontWeight: 600, cursor: input.trim() && !loading ? 'pointer' : 'default', background: input.trim() && !loading ? 'var(--rd-accent)' : 'var(--rd-surface)', color: input.trim() && !loading ? '#06121c' : 'var(--rd-dim)' }}>Ask</button>
        </div>
      </form>

      {/* Sidebar drawer */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.5)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '82%', maxWidth: 320, background: 'var(--rd-bg-deep)', borderRight: '1px solid var(--rd-border)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(env(safe-area-inset-top) + 16px) 16px 12px', borderBottom: '1px solid var(--rd-border)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>History</div>
              <button onClick={startNew} style={{ background: 'var(--rd-accent)', color: '#06121c', border: 'none', borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>New question</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 10px' }}>
              {threads.length === 0 && <div style={{ fontSize: 13, color: 'var(--rd-muted-2)', padding: 12 }}>No questions yet.</div>}
              {threads.map((t) => (
                <div key={t.id} onClick={() => openThread(t.id)} role="button" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', background: t.id === threadId ? 'var(--rd-surface-2)' : 'transparent', marginBottom: 2 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--rd-ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title || 'Untitled'}</span>
                  <button onClick={(e) => removeThread(t.id, e)} aria-label="Delete" style={{ background: 'none', border: 'none', color: 'var(--rd-muted-2)', fontSize: 16, cursor: 'pointer', padding: 4, flexShrink: 0 }}>×</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify** — `npx tsc -b` clean; `npm run test:web` green; `npm run build` succeeds.
- [ ] **Step 3: Manual smoke (browser, backend on 3011 + proxy)** — ask a question → it renders + a thread appears under History; open it fresh → turns + source chips reload; New clears; delete removes the row. Revert any temp proxy change.
- [ ] **Step 4: Commit** — `git add src/pages/rd/Ask.tsx && git commit -m "feat(ask): History sidebar — saved multi-turn threads + New button"`

---

### Task 5: QC, deploy, live-verify
- [ ] Full suites (`npm run test:web`, node tests, TS tests, `npx tsc -b`, `npm run build`) green.
- [ ] Push `main`; auto-deploy.
- [ ] Live-verify: `GET /api/ask/threads` on Railway → 401 unauth (mounted); live `Ask-*.js` chunk contains "History"; no boot error creating `ask_threads`.
- [ ] On-device: ask → saved to sidebar → reopen continues it → New starts fresh.

## Self-review notes
- Coverage: persisted threads (T1), persist-on-ask + CRUD routes (T2), client methods (T3), sidebar + New + reopen + delete + multi-turn (T4). Ownership enforced in the service (T1) and exercised by tests. Types: `{answer,sources,threadId,title}` consistent across T2/T3/T4; `messages` turn shape `{role,content,sources?}` consistent across service, route, client, UI.
