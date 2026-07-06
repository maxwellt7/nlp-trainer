# App Redesign — Library — Design Spec

- **Date:** 2026-07-05
- **Status:** Draft for review
- **Repo:** maxwellt7/nlp-trainer (React 19 + Vite + Tailwind v4; frontend on Vercel `heart.sovereignty.app`, backend on Railway)
- **Source mockup:** `~/Downloads/NLP Trainer Redesign.html` — Library tab (*"Your recordings"*) + the session player
- **Predecessors:** Foundation+Home, Insights, You — all shipped. This is sub-project #4 of 4 (final).

## 1. Summary

Redesign the Audios ("Library") screen into the calm/editorial language of the other
rebuilt screens: a quiet list of **recordings** with a play orb, plus an **immersive
full-screen player** (breathing orb, play/pause, scrubber, rewind-15s, time). Re-presents
the SAME data the current `src/pages/Audios.tsx` reads via `api.listScripts()`.

Unlike Insights/You (pure presentation), Library carries real actions — **play**,
**generate audio** for scripts that lack it, and **delete**. The redesign keeps those
essentials but tucks them away for calm; it drops the voice-picker, the inline script-text
view, and the mockup's "loved" heart (no backend field to persist it).

Frontend-only. No backend/API changes.

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Scope | Calm recording list + essentials tucked away. Keep play, generate ("Prepare recording"), delete (behind a subtle reveal). Drop voice-picker, script-text view, "loved" heart. |
| Player | **Immersive full-screen player** (breathing orb, play/pause, scrubber, rewind-15s, elapsed/total). Held as overlay state in Library (no new route). |
| Loved heart | **Dropped** — no backend favorite field; a localStorage-only heart wouldn't sync across devices. |
| Voice | Generation uses the default voice silently (`audioGenerateStart` with no `voiceId` → backend default). |
| Old screen | Delete `src/pages/Audios.tsx` after the route swap. |

## 3. Data shape (verified against current screen + backend)

`api.listScripts()` → `{ scripts: SavedScript[] }`, sorted by `createdAt` DESC (backend
`server/routes/audio.js`). `SavedScript`:
`{ id: string, title: string, duration: string, estimatedMinutes: number, script: string,
audioFile: string | null, voiceId?: string|null, voiceLabel?: string|null, createdAt: string }`.

- `audioFile` is `null` until audio is generated → such a recording shows the **Prepare**
  affordance, not a play orb.
- Playback URL: `api.getAudioUrl(audioFile)`.
- Actions: `api.deleteScript(id)`; `api.audioGenerateStart(id)` → `{ jobId }` then poll
  `api.audioGenerateStatus(jobId)` until `status === 'complete' | 'failed'`.

## 4. Library screen (`src/pages/rd/Library.tsx`, mounted at `/library` + `/audios`)

Wrapped in `Screen`. Top-to-bottom:

**Header**
- `H1` *"Your recordings"* — `var(--font-display)`, ~30px, weight 400.
- Subcopy *"Every session is yours to return to, any time."* — `--rd-muted`, ~14px.

**Recording rows** — for each script (a calm `Card`):
- **Left — play control:**
  - If `audioFile`: a small gradient **play orb** (~44px, radial sage/accent gradient with a
    play glyph). Tapping it (or the row body) opens the Player for this recording.
  - If `audioFile` is `null`: a quiet **"Prepare recording"** pill in the orb's place.
- **Center:** `title` (serif/medium) + **meta line** from `libraryLogic.recordingMeta` —
  e.g. *"Today · 18 min"*, *"Yesterday · 16 min"*, *"Jun 30 · 21 min"* (`--rd-muted-2`).
- **Trailing:** a subtle **"⋯"** button that toggles a one-line reveal containing a single
  quiet **Remove** text action → `deleteScript(id)`, optimistic removal from the list.

**Prepare flow** (script without audio):
- Tap *"Prepare recording"* → `audioGenerateStart(id)` → poll `audioGenerateStatus(jobId)`
  every ~4s; show *"Preparing…"* on the row meanwhile. On `complete`, reload scripts (the
  row now shows the play orb). On `failed`, show a quiet inline error on that row. Reuse the
  current screen's proven poll structure (single in-flight guard, terminal flag, backoff on
  error). Survives mobile backgrounding because the work is server-side (we hold only a jobId).

**Empty state:** `scripts` empty → a gentle line: *"Your sessions will appear here once
you've had one."* (optionally a quiet "Begin a session" link to `/hypnosis`).

**Loading / error:** quiet `--rd-muted` line while loading; calm message + "Try again" on
list-fetch failure; `RouteErrorBoundary` still wraps the lazy route.

## 5. Player (`src/pages/rd/Player.tsx`, immersive overlay)

A presentational full-screen component rendered by Library when `activeRecording` is set —
**not a route**. Props: `{ recording: SavedScript, onClose: () => void }`.

- **Layout:** fixed, inset 0, above the bottom nav, `--rd-bg` background, centered column.
- **Breathing orb:** large (~180px) radial-gradient circle; CSS `orbBreathe` animation runs
  **only while playing**; disabled under `prefers-reduced-motion`.
- **Title:** `recording.title` (serif). **Hint** (`--rd-dim`): playing → *"Breathe with the
  circle"*; paused → *"Press play when you're settled"* (verbatim from mockup).
- **Controls:** rewind-15s (`currentTime -= 15`, floored at 0), center play/pause,
  a **progress scrubber** (click/drag sets `currentTime`), and elapsed / total time via
  `libraryLogic.formatTime`.
- **Audio:** an `<audio>` element via `ref`, `src = getAudioUrl(recording.audioFile)`;
  `timeupdate` → progress + elapsed; `loadedmetadata` → total; `ended` → reset to paused at 0.
- **Close:** a down-chevron pauses audio and calls `onClose()`. On unmount, pause + detach
  the audio source (prevent leak), mirroring the current screen's cleanup.

## 6. Logic module (`src/pages/rd/libraryLogic.ts`, unit-tested)

Pure functions (no React, no fetching):
- `recordingMeta(createdAt: string, estimatedMinutes: number, now: Date) → string` —
  builds *"<day> · <N> min"*. Day: same calendar day as `now` → "Today"; previous day →
  "Yesterday"; else short date *"Mon D"* (e.g. "Jun 30"). Omits the minutes clause if
  `estimatedMinutes` is falsy/non-finite (→ just the day).
- `formatTime(seconds: number) → string` — `M:SS` (e.g. `65 → "1:05"`), clamps negatives/NaN
  to `"0:00"`.

Tests in `libraryLogic.test.ts` (Vitest): today/yesterday/older date branches (fixed `now`),
missing-minutes fallback, `formatTime` for 0 / <10s / minutes / NaN / negative.

## 7. Routing & cleanup

- `src/App.tsx`: change the line-20 lazy import from `'./pages/Audios'` to
  `'./pages/rd/Library'`. This repoints both routes that reference the single `Audios`
  binding — `/library` and `/audios`, in both route trees (lines ~59/60/94/95). No other edits.
- Delete `src/pages/Audios.tsx` once the new screen renders.
- `Sessions` (`/sessions`) is a separate chat-history screen — left untouched.
- No nav changes — "Library" already sits in the bottom nav.

## 8. States & resilience

- **Loading:** quiet `--rd-muted` line inside `Screen`.
- **Error (list fetch):** calm message + "Try again" (reload), `--rd-*` styled.
- **New user (no scripts):** header + empty-state line; no blank card.
- **Generate in flight:** row shows "Preparing…"; audio work is server-side so mobile
  backgrounding doesn't lose it.
- **Audio playback error:** quiet inline message; player returns to paused.

## 9. Testing & deploy

- `npm run build` (`tsc -b && vite build`) green.
- `npm run test:web` green, including new `libraryLogic.test.ts`.
- Manual verification on iPad (installed PWA) + desktop: header, recording rows, meta lines,
  open player + play/pause/seek/rewind, Prepare flow on an un-generated script, Remove,
  empty/error states, Library nav highlight.
- Deploy: merge to `main`, then **force** `vercel --prod --yes` (git auto-deploy is flaky —
  see [[project-nlp-voice-feature]]). Verify the live `/assets/*.js` bundle contains
  `Your recordings` and that `heart.sovereignty.app` aliases the new deployment.

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Immersive player is the most net-new interactive surface | Keep it a single self-contained component; audio lifecycle in one ref with unmount cleanup; verify on-device. |
| Audio playback not unit-testable | Extract pure `recordingMeta`/`formatTime` for tests; verify playback manually. |
| Generate polling races (double-tap, unmount) | Reuse current screen's single-in-flight + terminal-flag pattern; disable the control while preparing. |
| Removing "loved"/voice/script-view surprises returning users | Intentional per scope; essentials (play/generate/delete) retained. |
| iOS audio autoplay/lifecycle quirks in PWA | Play is user-initiated (tap); pause + detach on close/unmount; `prefers-reduced-motion` respected. |

## 11. Open questions (resolve visually during build)

- Exact orb gradient/size + `orbBreathe` timing vs. the mockup (faithful, not pixel-perfect).
- Whether the scrubber is drag-seek or tap-seek (default: both; tap sets position, drag
  updates live) — confirm feel on-device.
