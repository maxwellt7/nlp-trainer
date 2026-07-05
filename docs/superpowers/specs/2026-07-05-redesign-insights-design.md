# App Redesign — Insights — Design Spec

- **Date:** 2026-07-05
- **Status:** Draft for review
- **Repo:** maxwellt7/nlp-trainer (React 19 + Vite + Tailwind v4; frontend on Vercel `heart.sovereignty.app`, backend on Railway)
- **Source mockup:** `~/Downloads/NLP Trainer Redesign.html` — Insights tab (*"How you're doing"*)
- **Predecessor:** `2026-07-04-redesign-foundation-home-design.md` (Foundation + Home, SHIPPED). This is sub-project #2 of 4.

## 1. Summary

Redesign the Insights screen into the calm/editorial language established by Home.
Faithful to the mockup's **three sections** — Emotional capacity, Alignment rings,
"Patterns we've noticed" — re-presenting the SAME data the current
`src/pages/Insights.tsx` reads (`api.getProfile()` → `profile` + `streak`).

Frontend-only. No backend/API changes. The redesign is a presentation + IA overhaul:
the current screen's 7 clinical blocks collapse to 3 warm sections.

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Section scope | **Faithful to mockup — 3 sections.** Drop the standalone Four Stages of Competence, Context Maps grid, Victim–Healer spectrum, and Force-vs-Influence blocks. Their data either feeds "patterns" or is retired. |
| Capacity bars | `capacity_index` → `suppression`=**Holding in**, `discharge`=**Releasing**, `capacity`=**Staying with it** (clean 1:1). |
| Alignment rings | **`profile.congruence`, data-driven labels** — one ring per key present (title-cased, up to 4). Empty `congruence` → honest empty-state card, no zero-rings. |
| Patterns | Translate detected `meta_programs` to plain-language bullets; fold `victim_healer` + `force_pattern` in as extra bullets when meaningful. |
| Trends | **No fabricated trends.** We store only current values, no per-field history. Replace the mockup's trend note pills ("softened over two weeks", "growing") with a value-bucketed qualifier word derived from the current value. |
| Tokens/primitives | Reuse `--rd-*` tokens + `src/components/rd/` (`Screen`, `Card`, `SectionLabel`). No new primitives required. |
| Old screen | Delete `src/pages/Insights.tsx` after the route swap (same pattern as Home replacing Dashboard). |

## 3. Data shape (verified against backend)

From `api.getProfile()` → `{ profile, streak }`. `profile` fields (all JSON, parsed
server-side in `getProfileForPrompt`, but the `/api/profile` route returns the raw
row's parsed fields the current screen already consumes):

- `capacity_index`: `{ suppression, discharge, capacity }` — numeric 0–10, default 5.
- `congruence`: `{ [domain: string]: number }` — **keys are not fixed** in the schema
  (the coach writes whatever domains it detects). May be `{}`.
- `meta_programs`: `{ direction: "toward"|"away"|null, frame: "internal"|"external"|null,
  chunk: "global"|"specific"|null, rep_system: "visual"|"auditory"|"kinesthetic"|null }`.
- `victim_healer`: `{ score: number (-5..5), trending?: "improving"|"declining"|"stable" }`
  (accumulated object; the coach's per-turn `victim_healer` string is aggregated into this).
- `force_audit`: `{ subtle: number, clean: number }` (0–10). (`force_pattern` per-turn
  string aggregates here.)

The mockup's "Patterns we've noticed" copy is literally a translation of `meta_programs`
(e.g. `direction: "toward"` → *"You move toward, not away"*; `frame: "external"` →
*"Other people's eyes matter a lot"* — both verbatim in the mockup).

## 4. Screen structure (`src/pages/rd/Insights.tsx`, mounted at `/insights`)

Wrapped in `Screen`. Top-to-bottom:

**Header**
- `H1` *"How you're doing"* — `font-family: var(--font-display)`, ~30px, weight 400.
- Subcopy *"A gentle read on what your recent conversations reveal."* — `--rd-muted`, ~14px.

**Section 1 — Emotional capacity** (a `Card`)
- `SectionLabel`: "EMOTIONAL CAPACITY" (or plain per mockup — confirm visually).
- Three horizontal bars, top-to-bottom: Holding in, Releasing, Staying with it.
- Each bar row: label (left) + qualifier word (right); a track with a rounded fill at
  `width: value*10%`; a fixed plain-language `desc` line beneath.
- Colors: Holding in `--rd-muted`, Releasing `--rd-accent-bright`, Staying with it `--rd-sage`.
- Qualifier word from value bucket: `<4 → "quiet"`, `4–6.9 → "steady"`, `≥7 → "strong"`.
  (Replaces the mockup's trend words; describes the current level, invents no history.)
- **Empty state:** if `capacity_index` is missing OR every value is the default 5, render a
  single gentle line instead of bars: *"Your emotional patterns will come into focus after
  a few more conversations."*

**Section 2 — Alignment** (a `Card`)
- `SectionLabel`: "ALIGNMENT".
- One ring per key in `profile.congruence` (insertion order, capped at 4). Ring = SVG donut
  (reuse the current screen's `M18 2.0845 …` arc path) restyled: track `--rd-border`, progress
  stroke `--rd-accent-bright`, `strokeDasharray = (score/10)*100, 100`. Center shows the score
  rounded to a whole number; label beneath is the title-cased key (`_`→space).
- Layout: horizontal row / simple grid, centered, matching the mockup's 4-up rings.
- **Empty state:** if `congruence` is `{}`/absent, render the whole card as a gentle line:
  *"As different areas of your life come up, you'll see how aligned they feel here."* — no
  zero-value rings.

**Section 3 — Patterns we've noticed** (NOT a card — bullet list, per mockup)
- `SectionLabel`: "PATTERNS WE'VE NOTICED".
- Column of bullets; each bullet = small color dot + `title` (serif or medium sans) + `desc`
  (`--rd-muted`). Built by `insightsLogic.buildPatterns(profile)`:
  - `meta_programs.direction`: toward → *"You move toward, not away"*; away → *"You move away from what you don't want"*.
  - `meta_programs.frame`: external → *"Other people's eyes matter a lot"*; internal → *"You check decisions against your own compass"*.
  - `meta_programs.chunk`: global → *"You think in the big picture first"*; specific → *"You work from the details up"*.
  - `meta_programs.rep_system`: visual/auditory/kinesthetic → one plain sentence each.
  - `victim_healer`: fold in ONE bullet only when `score` is clearly toward healer (`≥2`) or
    victim (`≤-2`) — plain language, no clinical "victim/healer" labels
    (e.g. healer-leaning → *"You're taking ownership of your part in things"*).
  - `force_audit`: fold in ONE bullet only when `clean` clearly exceeds `subtle` (or vice
    versa) by a meaningful margin — e.g. *"You tend to influence cleanly, without pushing."*
  - Dot colors cycle through `--rd-accent-bright`, `--rd-muted`, `--rd-sage`.
- Only detected/known signals render (skip `null`/`unknown`/default).
- **Empty state:** if no bullets qualify → *"As we talk more, the patterns in how you think
  will show up here."*

## 5. Logic module (`src/pages/rd/insightsLogic.ts`, unit-tested)

Pure functions, data-in → view-model-out (no React, no fetching):
- `capacityBars(capacity_index) → { label, value, pct, qualifier, desc, colorVar }[] | null`
  (returns `null` for the empty state).
- `alignmentRings(congruence) → { label, score, dash }[]` (empty array → empty state).
- `buildPatterns(profile) → { title, desc, colorVar }[]`.

Tests in `insightsLogic.test.ts` (Vitest, mirrors `homeLogic.test.ts`): value bucketing,
empty/default detection, meta-program translation coverage, victim_healer/force thresholds,
ring capping at 4, title-casing.

## 6. Routing & cleanup

- `src/App.tsx`: point **both** `/insights` route blocks (the two route trees present) at
  the new `src/pages/rd/Insights.tsx`. Keep the `RouteErrorBoundary` wrapper.
- Delete `src/pages/Insights.tsx` once the new screen renders.
- No nav changes — Insights already sits in the bottom nav from Foundation.

## 7. States & resilience

- **Loading:** quiet `--rd-muted` line inside `Screen` (mirror Home's treatment), not a
  clinical spinner.
- **Error:** on `getProfile()` failure, a calm message + Retry (reload), styled `--rd-*`.
  `RouteErrorBoundary` (already wrapping lazy routes) still catches chunk-load errors.
- **New user (no profile):** friendly single-line state for the whole screen (before any
  session data exists), consistent with the section empty states above.

## 8. Testing & deploy

- `npm run build` (`tsc -b && vite build`) green.
- `npm run test:web` green, including new `insightsLogic.test.ts`.
- Manual verification on iPad (installed PWA) + desktop: header, three sections render from
  real data, each empty state, error/Retry, nav highlight on Insights.
- Deploy: merge to `main`, then **force** `vercel --prod --yes` (git auto-deploy is flaky —
  see [[project-nlp-voice-feature]] gotcha). Verify the live `/assets/*.js` bundle contains a
  distinctive new string (e.g. `How you're doing`) and that `heart.sovereignty.app` aliases
  the new deployment.

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `congruence` keys don't read as clean "Work/Home/Social/Self" | Accept data-driven labels (approved); title-case + cap at 4; empty state when absent. |
| Mockup implies trends we don't store | Replace trend pills with current-value qualifier words; no fabricated history. |
| `capacity_index` all-default (5) looks like real data | Treat all-default as empty → show the "after a few conversations" state. |
| Patterns list empty for new users | Explicit empty-state copy; screen never shows blank sections. |
| Mixed old/new visuals during transition | Expected; `--rd-*` additive; You + Library redesigned next. |

## 10. Open questions (resolve visually during build)

- Exact Newsreader weight/size per element vs. the mockup (faithful, not pixel-perfect).
- Whether `SectionLabel` text should be uppercase-tracked (as Home) or the mockup's exact
  casing — match the mockup where it differs.
