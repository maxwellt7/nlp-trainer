# Voice Conversation — Design & Development Specification

**Date:** 2026-07-17
**Status:** Proposed (supersedes `2026-07-01-voice-coaching-design.md`, which described a real-time ElevenLabs-Agents architecture that was explicitly rejected on 2026-07-04)
**Goal:** Talk back and forth with the coach by voice — inside the existing Daily Session / General Chat experience.

---

## 1. Product shape

**Turn-based voice conversation, not real-time barge-in.**

Two entry modes, one architecture:

1. **Mic in the composer (Phase 1–3).** A mic button inside the existing chat composer. Hold (or tap-to-toggle) to speak; the transcript becomes the user message and is sent through the *unchanged* chat pipeline. Replies can be spoken aloud via a speak-replies toggle.
2. **Voice Mode (Phase 4).** The "talking back and forth" experience: a full-screen takeover (breathing orb, same visual language as the Library Player) that loops **listen → think → speak → listen** automatically, so a session feels like a phone call with the coach. The chooser sheet's "Voice — coming soon" row becomes the entry point.

### Why turn-based
- Reuses the entire existing brain: `/api/hypnosis/chat` (Claude + NLP digest + RAG) is untouched, so voice sessions are exactly as effective as text ones.
- No WebRTC, no signed URLs, no webhooks, no per-minute agent billing, no custom-LLM endpoint.
- Push-to-talk is robust on iOS PWA where continuous audio capture is fragile.

## 2. Architecture

Three additions on top of the existing text chat:

```
[browser]                          [Railway server]
mic (getUserMedia + MediaRecorder)
   └─ audio blob (webm/mp4, ≤60s) ─▶ POST /api/voice/transcribe
                                      └─ OpenAI Whisper (`whisper-1`,
                                         existing `openai` pkg + OPENAI_API_KEY)
   ◀─ { text } ────────────────────────┘
text → existing api.hypnosisChat(...)  (UNCHANGED)
   ◀─ { reply } ───────────────────────┘
reply → POST /api/voice/speak ────────▶ ElevenLabs TTS (existing integration,
   ◀─ audio stream (mp3) ──────────────┘  same voice as hypnosis recordings)
<audio> playback; on `ended` → (Voice Mode only) auto-arm mic for next turn
```

### Server (new `server/routes/voice.js`, mounted with `requireAuth`)
- **`POST /api/voice/transcribe`** — multipart upload (multer, in-memory, 15 MB cap). Calls `openai.audio.transcriptions.create({ model: 'whisper-1', file })`. Returns `{ text }`. Rejects empty/too-short audio with a friendly error.
- **`POST /api/voice/speak`** — `{ text }` → ElevenLabs `text-to-speech/:voiceId/stream` (default voice from `audio-voices.js`), piped straight to the response (`audio/mpeg`). Cap input ~2,000 chars per call (chat replies are short; hard-truncate with ellipsis beyond that). No DB writes — replies are ephemeral speech, unlike hypnosis recordings.
- Rate-limit both (per-user, e.g. 30/min) to protect API spend.

### Client
- **`useVoiceRecorder` hook** — `getUserMedia({ audio })` + `MediaRecorder` (Safari: `audio/mp4`; Chrome: `audio/webm`), returns `{ state, start, stop, blob, level }`. Mic stream acquired on demand and fully released (`track.stop()`) after every turn — required for iOS.
- **Composer mic button** (in `Hypnosis.tsx`'s composer): idle → recording (pulsing ring + elapsed time + live level) → transcribing (spinner) → transcript lands **in the textarea for review** (Phase 2), user hits send. This review step is deliberate: it builds trust in transcription before Voice Mode removes it.
- **Speak-replies toggle** (speaker icon in the chat header): when on, each assistant reply is fetched from `/api/voice/speak` and played. Persist per-user in `localStorage`.
- **Voice Mode overlay** (`src/pages/rd/VoiceSession.tsx`): `createPortal` to `document.body`, z-index 100 (the established rd full-screen-overlay rule). Breathing orb with four states — *listening* (sage pulse ring + live mic level), *thinking* (slow accent shimmer), *speaking* (bright breathing), *paused*. Latest user transcript + coach reply rendered as two lines of large serif text under the orb (glanceable, not a transcript wall). Controls: end-call ✕, mute/hold, and "switch to text" (drops into the normal chat view with full history — same session, since Voice Mode drives the same `messages` state in `Hypnosis.tsx`).
- **Turn-taking in Voice Mode:** after TTS `ended`, auto-start recording; stop on **tap** (primary) or **1.8s of silence** via a lightweight AnalyserNode RMS check (secondary — ship tap-to-finish first, add VAD once proven on-device).

## 3. UX details

- **Entry:** ChooserSheet row "Voice Session — talk it through" replaces "Voice — coming soon". Opens `/hypnosis?mode=daily&voice=1` (or `/chat?mode=general&voice=1`); `Hypnosis.tsx` opens the Voice Mode overlay once the session is initialized. Voice and text are the *same session* — everything is persisted through the normal chat flow, so Insights/You/summaries work identically.
- **Permission gate:** first mic use shows a one-time explainer card ("We only listen while the ring is glowing") before `getUserMedia` so the OS prompt has context. Denied → inline recovery instructions (iOS: Settings → app → Microphone).
- **Errors:** transcription fails → "Didn't catch that — try again"; TTS fails → reply still appears as text and the turn continues (voice degrades to text, never blocks the session).
- **Interrupt:** tapping the orb while the coach is speaking stops playback and starts listening (poor-man's barge-in; no streaming needed).

## 4. Constraints & risks

- **iOS mic gate (BLOCKER, must run first):** `heart.sovereignty.app/mic-test.html` is already shipped but has never been run on Max's installed PWA. WebKit bug #185448 can break `getUserMedia` in standalone home-screen PWAs. **Gate:** Max runs mic-test in the installed PWA. If it fails → Plan B: mic features detect standalone-without-mic and deep-link users to the Safari-tab version for voice, or we ship browser-only voice.
- **iOS audio unlock:** TTS playback must be triggered from the user's gesture chain; keep one persistent `<audio>` element, unlocked on the first tap that enters Voice Mode.
- **Latency budget:** Whisper ~1–2s + Claude ~2–5s + ElevenLabs first-byte ~1s ≈ **4–8s per turn**. The *thinking* orb state owns this gap; it reads as the coach considering, which fits the product's calm register.
- **Cost:** Whisper $0.006/min; ElevenLabs at existing plan rates. A 10-min voice session ≈ pennies. Rate limits above cap abuse.

## 5. Build plan (4 phases, each shippable)

| Phase | Scope | Test gate |
|---|---|---|
| **0. Mic gate** | Max runs `mic-test.html` in the installed PWA | Mic works standalone (else Plan B) |
| **1. Server voice routes** | `routes/voice.js`: transcribe + speak, auth, limits | Route tests w/ mocked OpenAI/ElevenLabs (repo pattern) |
| **2. Composer mic** | `useVoiceRecorder`, mic button, transcript→textarea | On-device: record→review→send round-trip |
| **3. Spoken replies** | speak-toggle, `/speak` playback, error fallback | Reply audible; TTS failure degrades to text |
| **4. Voice Mode** | `VoiceSession.tsx` overlay, auto turn loop, chooser entry | Full back-and-forth session on-device; then VAD as a follow-up |

Estimated effort: Phases 1–3 ≈ one focused day; Phase 4 ≈ one to two days including on-device iteration.
