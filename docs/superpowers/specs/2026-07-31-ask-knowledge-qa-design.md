# "Ask" — Knowledge-Base Q&A — Design Specification

**Date:** 2026-07-31
**Status:** Proposed
**Goal:** Let the user ask a plain question and get an answer drawn strictly from their uploaded knowledge-base content, with source citations — without entering a guided coaching/hypnosis session.

---

## 1. Summary

A new **Ask** tab: a calm, chat-style screen where the user types a question and gets a concise answer synthesized **only** from the `sacred-heart` Pinecone knowledge base (the Dropbox-synced library). Each answer shows which document(s) it drew from. If the library doesn't cover the question, it says so instead of guessing. Stateless — nothing is persisted server-side; follow-ups work within a visit via in-memory history.

This reuses the existing RAG retrieval (`retrieveRelevant`) and the multi-provider LLM abstraction (`anthropic.messages.create`). It is deliberately **separate** from the coaching `/hypnosis/chat` pipeline, which also runs NLP analysis, writes profile insights, and persists sessions — none of which a quick lookup should do.

## 2. Backend

### New route: `POST /api/ask` (`server/routes/ask.js`, `requireAuth`)

**Request:** `{ question: string, history?: { role: 'user' | 'assistant', content: string }[] }`
- `history` is the prior turns of this visit (client-held), so follow-ups have context. Capped server-side to the last 6 turns.

**Flow:**
1. Validate `question` is a non-empty string (else 400).
2. Rate-limit: reuse the per-user limiter pattern from `server/routes/voice.js` (30/min per user → 429).
3. Retrieve: `retrieveRelevant(question, { topK: 8 })` — no category filter, so it searches all library content.
4. **Relevance floor (cheap short-circuit):** if there are zero hits, or the top hit's `score` is below `ASK_MIN_SCORE` (env-tunable, default `0.15`), skip the LLM and return the not-found answer directly:
   `{ answer: "I don't have anything on that in your library yet.", sources: [] }`.
5. Otherwise build the prompt:
   - **System prompt (strict):** answer ONLY from the provided sources; if they don't contain the answer, say the library doesn't cover it rather than using outside knowledge; be concise; when you use a source, its material is authoritative. Sources are injected via `formatRetrievedForPrompt(chunks)`.
   - **Messages:** `[...history (≤6), { role: 'user', content: question }]`.
6. Call `anthropic.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 1024, system, messages })` (same multi-provider fallback the app already uses).
7. Build `sources`: from the retrieved chunks, derive a display filename from each chunk's `source` (strip the `dropbox:` prefix and take the basename, e.g. `dropbox:/01. Professional/AI Tools/foo.pdf` → `foo.pdf`). De-duplicate by filename, keep the highest score per file, cap at 5, drop any file the answer's score floor already excluded.
8. **Response:** `{ answer: string, sources: { filename: string, score: number }[] }`.

**Model-side guardrail + score floor together:** the floor kills obviously-irrelevant questions before spending an LLM call; the prompt handles the subtler "chunks came back but don't actually answer it" case. `ASK_MIN_SCORE` is env-tunable because integrated-embedding scores may need calibration against real data.

**No persistence.** No DB writes, no session rows. Stateless by design.

### Pure helper (`server/services/ask.js`, unit-tested)
- `sourceToFilename(source: string): string` — strip `dropbox:` prefix, return basename; `''`-safe.
- `dedupeSources(chunks): { filename, score }[]` — highest score per filename, sorted desc, capped at 5.
- `isBelowRelevanceFloor(chunks, minScore): boolean` — true when empty or top score `< minScore`.

Mount in `server/index.js` next to the other authed routes: `app.use('/api/ask', askRoutes)`.

## 3. Frontend

### New screen: `src/pages/rd/Ask.tsx` (route `/ask`)
- `rd` design language (`--rd-*` tokens, `var(--font-display)` headings, calm microcopy).
- Layout mirrors the chat structure but simplified: a scrollable answer area above a fixed question composer at the bottom (respecting `env(safe-area-inset-bottom)`; the shell already handles top inset).
- **Empty state:** a short prompt like "Ask anything about your library" + maybe 2–3 example questions as tappable chips (optional, nice-to-have).
- **Turn rendering:** user question (right-aligned bubble, same style as coaching chat's user bubble) → answer (left-aligned) → **source chips** beneath the answer (small pills showing each `filename`, tappable is a later nicety — for v1 they're display-only labels).
- **Loading:** a brief "Searching your library…" / "thinking…" state (non-streaming; one response, matching the existing chat).
- **Not-found answer** renders as a normal answer with no source chips.
- **History:** kept in React state for the visit; each new question sends the running history to `/api/ask`. Not persisted across visits (navigating away and back starts fresh). Documented as an easy future add.
- **Errors:** network/500 → inline "Something went wrong — try again," never blocks the composer.

### API client (`src/services/api.ts`)
```ts
ask: (question: string, history: { role: 'user' | 'assistant'; content: string }[]) =>
  request<{ answer: string; sources: { filename: string; score: number }[] }>(
    '/ask',
    { method: 'POST', body: JSON.stringify({ question, history }) },
  ),
```

### Navigation (`src/components/rd/BottomNav.tsx`)
- Add an **Ask** tab. Nav becomes 7 cells with the orb centered 3 / orb / 3:
  **Home · Goals · Ask · [orb] · Insights · Library · You**
- Grid changes from `repeat(6, 1fr)` to `repeat(7, 1fr)`; the orb stays the middle (4th) cell.
- Icon: a question/chat-bubble glyph (stroke, matching the other tab icons' weight). Label "Ask".
- Order is easily tweakable; Ask sits in the left cluster to keep the orb visually centered.

### Route wiring (`src/App.tsx`)
- Lazy-import `Ask` and add `<Route path="/ask" element={<Ask />} />` in both route blocks (mirroring how `/goals` was added).

## 4. Out of scope (YAGNI)

- Persisting Q&A history across visits (React-state history within a visit is enough for v1).
- Word-by-word streaming (brief "thinking…" then full answer).
- Tappable source chips that open the source document (no in-app document viewer exists; filenames as labels for v1).
- Category filtering / scoping the search to nlp vs coaching (search all content).
- Voice input on the Ask screen (the mic work is for the coaching chat; can be added later since the recorder hook is reusable).

## 5. Testing

- **`server/services/ask.test.js`** (node:test): `sourceToFilename` (dropbox prefix, nested path, empty), `dedupeSources` (highest-per-file, cap, sort), `isBelowRelevanceFloor` (empty, below, above).
- **`server/routes/ask` smoke** via the existing route-source regression pattern (mounted with `requireAuth`, calls `retrieveRelevant`, returns `{ answer, sources }`), plus a live boot probe: `POST /api/ask {question:''}` → 400; a real question → `{ answer, sources }`.
- **Frontend:** typecheck + a browser smoke test on `/ask` (ask a question about a known library topic, confirm an answer + source chips render; ask an off-topic question, confirm the "not in your library" answer with no chips).
- Full suites green (`npm run test:web`, node tests, `npm run build`) before deploy.

## 6. Rollout

- Ship to `main` (Vercel + Railway auto-deploy). Verify the live `Ask-*.js` chunk and that `POST /api/ask` on Railway returns 401 unauthenticated (route mounted) rather than 404.
- On-device: confirm the Ask tab appears, answers cite sources, and off-topic questions decline gracefully.
