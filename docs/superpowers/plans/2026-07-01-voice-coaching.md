# Voice Coaching (Real-time Call) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real-time, barge-in voice coaching call as an additional channel alongside text, using ElevenLabs Agents for the voice layer and Claude (+ the existing NLP digest + RAG pipeline) as the brain, so voice is as effective as text and shares one session/history.

**Architecture:** ElevenLabs Agent handles mic/turn-taking/barge-in/STT/TTS. Its "Custom LLM" points at a new Railway endpoint `/api/voice/llm` (OpenAI-compatible streaming) that reuses `buildSystemPrompt` + RAG and streams Claude. `/api/voice/session` mints signed URLs (Clerk-authed). A signature-verified post-call webhook persists the transcript into the shared coaching session and runs the values/identity analysis. Frontend adds a `/call` screen via `@elevenlabs/react`.

**Tech Stack:** Node/Express (ESM) on Railway, React 19 + Vite, `@elevenlabs/react`, `@anthropic-ai/sdk`, Pinecone (`sacred-heart`), Clerk, `node:test`.

## Global Constraints

- Backend is ESM; run/tests use `node --experimental-sqlite`. Keep all existing server tests green.
- DB is `node:sqlite` on Railway volume `/app/storage`; do not commit the seed DB.
- Browser chat traffic hits **Railway** (`VITE_API_URL`), not the Vercel function — new endpoints must exist in `server/index.js` (Railway is authoritative). Mirror into `api/index.js` only if kept in parity.
- Never expose `ELEVENLABS_API_KEY` client-side. `/api/voice/llm` is not behind Clerk JWT — it authenticates via a shared secret (`Authorization: Bearer <VOICE_LLM_SECRET>`).
- `userId` is bound server-side from the signed session, never trusted from request bodies.
- Coaching brain must remain Claude + condensed NLP digest (`renderNlpDigest`) + RAG (`retrieveByCategory`). No alternate model for the coaching reply.
- Model id: `claude-sonnet-4-6`.
- Commit after each task. Branch: `feature/voice-coaching`.

---

## Part A — Unblocked bug fixes (do first; independent of the voice gate)

### Task 1: Fix Intel/Insights page not populating

**Files:**
- Investigate: `src/pages/Insights.tsx`, `src/services/api.ts` (analytics/profile calls it uses), relevant `server/routes/*.js`
- Modify: `src/pages/Insights.tsx` (+ backend route if the fault is server-side)
- Test: manual (frontend), plus a backend `node:test` if a route returns wrong shape

- [ ] **Step 1: Reproduce + capture the real error.** Run the app locally (`npm run dev` + backend) OR inspect against prod: open the Intel page and read the network response for its data call(s). Identify whether it 4xx/5xx, returns empty, or throws in render.

```bash
# List what Insights.tsx actually calls, then hit those endpoints against prod with a Clerk token.
cd ~/nlp-trainer && grep -n "api\.\|useEffect\|catch\|setError\|return null\|navigate(" src/pages/Insights.tsx
```

- [ ] **Step 2: Classify the fault.** One of: (a) data call errors → backend fix; (b) returns `[]`/`{}` and the page renders nothing/redirects → empty-state UI; (c) access-gate/`useAccessGate` redirect firing → gating fix. Write down which.

- [ ] **Step 3: If backend shape/500 — add a failing `node:test`** asserting the endpoint returns the expected shape for a user with data (mock DB like existing `*.test.js`), then fix the handler minimally.

- [ ] **Step 4: If frontend — add a visible empty/error state** so it never silently blanks:

```tsx
// In Insights.tsx render, replace any silent `return null`/redirect-on-empty with:
if (error) return <div className="p-6 text-sm text-red-300">Couldn’t load your intel: {error}</div>;
if (!loading && isEmpty(data)) return <div className="p-6 text-sm text-gray-400">No intel yet — have a few coaching sessions and this fills in.</div>;
```

- [ ] **Step 5: Verify** on device/browser: Intel opens and shows data or a clear state (never a blank flash-then-gone). Run `cd server && node --experimental-sqlite --test` (green).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "fix(insights): surface data/empty/error state so Intel never silently blanks"
```

### Task 2: Fix mobile-backgrounding cancelling + losing the reply (text chat)

**Files:**
- Modify: `server/routes/hypnosis.js` (`POST /chat` — ensure persistence is independent of client connection)
- Modify: `src/pages/Hypnosis.tsx` (re-sync session on foreground/return)
- Test: `server/routes/hypnosis.test.js` (create if absent) for the persistence guarantee

**Interfaces:**
- Consumes: existing `updateSessionMessages`, `getSessionForUser` from `../services/memory.js`
- Produces: nothing new for other tasks

- [ ] **Step 1: Write a failing test** proving the assistant turn is persisted even if the HTTP response is never read. Simulate by calling the handler with a mocked `res` whose `.json()` is a no-op and asserting `updateSessionMessages` was called with the assistant reply (mock the anthropic client to return a fixed parsed reply).

```js
// server/routes/hypnosis.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
// Arrange: mock memory.updateSessionMessages to record calls; mock anthropic.create
// to return a reply; invoke the chat handler; assert the assistant message was saved.
```

- [ ] **Step 2: Run it, watch it fail.** `cd server && node --experimental-sqlite --test routes/hypnosis.test.js` → FAIL.

- [ ] **Step 3: Make persistence connection-independent.** In `hypnosis.js` `/chat`, move `updateSessionMessages(...)` (assistant turn) to run **before** `res.json(...)` and unconditionally (it already runs before res.json today — confirm; if any early-return path skips it, fix). On Railway the request completes server-side even if the client aborts, so the turn is saved. Ensure no `req.on('close')`/abort logic cancels the Claude call.

- [ ] **Step 4: Run test → PASS.**

- [ ] **Step 5: Client re-sync on return.** In `Hypnosis.tsx`, add a `visibilitychange` listener: when the tab becomes visible again, re-fetch the session (`api.hypnosisInit({ sessionId })`) and merge any assistant turn the client missed.

```tsx
useEffect(() => {
  const onVisible = () => {
    if (document.visibilityState === 'visible' && sessionId) {
      api.hypnosisInit({ sessionId }).then(d => {
        if (d.resumeMessages?.length) setMessages(sanitize(d.resumeMessages));
      }).catch(() => {});
    }
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => document.removeEventListener('visibilitychange', onVisible);
}, [sessionId]);
```

- [ ] **Step 6: Verify on iPad:** send a message, immediately switch apps for ~15s, return → the reply is there. Run full `node --experimental-sqlite --test` (green).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "fix(chat): persist reply server-side regardless of client + resync session on foreground"
```

---

## Part B — Voice feature (GATED on Task 3)

### Task 3: GATE — iOS microphone spike on the real iPad

**Files:**
- Create: `public/mic-test.html` (a standalone, dependency-free page)

**Success criteria:** a definitive yes/no on `getUserMedia` in (a) Safari tab and (b) installed home-screen PWA, on Max's actual iOS version.

- [ ] **Step 1: Create the test page.**

```html
<!-- public/mic-test.html -->
<!doctype html><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Mic Test</title><body style="font:16px system-ui;padding:24px">
<h1>Mic test</h1>
<p id=mode></p>
<button id=go style="font-size:18px;padding:12px 20px">Tap to test mic</button>
<pre id=out></pre>
<script>
  const out = m => document.getElementById('out').textContent += m + "\n";
  document.getElementById('mode').textContent =
    'standalone (installed PWA): ' + (window.navigator.standalone === true);
  document.getElementById('go').onclick = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      out('OK: got audio stream, tracks=' + s.getAudioTracks().length);
      s.getTracks().forEach(t => t.stop());
    } catch (e) { out('FAIL: ' + e.name + ' — ' + e.message); }
  };
</script>
```

- [ ] **Step 2: Ship it** (it's static; deploys with the frontend). `git add public/mic-test.html && git commit -m "chore: iOS mic capability test page" && git push origin feature/voice-coaching` — then merge to main or open on the branch preview.

- [ ] **Step 3: Max tests on iPad.** Open `heart.sovereignty.app/mic-test.html` (A) in a **Safari tab** and (B) from the **home-screen app**. Tap the button in each; report the OK/FAIL line and the `standalone:` value.

- [ ] **Step 4: Record the decision** in `docs/superpowers/specs/2026-07-01-voice-coaching-design.md` §12.1:
  - Both OK → proceed to Task 4.
  - Only Safari-tab OK → proceed, but Task 9 adds a "standalone detected → open in Safari to talk" affordance.
  - Neither OK → STOP; escalate (native/Capacitor wrapper) before building further.

- [ ] **Step 5: Commit** the recorded decision.

### Task 4: ElevenLabs agent + env scaffolding (config)

**Files:**
- Modify: `.env.example` (document new vars), Railway env (set real values), Vercel env (client vars)

- [ ] **Step 1: Create the agent** in the ElevenLabs dashboard: voice = your default coach voice; set **Custom LLM** URL to `https://nlp-training-backend-production.up.railway.app/api/voice/llm`; set the custom-LLM API key/secret to a strong random value; enable a **post-call webhook** to `.../api/voice/webhook` with a signing secret.

- [ ] **Step 2: Add env vars.** Railway: `ELEVENLABS_AGENT_ID`, `VOICE_LLM_SECRET` (matches the custom-LLM key), `ELEVENLABS_WEBHOOK_SECRET`. `ELEVENLABS_API_KEY` already set. Vercel (client): `VITE_ELEVENLABS_AGENT_ID` (public agent id is fine client-side). Document all in `.env.example`.

```bash
# .env.example additions
ELEVENLABS_AGENT_ID=agent_xxx
VOICE_LLM_SECRET=change_me_strong_random
ELEVENLABS_WEBHOOK_SECRET=change_me_from_dashboard
# client
VITE_ELEVENLABS_AGENT_ID=agent_xxx
```

- [ ] **Step 3: Commit** `.env.example`.

### Task 5: OpenAI-SSE streaming translation helper

**Files:**
- Create: `server/services/openai-sse.js`
- Test: `server/services/openai-sse.test.js`

**Interfaces:**
- Produces:
  - `openAiChunk(id, model, deltaText): string` → one `data: {json}\n\n` line (a `chat.completion.chunk` with `choices[0].delta.content`).
  - `openAiDone(): string` → `data: [DONE]\n\n`.
  - `openAiFinalChunk(id, model): string` → a terminating chunk with `finish_reason: "stop"`.

- [ ] **Step 1: Failing test.**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { openAiChunk, openAiDone, openAiFinalChunk } from './openai-sse.js';

test('openAiChunk emits an OpenAI-shaped SSE data line with the delta', () => {
  const line = openAiChunk('id1', 'claude-sonnet-4-6', 'Hello');
  assert.ok(line.startsWith('data: '));
  assert.ok(line.endsWith('\n\n'));
  const json = JSON.parse(line.slice(6).trim());
  assert.equal(json.object, 'chat.completion.chunk');
  assert.equal(json.choices[0].delta.content, 'Hello');
});
test('openAiDone terminates the stream', () => {
  assert.equal(openAiDone(), 'data: [DONE]\n\n');
});
test('openAiFinalChunk sets finish_reason stop', () => {
  const json = JSON.parse(openAiFinalChunk('id1', 'claude-sonnet-4-6').slice(6).trim());
  assert.equal(json.choices[0].finish_reason, 'stop');
});
```

- [ ] **Step 2: Run → FAIL.** `cd server && node --experimental-sqlite --test services/openai-sse.test.js`

- [ ] **Step 3: Implement.**

```js
// server/services/openai-sse.js
function base(id, model) {
  return { id, object: 'chat.completion.chunk', created: 0, model };
}
export function openAiChunk(id, model, deltaText) {
  const payload = { ...base(id, model), choices: [{ index: 0, delta: { content: deltaText }, finish_reason: null }] };
  return `data: ${JSON.stringify(payload)}\n\n`;
}
export function openAiFinalChunk(id, model) {
  const payload = { ...base(id, model), choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] };
  return `data: ${JSON.stringify(payload)}\n\n`;
}
export function openAiDone() {
  return 'data: [DONE]\n\n';
}
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** `git add server/services/openai-sse.* && git commit -m "feat(voice): OpenAI-compatible SSE chunk helpers"`

### Task 6: `/api/voice/llm` — the Claude coaching brain (streaming, authed)

**Files:**
- Create: `server/routes/voice.js`
- Modify: `server/index.js` (mount `app.use('/api/voice', voiceRoutes)` — BEFORE the Clerk `extractUserId` gate, since this route uses shared-secret auth, not the user JWT)
- Test: `server/routes/voice.test.js`

**Interfaces:**
- Consumes: `buildSystemPrompt` (export it from `hypnosis.js` — see Step 1), `openAiChunk/openAiFinalChunk/openAiDone`, `anthropic` (`../config/anthropic.js`), Anthropic streaming.
- Produces: `POST /api/voice/llm` (OpenAI Chat Completions streaming).

- [ ] **Step 1: Export `buildSystemPrompt`.** In `server/routes/hypnosis.js`, change `async function buildSystemPrompt(...)` to `export async function buildSystemPrompt(...)` so voice reuses the identical brain. (Confirm no name clash.)

- [ ] **Step 2: Failing test — auth gate.** A request without the correct Bearer secret returns 401.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { voiceLlmHandler } from './voice.js';  // export the handler for testing

function makeRes() {
  return { statusCode: 200, headers: {}, chunks: [], ended: false,
    status(c){ this.statusCode=c; return this; },
    set(k,v){ this.headers[k]=v; return this; },
    setHeader(k,v){ this.headers[k]=v; },
    write(s){ this.chunks.push(s); return true; },
    json(o){ this.body=o; return this; },
    end(){ this.ended=true; return this; } };
}

test('rejects when Bearer secret is missing/wrong', async () => {
  process.env.VOICE_LLM_SECRET = 'sekret';
  const req = { headers: {}, body: { messages: [{ role: 'user', content: 'hi' }] } };
  const res = makeRes();
  await voiceLlmHandler(req, res, { anthropic: null });
  assert.equal(res.statusCode, 401);
});
```

- [ ] **Step 3: Run → FAIL.**

- [ ] **Step 4: Failing test — streams OpenAI chunks from a mocked Claude stream.**

```js
test('streams reply as OpenAI SSE chunks and ends with [DONE]', async () => {
  process.env.VOICE_LLM_SECRET = 'sekret';
  const fakeAnthropic = { messages: { async *stream() {} } };
  // Mocked streaming client: yields text deltas
  const anthropic = { messages: { create: async () => ({
    async *[Symbol.asyncIterator]() {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hel' } };
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'lo' } };
    }
  }) } };
  const req = { headers: { authorization: 'Bearer sekret' },
    body: { messages: [{ role: 'user', content: 'hi' }],
            elevenlabs_extra_body: { sessionId: 's1', userId: 'u1' }, stream: true } };
  const res = makeRes();
  await voiceLlmHandler(req, res, { anthropic, buildSystemPromptFn: async () => 'SYS' });
  const body = res.chunks.join('');
  assert.ok(body.includes('"content":"Hel"'));
  assert.ok(body.includes('"content":"lo"'));
  assert.ok(body.trim().endsWith('data: [DONE]'));
});
```

- [ ] **Step 5: Run → FAIL.**

- [ ] **Step 6: Implement `voice.js`.**

```js
// server/routes/voice.js
import { Router } from 'express';
import anthropicDefault from '../config/anthropic.js';
import { buildSystemPrompt } from './hypnosis.js';
import { openAiChunk, openAiFinalChunk, openAiDone } from '../services/openai-sse.js';

const VOICE_DELIVERY = '\n\nYou are speaking OUT LOUD in a live voice call. Reply in natural spoken language: no markdown, no JSON, no lists. Be substantive and specific — do not shorten the coaching — but phrase it conversationally. Ask one question at a time.';

function lastUserText(messages = []) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') return String(messages[i].content || '');
  }
  return '';
}

// Exported for tests; deps injectable.
export async function voiceLlmHandler(req, res, deps = {}) {
  const anthropic = deps.anthropic ?? anthropicDefault;
  const buildSystemPromptFn = deps.buildSystemPromptFn ?? buildSystemPrompt;

  const auth = req.headers.authorization || '';
  if (!process.env.VOICE_LLM_SECRET || auth !== `Bearer ${process.env.VOICE_LLM_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { messages = [], elevenlabs_extra_body: extra = {} } = req.body || {};
  const sessionId = extra.sessionId || null;
  const userId = extra.userId || null;   // bound at session-mint time; see Task 7
  const utterance = lastUserText(messages);

  const system = (await buildSystemPromptFn(userId, 'coaching', utterance)) + VOICE_DELIVERY;
  const convo = messages.filter(m => m.role === 'user' || m.role === 'assistant')
                        .map(m => ({ role: m.role, content: String(m.content) }));

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const id = `chatcmpl_${sessionId || 'anon'}`;
  const model = 'claude-sonnet-4-6';
  try {
    const stream = await anthropic.messages.create({
      model, max_tokens: 1024, system, messages: convo, stream: true,
    });
    for await (const event of stream) {
      if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        res.write(openAiChunk(id, model, event.delta.text));
      }
    }
    res.write(openAiFinalChunk(id, model));
    res.write(openAiDone());
    res.end();
  } catch (err) {
    console.error('[voice/llm] stream error:', err.message);
    // Best-effort graceful close so the agent doesn't hang.
    try { res.write(openAiChunk(id, model, ' Sorry, I lost my train of thought — could you say that again?')); res.write(openAiFinalChunk(id, model)); res.write(openAiDone()); res.end(); } catch {}
  }
}

const router = Router();
router.post('/llm', (req, res) => voiceLlmHandler(req, res));
export default router;
```

Note: if `anthropic.messages.create` in this project is the fallback wrapper (not the raw SDK) and does not support `stream: true`, add a `createStream` path in `config/anthropic.js` that calls the raw Anthropic SDK streaming for the primary provider and falls back to non-streamed (emit as one chunk) for OpenAI/Gemini. Verify during Step 6 and adjust.

- [ ] **Step 7: Mount the route** in `server/index.js` above `app.use('/api', extractUserId)`:

```js
import voiceRoutes from './routes/voice.js';
app.use('/api/voice', voiceRoutes);
```

- [ ] **Step 8: Run tests → PASS.** `cd server && node --experimental-sqlite --test routes/voice.test.js`
- [ ] **Step 9: Commit** `git add -A && git commit -m "feat(voice): /api/voice/llm streaming Claude coaching brain (shared prompt+RAG)"`

### Task 7: `/api/voice/session` — signed-URL minting (Clerk-authed)

**Files:**
- Modify: `server/routes/voice.js` (add `POST /session`), `src/services/api.ts` (client method)
- Test: `server/routes/voice.test.js`

**Interfaces:**
- Consumes: Clerk `req.userId` (this route IS behind the user gate — mount a second router, or check auth inline), `getTodaySession`/`createSession` from `../services/memory.js`, ElevenLabs REST (`GET /v1/convai/conversation/get-signed-url?agent_id=...` with `xi-api-key`).
- Produces: `POST /api/voice/session` → `{ signedUrl, sessionId }`, and stores `userId↔sessionId` so the webhook + llm can bind `userId` server-side (do NOT rely on client-passed userId).

- [ ] **Step 1: Failing test** — returns 401 without a user; returns `{signedUrl, sessionId}` with a mocked ElevenLabs fetch and mocked session.

- [ ] **Step 2: Implement.** Because `/api/voice/llm` must stay outside the Clerk gate but `/session` must be inside it, mount `/session` on the authenticated router (`server/index.js` after `extractUserId`) as `app.use('/api/voice-session', voiceSessionRoutes)` OR check `req.userId` inside. Handler:

```js
// in voice.js (session handler; deps injectable for tests)
export async function voiceSessionHandler(req, res, deps = {}) {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  const fetchFn = deps.fetch ?? fetch;
  const { getOrCreateSession } = deps.memory ?? await import('../services/memory.js');
  const session = deps.session ?? await getOrCreateSessionForToday(userId); // reuse existing helpers
  const url = `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(process.env.ELEVENLABS_AGENT_ID)}`;
  const r = await fetchFn(url, { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } });
  if (!r.ok) return res.status(502).json({ error: 'could not start voice session' });
  const { signed_url: signedUrl } = await r.json();
  // Persist the userId↔sessionId binding so the webhook can attribute the transcript.
  rememberVoiceSession(session.id, userId);   // small table or in-memory+DB; see Step 3
  res.json({ signedUrl, sessionId: session.id });
}
```

- [ ] **Step 3: Bind userId↔sessionId** in a `voice_sessions(session_id PRIMARY KEY, user_id, created_at)` table (lazy `CREATE TABLE IF NOT EXISTS`, same pattern as `kb_documents`). The client passes `sessionId` to the agent as a dynamic variable → it arrives in `/api/voice/llm` and the webhook via `elevenlabs_extra_body`; both look up `userId` from this table rather than trusting the payload.

- [ ] **Step 4: Client method** in `src/services/api.ts`:

```ts
startVoiceSession: () => request<{ signedUrl: string; sessionId: string }>(
  '/voice-session', { method: 'POST' }),
```

- [ ] **Step 5: Run tests → PASS. Commit** `git commit -am "feat(voice): signed-URL session mint + userId/session binding"`

### Task 8: `/api/voice/webhook` — transcript persistence + analysis

**Files:**
- Modify: `server/routes/voice.js` (add `POST /webhook`), `server/index.js` (mount raw-body for signature verify, outside Clerk gate)
- Test: `server/routes/voice.test.js`

**Interfaces:**
- Consumes: `updateSessionMessages`, `updateSessionMetadata` from `../services/memory.js`; the deferred analysis logic from `hypnosis.js` (extract the value/identity analysis into an exported `runCoachingAnalysis(userId, sessionId, messages)` so both text and voice reuse it — DRY); `deferTask`.
- Produces: `POST /api/voice/webhook` (200 on accept).

- [ ] **Step 1: Extract shared analysis.** In `hypnosis.js`, move the deferred value/identity block into `export async function runCoachingAnalysis(userId, sessionId, systemPrompt, apiMessages)` and call it from both the text `/chat` deferred task and the voice webhook. Keep behavior identical (existing tests green).

- [ ] **Step 2: Failing test** — a signed sample payload persists the transcript into the session and schedules analysis; an unsigned payload is rejected 401.

- [ ] **Step 3: Implement webhook.** Verify ElevenLabs signature (HMAC over raw body with `ELEVENLABS_WEBHOOK_SECRET`), parse the transcript + `sessionId` (from conversation metadata/dynamic vars), map to `userId` via `voice_sessions`, `updateSessionMessages(sessionId, transcriptMessages)`, then `deferTask(() => runCoachingAnalysis(...))`.

- [ ] **Step 4: Run tests → PASS. Commit** `git commit -am "feat(voice): post-call webhook persists transcript to shared session + analysis"`

### Task 9: Frontend Call screen

**Files:**
- Create: `src/pages/Call.tsx`
- Modify: `src/App.tsx` (lazy import + routes `/call` in both authed blocks), `src/components/Layout.tsx` (nav item in `ops`), `package.json` (`@elevenlabs/react`)
- Test: manual on iPad (component-level; keep tsc/build green)

- [ ] **Step 1: Install SDK.** `npm install @elevenlabs/react --legacy-peer-deps` (root). Commit lockfile.

- [ ] **Step 2: Build `Call.tsx`** using `useConversation` from `@elevenlabs/react`: pre-call voice picker (reuse `api.listVoices()`), Start Call button (requests mic on gesture), in-call captions from conversation messages, Mute + End controls. On Start: `const { signedUrl, sessionId } = await api.startVoiceSession();` then `conversation.startSession({ signedUrl, dynamicVariables: { sessionId } });`. (Confirm the exact `@elevenlabs/react` prop names during the spike; adjust.)

- [ ] **Step 3: Standalone-mode guard (only if Task 3 decided "Safari-tab only").** If `window.navigator.standalone === true`, show "Voice calls need Safari — tap to open" linking to the same route in a browser tab; otherwise render the call UI.

- [ ] **Step 4: Nav + routes.** Add `{ to: '/call', label: 'Call', icon: <phone svg>, section: 'ops' }` to `navItems`; add `<Route path="/call" element={<Call />} />` in both route blocks in `App.tsx`; lazy import.

- [ ] **Step 5: Build check.** `npm run build` (tsc + vite) green.

- [ ] **Step 6: Manual verify on iPad** (per Task 3 path): start a call, speak, hear a substantive coached reply, interrupt (barge-in), see captions, end call.

- [ ] **Step 7: Commit** `git add -A && git commit -m "feat(voice): Call screen (@elevenlabs/react) + nav + routes"`

### Task 10: Shared-session continuity + cost cap + ship

**Files:**
- Modify: `src/pages/Sessions.tsx`/`Hypnosis.tsx` (ensure voice turns render in history — likely already, since same store), `server/routes/voice.js` (per-session minute cap)

- [ ] **Step 1: Verify continuity.** After a voice call, open text "Session"/"History" → the call transcript appears and can be continued in text. Fix rendering if voice turns differ in shape.
- [ ] **Step 2: Per-session cap.** In `/api/voice/session`, refuse to mint if the user has exceeded a daily voice-minute budget (config env `VOICE_DAILY_MINUTES`, default e.g. 30); surface a friendly message client-side.
- [ ] **Step 3: Verify** Create-Hypnosis readiness still works from a voice-led session (readiness flag surfaces in the shared session UI).
- [ ] **Step 4: Full test run green; build green.** Merge `feature/voice-coaching` → `main`; confirm Railway + Vercel deploys succeed and `/api/health` is 200.
- [ ] **Step 5: Commit/merge.**

---

## Self-Review

**Spec coverage:** §4 UX → Task 9/10; §5.1–5.5 architecture → Tasks 5–8; §6 effectiveness → Task 6 (`VOICE_DELIVERY`, shared prompt); §7.1 backgrounding → Task 2; §7.2 Intel → Task 1; §8 iOS gate → Task 3; §11/§12.7 cost cap → Task 10; §12.4 webhook persistence → Task 8; §12.2/12.3 extra_body+secret → Tasks 6/7. Covered.

**Placeholder scan:** external-API exact prop/field names (`@elevenlabs/react` session args, ElevenLabs signed-URL + webhook payload shapes) are explicitly deferred to the Task 3 spike and flagged inline — not silent TODOs. All code steps include real code.

**Type consistency:** `voiceLlmHandler(req,res,deps)`, `voiceSessionHandler(req,res,deps)`, `runCoachingAnalysis(userId,sessionId,systemPrompt,apiMessages)`, `openAiChunk/openAiFinalChunk/openAiDone`, `buildSystemPrompt(userId,phase,retrievalQuery)`, client `startVoiceSession()` — used consistently across tasks.

## Execution Handoff
(see below)
