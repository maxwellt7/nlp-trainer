# "Ask" — Knowledge-Base Q&A — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A stateless "Ask" tab that answers plain questions strictly from the user's `sacred-heart` knowledge base, with source citations.

**Architecture:** New `POST /api/ask` route (retrieve → strict-grounded LLM → answer + sources), reusing `retrieveRelevant`/`formatRetrievedForPrompt` and the `anthropic` multi-provider messages API. New `rd` screen at `/ask`, a 7th bottom-nav tab, and one API client method. No persistence, no coaching-pipeline coupling. Spec: `docs/superpowers/specs/2026-07-31-ask-knowledge-qa-design.md`.

**Tech Stack:** Node/Express (ESM), Pinecone (`sacred-heart`), Anthropic/OpenAI/Gemini fallback, React 18 + TS, inline styles with `--rd-*` tokens, node:test (server) + Vitest (web).

## Global Constraints

- `rd` design language: inline styles, `--rd-*` tokens, `var(--font-display)` serif headings, calm microcopy.
- No new dependencies.
- Do NOT touch the coaching `/hypnosis/chat` pipeline, the `sessions` table, or profile/NLP analysis.
- LLM model: `claude-sonnet-4-6` via the default `anthropic` export (multi-provider fallback), matching the existing chat route.
- Relevance floor env var `ASK_MIN_SCORE`, default `0.15`.
- All suites green after every task: `npm run test:web`, `node --test` server tests, `npx tsc -b`.

---

### Task 1: Pure `ask` helpers

**Files:**
- Create: `server/services/ask.js`
- Test: `server/services/ask.test.js`

**Interfaces:**
- Consumes: retrieved chunks shaped `{ score:number, source:string, chunkIndex, category, text:string }` (the return shape of `retrieveRelevant`).
- Produces (consumed by Task 2): `sourceToFilename(source)`, `dedupeSources(chunks)`, `isBelowRelevanceFloor(chunks, minScore)`.

- [ ] **Step 1: Write the failing tests** — `server/services/ask.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceToFilename, dedupeSources, isBelowRelevanceFloor } from './ask.js';

test('sourceToFilename strips the dropbox prefix and returns the basename', () => {
  assert.equal(sourceToFilename('dropbox:/01. Professional/AI Tools/foo.pdf'), 'foo.pdf');
  assert.equal(sourceToFilename('dropbox:/nested/path/a b c.md'), 'a b c.md');
  assert.equal(sourceToFilename('bare.txt'), 'bare.txt');
  assert.equal(sourceToFilename(''), '');
  assert.equal(sourceToFilename(null), '');
});

test('dedupeSources keeps the highest score per file, sorted desc, capped at 5', () => {
  const chunks = [
    { source: 'dropbox:/x/a.pdf', score: 0.4 },
    { source: 'dropbox:/x/a.pdf', score: 0.9 }, // same file, higher
    { source: 'dropbox:/x/b.pdf', score: 0.6 },
    { source: 'dropbox:/x/c.pdf', score: 0.1 },
    { source: 'dropbox:/x/d.pdf', score: 0.2 },
    { source: 'dropbox:/x/e.pdf', score: 0.3 },
    { source: 'dropbox:/x/f.pdf', score: 0.35 },
  ];
  const out = dedupeSources(chunks);
  assert.equal(out.length, 5);
  assert.deepEqual(out[0], { filename: 'a.pdf', score: 0.9 });
  assert.deepEqual(out[1], { filename: 'b.pdf', score: 0.6 });
  assert.ok(out.every((s, i) => i === 0 || out[i - 1].score >= s.score));
});

test('dedupeSources tolerates empty/missing sources', () => {
  assert.deepEqual(dedupeSources([]), []);
  assert.deepEqual(dedupeSources([{ source: '', score: 0.9 }]), []);
});

test('isBelowRelevanceFloor is true when empty or top score below the floor', () => {
  assert.equal(isBelowRelevanceFloor([], 0.15), true);
  assert.equal(isBelowRelevanceFloor([{ score: 0.1 }], 0.15), true);
  assert.equal(isBelowRelevanceFloor([{ score: 0.2 }, { score: 0.9 }], 0.15), false);
});
```

- [ ] **Step 2: Run to verify failure** — `node --test server/services/ask.test.js` → FAIL (`Cannot find module './ask.js'`).

- [ ] **Step 3: Implement** — `server/services/ask.js`:

```js
// Pure helpers for the Ask (knowledge-base Q&A) route. No I/O — unit-tested.

export function sourceToFilename(source) {
  if (typeof source !== 'string' || !source) return '';
  const withoutPrefix = source.replace(/^dropbox:/, '');
  const parts = withoutPrefix.split('/');
  return parts[parts.length - 1] || '';
}

// Highest score per file, sorted desc, capped at 5. Chunks with no derivable
// filename are dropped.
export function dedupeSources(chunks) {
  const best = new Map();
  for (const c of chunks || []) {
    const filename = sourceToFilename(c && c.source);
    if (!filename) continue;
    const score = typeof c.score === 'number' ? c.score : 0;
    if (!best.has(filename) || score > best.get(filename)) best.set(filename, score);
  }
  return [...best.entries()]
    .map(([filename, score]) => ({ filename, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function isBelowRelevanceFloor(chunks, minScore) {
  if (!Array.isArray(chunks) || chunks.length === 0) return true;
  const top = Math.max(...chunks.map((c) => (typeof c.score === 'number' ? c.score : 0)));
  return top < minScore;
}
```

- [ ] **Step 4: Verify** — `node --test server/services/ask.test.js` → all pass.
- [ ] **Step 5: Commit** — `git add server/services/ask.js server/services/ask.test.js && git commit -m "feat(ask): pure helpers — sourceToFilename, dedupeSources, relevance floor"`

---

### Task 2: `POST /api/ask` route

**Files:**
- Create: `server/routes/ask.js`
- Modify: `server/index.js` (import + mount)
- Test: `tests/ask-route.test.js` (source-regression, mirrors `tests/session-start-regression.test.js` style)

**Interfaces:**
- Consumes: `retrieveRelevant`, `formatRetrievedForPrompt` from `../services/knowledge-base.js`; `sourceToFilename`, `dedupeSources`, `isBelowRelevanceFloor` from `../services/ask.js`; default `anthropic` from `../config/anthropic.js`; `requireAuth` from `../middleware/auth.js`.
- Produces: `POST /api/ask` → `{ answer: string, sources: { filename, score }[] }`.

- [ ] **Step 1: Write the failing test** — `tests/ask-route.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (...p) => fs.readFileSync(path.resolve(__dirname, '..', ...p), 'utf8');
const routeSrc = read('server', 'routes', 'ask.js');
const indexSrc = read('server', 'index.js');

test('ask route is auth-gated and retrieves from the knowledge base', () => {
  assert.match(routeSrc, /requireAuth/, 'must require auth');
  assert.match(routeSrc, /retrieveRelevant\(/, 'must retrieve KB chunks');
  assert.match(routeSrc, /formatRetrievedForPrompt\(/, 'must format chunks into the prompt');
});

test('ask route grounds strictly and returns answer + sources', () => {
  assert.match(routeSrc, /dedupeSources\(/, 'must build de-duplicated sources');
  assert.match(routeSrc, /isBelowRelevanceFloor\(/, 'must short-circuit below the relevance floor');
  assert.match(routeSrc, /ANTHROPIC|anthropic\.messages\.create/, 'must call the LLM abstraction');
});

test('ask route is mounted in server index', () => {
  assert.match(indexSrc, /routes\/ask\.js/, 'must import the ask route');
  assert.match(indexSrc, /app\.use\(\s*['"]\/api\/ask['"]/, 'must mount at /api/ask');
});
```

- [ ] **Step 2: Run to verify failure** — `node --test tests/ask-route.test.js` → FAIL (module not found / mount missing).

- [ ] **Step 3: Implement the route** — `server/routes/ask.js`:

```js
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
  'You are a precise librarian answering questions ONLY from the user\'s own saved library.',
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
```

- [ ] **Step 4: Mount in `server/index.js`** — add the import next to `import goalsRoutes` and the mount next to `app.use('/api/goals'...)`:

```js
import askRoutes from './routes/ask.js';
```
```js
app.use('/api/ask', askRoutes);
```

- [ ] **Step 5: Verify** — `node --test tests/ask-route.test.js` passes. Boot-probe: start the server on a spare port and confirm `POST /api/ask` with `{}` returns 400 (auth is bypassed for `default-user` locally) and a real question returns `{ answer, sources }` (answer will be NOT_FOUND locally if the KB isn't configured — that's fine, it proves the wiring).

```bash
PORT=3011 node server/index.js &  # then:
curl -s -X POST localhost:3011/api/ask -H 'Content-Type: application/json' -d '{}'          # -> {"error":"Ask a question first."}
curl -s -X POST localhost:3011/api/ask -H 'Content-Type: application/json' -d '{"question":"hello"}'  # -> {"answer":...,"sources":[...]}
```

- [ ] **Step 6: Commit** — `git add server/routes/ask.js server/index.js tests/ask-route.test.js && git commit -m "feat(ask): POST /api/ask — strict KB-grounded Q&A with sources"`

---

### Task 3: API client method

**Files:**
- Modify: `src/services/api.ts` (add `ask` next to the voice methods)

**Interfaces:**
- Produces (consumed by Task 4): `api.ask(question, history) => Promise<{ answer: string; sources: { filename: string; score: number }[] }>`.

- [ ] **Step 1: Implement** — add inside the `api` object (e.g. just after `voiceSpeak`):

```ts
  // ── Ask (knowledge-base Q&A) ──
  ask: (question: string, history: { role: 'user' | 'assistant'; content: string }[]) =>
    request<{ answer: string; sources: { filename: string; score: number }[] }>(
      '/ask',
      { method: 'POST', body: JSON.stringify({ question, history }) },
    ),
```

- [ ] **Step 2: Verify** — `npx tsc -b` clean.
- [ ] **Step 3: Commit** — `git add src/services/api.ts && git commit -m "feat(ask): api.ask client method"`

---

### Task 4: `Ask` screen

**Files:**
- Create: `src/pages/rd/Ask.tsx`

**Interfaces:**
- Consumes: `api.ask` (Task 3), `Screen`/`Card` rd primitives (optional), `--rd-*` tokens.
- Produces: `export default function Ask()` — the `/ask` route element (Task 5).

- [ ] **Step 1: Implement** — `src/pages/rd/Ask.tsx`:

```tsx
import { useRef, useState } from 'react';
import { api } from '../../services/api';

interface Turn { question: string; answer: string; sources: { filename: string; score: number }[]; }

export default function Ask() {
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setError(null);
    setLoading(true);
    const history = turns.flatMap((t) => [
      { role: 'user' as const, content: t.question },
      { role: 'assistant' as const, content: t.answer },
    ]);
    try {
      const { answer, sources } = await api.ask(q, history);
      setTurns((prev) => [...prev, { question: q, answer, sources }]);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }));
    } catch (err: any) {
      setError(err.message || 'Something went wrong — try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: 'var(--rd-ink)', fontFamily: 'var(--font-sans)' }}>
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 'calc(env(safe-area-inset-top) + 20px) 20px 12px' }}>
        <div style={{ maxWidth: 440, margin: '0 auto' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 28, margin: '0 0 6px' }}>Ask your library</h1>
          <div style={{ fontSize: 14, color: 'var(--rd-muted)', lineHeight: 1.55, marginBottom: 24 }}>
            Answers come only from what you've saved. Nothing is kept here.
          </div>

          {turns.length === 0 && !loading && (
            <div style={{ fontSize: 14, color: 'var(--rd-muted-2)', lineHeight: 1.6 }}>
              Ask anything — “What does the material say about limiting beliefs?”
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

          {loading && (
            <div style={{ fontSize: 14, color: 'var(--rd-muted)', fontStyle: 'italic' }}>Searching your library…</div>
          )}
          {error && (
            <div style={{ fontSize: 13, color: 'var(--rd-danger)', marginTop: 8 }}>{error}</div>
          )}
        </div>
      </div>

      <form onSubmit={submit} style={{ flexShrink: 0, padding: '10px 16px calc(env(safe-area-inset-bottom) + 10px)', borderTop: '1px solid var(--rd-border)', background: 'var(--rd-bg)' }}>
        <div style={{ maxWidth: 440, margin: '0 auto', display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            style={{ flex: 1, background: 'var(--rd-surface)', border: '1px solid var(--rd-border)', borderRadius: 999, padding: '11px 16px', color: 'var(--rd-ink)', fontSize: 15, fontFamily: 'var(--font-sans)' }}
          />
          <button type="submit" disabled={!input.trim() || loading} style={{ flexShrink: 0, border: 'none', borderRadius: 999, padding: '0 18px', fontSize: 14, fontWeight: 600, cursor: input.trim() && !loading ? 'pointer' : 'default', background: input.trim() && !loading ? 'var(--rd-accent)' : 'var(--rd-surface)', color: input.trim() && !loading ? '#06121c' : 'var(--rd-dim)' }}>Ask</button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify** — `npx tsc -b` clean (screen not yet routed; Task 5 wires it).
- [ ] **Step 3: Commit** — `git add src/pages/rd/Ask.tsx && git commit -m "feat(ask): Ask screen — Q&A with source chips"`

---

### Task 5: Route + bottom-nav tab

**Files:**
- Modify: `src/App.tsx` (lazy import + route in both blocks)
- Modify: `src/components/rd/BottomNav.tsx` (add tab, 7-cell grid)

- [ ] **Step 1: App.tsx** — add the lazy import next to the others:

```tsx
const Ask = lazy(() => import('./pages/rd/Ask'));
```
Add the route inside BOTH `<Route element={<AppShell />}>` blocks (the authed `AuthenticatedApp` and the `UnauthenticatedApp` fallback), next to `/goals`:

```tsx
          <Route path="/ask" element={<Ask />} />
```

- [ ] **Step 2: BottomNav.tsx** — add the Ask tab to `TABS` (after Goals) and render 7 cells with the orb centered. Replace the `TABS` array and the grid:

```tsx
const TABS = [
  { to: '/', label: 'Home', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
  { to: '/goals', label: 'Goals', icon: 'M6 21V3M6 4h11l-2.5 3.5L17 11H6' },
  { to: '/ask', label: 'Ask', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM12 8v3M12 14h.01' },
  { to: '/insights', label: 'Insights', icon: 'M4 19V10M10 19V5M16 19v-7M22 19H2' },
  { to: '/library', label: 'Library', icon: 'M4 5h16v14H4zM8 5v14' },
  { to: '/you', label: 'You', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0' },
];
```
Change the grid template and the cell layout (3 tabs, orb, 3 tabs):

```tsx
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', alignItems: 'center',
```
```tsx
          {[TABS[0], TABS[1], TABS[2]].map(t => <Tab key={t.to} {...t} />)}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button aria-label="Start a session" onClick={() => setChooser(true)} style={{
              width: 46, height: 46, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'radial-gradient(circle at 30% 30%, var(--rd-accent-bright), var(--rd-accent-deep))',
              boxShadow: '0 0 24px var(--rd-accent-glow)',
            }} />
          </div>
          {[TABS[3], TABS[4], TABS[5]].map(t => <Tab key={t.to} {...t} />)}
```

(Keep the existing `<Tab>` component and everything else unchanged.)

- [ ] **Step 3: Verify** — `npx tsc -b` clean; `npm run test:web` green; `npm run build` succeeds.
- [ ] **Step 4: Manual smoke (browser)** — dev server with backend on a spare port + vite proxy: the Ask tab appears (7 cells, orb centered); asking a question about a known library topic returns an answer with source chips; an off-topic question returns the "not in your library" answer with no chips. Then revert any temp vite proxy change.
- [ ] **Step 5: Commit** — `git add src/App.tsx src/components/rd/BottomNav.tsx && git commit -m "feat(ask): /ask route + Ask bottom-nav tab (7-cell)"`

---

### Task 6: QC, deploy, live-verify

- [ ] **Step 1:** Full suites: `npm run test:web`, `node --test tests/*.test.js server/services/*.test.js`, `node --experimental-strip-types --test tests/*.test.ts`, `npx tsc -b`, `npm run build` — all green.
- [ ] **Step 2:** Push `main`; Vercel + Railway auto-deploy.
- [ ] **Step 3:** Live-verify: grep the live `index-*.js` for a distinctive Ask string (`Ask your library`); confirm `POST /api/ask` on Railway returns 401 unauthenticated (mounted, not 404). Fall back to `vercel --prod --yes` if the webhook is stale.
- [ ] **Step 4:** On-device pass (installed PWA, close+reopen twice): Ask tab present, real answer + source chips for a covered topic, graceful decline for an off-topic one.

---

## Self-review notes

- Spec coverage: strict KB-only grounding (Task 2 system prompt + relevance floor), source citations (Task 1 `dedupeSources` → Task 2 response → Task 4 chips), new Ask tab 7-cell nav (Task 5), stateless/no-persistence (Task 2 no DB writes; Task 4 in-visit history only), separate from coaching pipeline (new route), non-streaming "thinking…" (Task 4 `loading`), tests (Tasks 1/2 + Task 5 smoke).
- Type consistency: `{ answer, sources: { filename, score }[] }` is identical across Task 2 (route), Task 3 (`api.ask`), and Task 4 (`Turn`/render). `dedupeSources` returns `{ filename, score }` used verbatim.
- No placeholders; every code step is complete.
