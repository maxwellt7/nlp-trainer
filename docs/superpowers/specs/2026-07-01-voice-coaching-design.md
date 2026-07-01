# Voice Coaching (Real-time Call) — Design Spec

- **Date:** 2026-07-01
- **Status:** Draft for review
- **Repo:** maxwellt7/nlp-trainer (backend on Railway `nlp-training-backend`, frontend on Vercel `heart.sovereignty.app`)
- **Author:** pairing session (Max + Claude)

## 1. Summary

Add a **real-time, barge-in voice conversation** as an *additional* channel for the
daily coaching experience, alongside the existing text chat. The voice channel
must be **just as effective as text** — same coaching intelligence (Claude +
condensed NLP digest + Pinecone RAG), same downstream (Create-Hypnosis
readiness, values/identity tracking), same session history. Voice is a new
top-level **"Call"** tab; text chat is unchanged.

The real-time voice layer (mic, turn-taking, barge-in, STT, TTS) is handled by
**ElevenLabs Agents**. The **brain stays Claude**: the ElevenLabs agent is
configured with a **Custom LLM** that points at a new streaming endpoint on our
Railway backend, which reuses the exact coaching pipeline that powers text.

## 2. Goals / Non-goals

**Goals**
- Real-time spoken coaching conversation with natural turn-taking and interruption.
- Coaching quality *identical* to text: same model, prompt, and retrieval.
- Voice and text share one session/history; switch freely between them.
- Transcript persisted; readiness + values/identity analysis fire from voice turns.
- Reuse existing infrastructure (Claude pipeline, RAG, ElevenLabs voices, Clerk auth).

**Non-goals (this iteration)**
- Telephone/PSTN dialing (web only).
- Multi-party/group calls.
- Offline voice.
- Replacing text chat (it stays).
- Generating the final hypnosis *audio* via this channel (that stays the existing
  async job pipeline).

## 3. Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Interaction model | Real-time, barge-in | User choice; most immersive for coaching rapport |
| Voice stack | ElevenLabs Agents + Custom LLM (Claude) | Keeps Claude+RAG brain ("just as effective"); reuses existing ElevenLabs voices; offloads WebRTC/turn-taking |
| Brain | Claude via shared `buildSystemPrompt` + RAG | Effectiveness parity with text |
| Placement | New top-level "Call" tab (Ops group) | Additional channel, not a replacement |
| Session model | Voice + text share one session/history | Seamless switching |
| Voice selection | Picker over existing ElevenLabs voices (Serafina/Silas Vane/Vane) | Reuse; user choice |

## 4. UX / UI

- **Nav:** add `{ to: '/call', label: 'Call', section: 'ops' }` (phone icon) next to
  "Session" in `src/components/Layout.tsx`. Behind the same `PaywallGate`.
- **Call screen (`src/pages/Call.tsx`):**
  - Pre-call: coach voice picker (defaults to configured default voice), a large
    **Start Call** button, and a one-line mic-permission explainer.
  - In-call: coach orb + live audio waveform, **live captions** (running transcript),
    **Mute** and **End Call** controls, and a subtle "listening / speaking" state.
  - Mic permission requested on a user gesture (Start Call), with graceful denial UX.
  - On End Call: transcript is already saved (persisted per-turn server-side); user
    returns to a summary / can open the shared Session to continue in text.
- **Accessibility:** live captions double as an a11y affordance; controls are
  keyboard-reachable; call state announced.
- **Shared history:** the call writes into the same session as text, so "History"
  and "Session" show voice turns interleaved with text turns.

## 5. Architecture

### 5.1 Components

1. **Frontend Call screen** — `@elevenlabs/react` SDK. Requests a signed URL from our
   backend, starts a WebRTC session, renders captions + call controls.
2. **`POST /api/voice/session`** (Clerk-authed) — mints a short-lived **signed URL**
   for the ElevenLabs agent (using server-side `ELEVENLABS_API_KEY`), resolves/creates
   the coaching **session**, and returns `{ signedUrl, sessionId, dynamicVariables }`.
   `dynamicVariables` carry `userId` + `sessionId` into the conversation.
3. **`POST /api/voice/llm`** — **OpenAI-compatible streaming** endpoint that the
   ElevenLabs agent calls as its Custom LLM every turn. It:
   - reads `userId`/`sessionId` (from dynamic variables surfaced in the request),
   - builds the **same** coaching system prompt via `buildSystemPrompt(userId,
     'coaching', lastUserUtterance)` (condensed NLP digest + RAG),
   - calls Claude and **streams** tokens back in OpenAI SSE format
     (`data: {json}\n\n` … `data: [DONE]\n\n`),
   - **persists** the user turn + assistant reply to the shared session
     (`updateSessionMessages`) and runs the **same** deferred values/identity
     analysis (`deferTask`).
4. **ElevenLabs Agent** (managed dashboard config, versioned via export) — voice,
   VAD/turn-taking, barge-in, STT, TTS; Custom LLM → our `/api/voice/llm`.
5. **Shared coaching pipeline** — unchanged `buildSystemPrompt`, RAG, `deferTask`,
   session store. No forking of the brain.

### 5.2 Sequence (one call)

```
User taps Start Call
  → Frontend POST /api/voice/session (Clerk JWT)
      → backend: verify user, get/create coaching session, mint ElevenLabs signed URL
      ← { signedUrl, sessionId, dynamicVariables:{userId,sessionId} }
  → Frontend @elevenlabs/react startSession(signedUrl, dynamicVariables)  [WebRTC]
  → (loop, per user utterance)
      ElevenLabs: capture speech → STT → POST /api/voice/llm (OpenAI-compatible, streaming)
        → backend: buildSystemPrompt(userId,'coaching',utterance)  [NLP digest + RAG]
        → Claude stream → SSE chunks back to ElevenLabs
        → ElevenLabs TTS speaks reply (barge-in enabled)
        → backend (deferTask): persist turns + values/identity analysis
  → User taps End Call → session already persisted
```

### 5.3 Custom-LLM endpoint contract

- **Compatibility:** OpenAI Chat Completions streaming (the format ElevenLabs
  documents for custom LLM). Confirm exact request shape (messages array, how
  dynamic variables/system are delivered) against ElevenLabs docs during
  implementation; support their "buffer words" guidance to keep prosody natural
  while Claude + RAG generate.
- **Identity mapping:** `sessionId`/`userId` arrive via ElevenLabs *dynamic
  variables* (set at `startSession`). The endpoint must NOT trust arbitrary client
  input for `userId`; the signed URL is minted server-side for the authenticated
  Clerk user, and the endpoint validates the mapping.
- **Streaming translation:** Claude tokens → OpenAI `chat.completion.chunk` SSE.
- **Voice-delivery layer:** append a small system instruction for spoken output
  (natural pacing, no markdown/JSON, substantive but not a wall of text) — depth
  preserved, delivery adapted.

### 5.4 Auth & security

- `ELEVENLABS_API_KEY` stays **server-side**; clients only ever receive short-lived
  signed URLs.
- `/api/voice/llm` must authenticate the ElevenLabs → backend call (shared secret
  header / allowlist) and validate `userId`/`sessionId`, since it is not behind
  the Clerk user JWT.
- Reuse existing CORS/allowlist patterns.

### 5.5 Persistence & shared session

- The `/api/voice/llm` endpoint is the single persistence point: it sees every user
  utterance and produces every reply, so it writes to the same session store as
  text (`updateSessionMessages`, `updateSessionMetadata`), keeping voice + text in
  one history.
- Readiness (`readyToGenerate`) and values/identity analysis reuse the text logic.

## 6. Effectiveness parity ("just as effective")

- **Same brain:** Claude + condensed NLP digest + Pinecone RAG via the shared
  pipeline — not a different model, not a trimmed prompt.
- **Delivery, not depth:** the voice-delivery instruction adjusts *how* it speaks,
  never *how much it knows*. Barge-in makes longer, substantive replies comfortable
  because the user can redirect anytime.
- **Nothing lost:** full transcript saved to the shared session; the depth is always
  re-readable in text.
- **Same downstream:** Create-Hypnosis readiness + values/identity tracking fire from
  voice turns identically.

## 7. Folded-in bug fixes

### 7.1 Mobile backgrounding cancels + loses the reply (text chat)
- **Cause:** the text `/api/hypnosis/chat` turn is synchronous; switching apps aborts
  the client fetch. On Railway the server may still finish, but the client loses the
  reply and (depending on abort propagation) the turn may not persist.
- **Fix:** ensure the assistant reply is generated + persisted server-side
  independent of client connection (the async pattern already used by audio/hypnosis
  *generation* jobs), and have the client **re-sync the session on foreground/return**
  so a reply produced while backgrounded appears. Voice already works this way.
- Tracked as task #7; specified in its own plan section.

### 7.2 Intel/Insights page won't populate
- **Symptom:** tapping "Intel" opens then immediately clears with no data.
- **Plan:** investigate `src/pages/Insights.tsx` + its data source (`/api/analytics`
  or profile/gamification) for an error/empty-state/access-gate issue. Independent of
  voice; tracked as task #6.

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| iOS-installed-PWA mic access is quirky | Validate on the actual iPad *early* (spike before full build); user-gesture start + clear permission UX; Safari-tab fallback if PWA mic is unreliable |
| Per-turn latency (Claude+RAG vs native realtime) | Stream tokens; use ElevenLabs "buffer words"; keep RAG topK small (already fast); short first-token time via the lean reply pattern |
| Cost (per-minute voice) | Put real per-minute numbers (ElevenLabs agent minutes + Claude tokens + TTS) in the plan; add a usage cap / session length guard |
| Security of `/api/voice/llm` (not behind Clerk JWT) | Shared-secret header + validate signed-URL-issued session mapping |
| ElevenLabs custom-LLM request shape differs from assumption | Confirm against docs in an early spike; the endpoint is small and isolated |
| Effectiveness drift in voice | Same pipeline + a delivery-only instruction; A/B a few turns text vs voice during verification |

## 9. Testing

- **Unit:** OpenAI-SSE translation (Claude chunks → OpenAI chunks); dynamic-variable
  → session mapping; voice-delivery instruction assembly; signed-URL minting (mocked).
- **Integration:** `/api/voice/llm` end-to-end with a mocked Claude client returning
  a streamed reply → asserts SSE framing + session persistence + deferred analysis.
- **Manual/spike:** real ElevenLabs agent call on the iPad (mic, barge-in, captions,
  shared-session continuity into text).
- Keep all existing server tests green.

## 10. Phasing / rollout

1. **Spike (de-risk):** minimal ElevenLabs agent + `/api/voice/llm` echoing Claude,
   validated on the iPad (mic + barge-in + latency feel). Go/no-go on iOS-PWA mic.
2. **Brain integration:** wire the real coaching pipeline (prompt + RAG) + persistence
   + deferred analysis into `/api/voice/llm`.
3. **Session auth:** `/api/voice/session` signed URLs + Clerk + session mapping.
4. **Frontend Call screen:** `@elevenlabs/react`, captions, controls, voice picker, nav.
5. **Shared-session continuity:** verify voice turns appear in text Session/History.
6. **Bug fixes:** backgrounding resilience (7.1) + Intel page (7.2).
7. **Verify + cost pass + ship behind the paywall.**

## 11. Cost (to quantify in the plan)
- ElevenLabs Agents per-minute + TTS characters (your existing voices).
- Claude tokens per turn (same as text; the NLP digest is already ~8k, RAG small).
- Add a per-session soft cap and surface usage.

## 12. Design challenges & resolutions (quality pass — see task #5)
- Deeper adversarial review (latency budgets, failure modes, iOS specifics, cost
  ceilings, security of the custom-LLM endpoint) happens after this spec is approved,
  with improvements folded into the implementation plan.

## 13. Open questions
- Exact ElevenLabs custom-LLM request/response shape + how dynamic variables surface
  in that request (resolve in the spike).
- Per-session length/cost cap value.
- Default coach voice.
