# "Ask" Threads + Sidebar — Design Specification

**Date:** 2026-07-31
**Status:** Proposed
**Goal:** Turn the stateless Ask Q&A tab into persistent, multi-turn threads browsable from a History-style sidebar, with a "New question" button.

Builds on `docs/superpowers/specs/2026-07-31-ask-knowledge-qa-design.md`.

---

## 1. Summary

Ask threads persist server-side. Each thread is a multi-turn Q&A conversation (follow-ups keep context, and each turn re-searches the library). A sidebar lists past threads (newest first, titled by the first question); tapping one reopens and continues it. A **New question** button starts a fresh thread. Answers keep their source citations across reload. Kept in a **dedicated `ask_threads` table**, separate from the coaching `sessions` table.

## 2. Backend

### New table `ask_threads` (`server/db/index.js` SCHEMA_SQL)
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
`messages` is a JSON array of turns: `{ role: 'user' | 'assistant', content: string, sources?: { filename, score }[] }` (sources only on assistant turns). Added idempotently (`CREATE TABLE IF NOT EXISTS` runs on every boot).

### Service `server/services/ask-threads.js` (single map boundary, ownership-checked)
- `createThread(userId, firstQuestion): { id, title }` — title = first question trimmed to 80 chars.
- `appendTurns(threadId, userId, turns[]): void` — push turns, bump `updated_at`. Ownership-checked (no-op if not owned).
- `listThreads(userId): { id, title, updatedAt }[]` — newest `updated_at` first.
- `getThread(threadId, userId): { id, title, messages } | null` — messages parsed.
- `deleteThread(threadId, userId): void` — ownership-checked.

### Routes (`server/routes/ask.js`, all `requireAuth`)
- **`POST /api/ask`** — body `{ question, threadId? }` (history no longer sent by the client; the server owns it).
  1. Validate, rate-limit (existing).
  2. If `threadId`: load the thread (404 if not owned); its stored messages become the history (last 6 turns) for the LLM. Else start a new thread.
  3. Retrieve (`throwOnError`, dedupe — existing), floor check, strict prompt, LLM (existing).
  4. Persist: append the user turn `{role:'user',content:question}` and the assistant turn `{role:'assistant',content:answer,sources}`. On a new thread, `createThread` first (title from the question).
  5. Respond `{ answer, sources, threadId, title }`.
  - The not-found and 503 paths still return without persisting a broken turn. (A not-found answer is a valid turn and IS persisted so the thread reads correctly on reopen.)
- **`GET /api/ask/threads`** → `{ threads: { id, title, updatedAt }[] }`.
- **`GET /api/ask/threads/:id`** → `{ id, title, messages }` (404 if not owned).
- **`DELETE /api/ask/threads/:id`** → `{ ok: true }`.

## 3. Frontend

### API client (`src/services/api.ts`)
- `ask(question, threadId?)` → `{ answer, sources, threadId, title }` (replaces the `history` arg — server owns history now).
- `askThreads()` → `{ threads: {id,title,updatedAt}[] }`.
- `askThread(id)` → `{ id, title, messages }`.
- `deleteAskThread(id)` → `{ ok }`.

### `src/pages/rd/Ask.tsx` — add the sidebar
- **State:** `threadId | null`, `turns` (rendered Q&A), `threads` (sidebar list), `sidebarOpen`.
- **Header:** a **History** toggle button (left) + **New** button — mirrors the coaching chat header pattern, in `rd` tokens.
- **Sidebar (drawer on mobile):** slide-in panel listing threads newest-first (title + relative date); tap → `askThread(id)` loads `turns` + sets `threadId` + closes drawer. Each row has a tucked delete (⋯ or trailing control) → `deleteAskThread`, optimistic. A **New question** button clears `threadId` + `turns`. Backdrop tap closes.
- **Submit:** `api.ask(question, threadId)`; on success append the turn, and set `threadId`/refresh the thread list if it was a new thread (so the new thread appears in the sidebar with its title).
- **Reopen fidelity:** loaded assistant turns render their saved `sources` chips.
- Loading / error / not-found rendering unchanged.

## 4. Out of scope (YAGNI)
- Renaming threads (title is the first question).
- Search within history.
- Cross-device sync beyond what the shared backend already gives.
- Pagination of the thread list (fine until it's large; add later).

## 5. Testing
- **`server/services/ask-threads.test.js`** (node:test, real in-memory/temp DB per the goals-test pattern): create→get, append→ordering by updated_at, ownership (another user can't get/append/delete), delete.
- **`tests/ask-threads-route.test.js`** — source-regression: `POST /api/ask` persists turns + returns `threadId`; the three thread routes exist and are auth-gated + mounted.
- **Frontend:** typecheck + browser smoke (open Ask, ask → thread appears in sidebar; reload the thread → turns + source chips render; New clears; delete removes).
- Full suites green before deploy.

## 6. Rollout
Ship to `main` (auto-deploy). Verify the `ask_threads` table is created on boot (Railway log / no error), `GET /api/ask/threads` returns 401 unauth (mounted), and the live `Ask-*.js` chunk has the sidebar. On-device: ask a question, confirm it's saved to the sidebar and reopens.
