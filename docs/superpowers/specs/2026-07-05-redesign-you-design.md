# App Redesign — You — Design Spec

- **Date:** 2026-07-05
- **Status:** Draft for review
- **Repo:** maxwellt7/nlp-trainer (React 19 + Vite + Tailwind v4; frontend on Vercel `heart.sovereignty.app`, backend on Railway)
- **Source mockup:** `~/Downloads/NLP Trainer Redesign.html` — You tab (*"What you value"*)
- **Predecessors:** Foundation+Home (`2026-07-04-…`, shipped), Insights (`2026-07-05-redesign-insights-design.md`, shipped). This is sub-project #3 of 4.

## 1. Summary

Redesign the Identity/values screen ("You") into the calm/editorial language of Home
and Insights. Faithful to the mockup's sections — **Overall congruence**, **What you
value** (value bars), **A tension worth noticing** — plus a 4th warm **Beliefs** card
(surfacing identity statements). Re-presents the SAME data the current
`src/pages/Identity.tsx` reads via `api.getIdentity()`.

This sub-project also completes a carry-over from the Insights QC: **remove the
permanently-empty Alignment section from Insights** (no life-domain data exists to feed
it — see §7).

Frontend-only. No backend/API changes.

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Section scope | **Mockup (3 sections) + a Beliefs card** (4 total). Drop the current screen's 8-dimension scorecard, ranked #1/#2 hierarchy, and tap-to-expand evidence trail. |
| Value bar fill | `purity_score × 10` (how cleanly the value is lived). |
| Value badge | `confidence < 0.5` → **emerging**; else `expression === 'pure'` → **living it**; else (`mixed`/`distorted`) → **mixed**. |
| Overall congruence | Single large ring from `scores.overall_congruence` (×10 → %). |
| Tension | Show only `conflicts[0]`; hide the section when there are no conflicts. |
| Beliefs | From `statements[]`, warm labels (no clinical "limiting_belief" text); hide when none. |
| Insights Alignment | **Remove** the Alignment card from Insights + delete now-unused `alignmentRings` and its tests. |
| Old screen | Delete `src/pages/Identity.tsx` after the route swap. |

## 3. Data shape (verified against current screen + backend)

`api.getIdentity()` → `{ values, conflicts, statements, scores }`:

- `values[]`: `{ value_name: string, confidence: number (0–1), purity_score: number (0–10),
  expression: 'pure'|'distorted'|'mixed', pure_expression: string, distorted_expression:
  string, evidence_count: number }`.
- `conflicts[]`: `{ value_a: string, value_b: string, conflict_type: string, description: string }`.
- `statements[]`: `{ statement_type: 'core_identity'|'limiting_belief'|'empowering_belief'|
  'worthiness_pattern'|'root_belief', content: string, confidence: number }`.
- `scores`: `{ value_clarity, value_alignment, hierarchy_stability, purity_ratio,
  conflict_awareness, worthiness_independence, decision_speed, overall_congruence }` —
  each 0–10; may be `null`; `overall_congruence` DEFAULT 0 (0 ⇒ no real data yet).

Any of `values` / `conflicts` / `statements` may be `[]` for a new user.

## 4. Screen structure (`src/pages/rd/You.tsx`, mounted at `/you`)

Wrapped in `Screen`. Top-to-bottom:

**Header**
- `H1` *"What you value"* — `var(--font-display)`, ~30px, weight 400.
- Subcopy *"Built slowly, from what you've shared — not from a quiz."* — `--rd-muted`, ~14px.

**Section 1 — Overall congruence** (glowing radial `Card`, centered)
- One large SVG donut ring (~108px): track `--rd-border`, progress stroke `--rd-sage`,
  `strokeDasharray = ${round(clamp(overall,0,10)*10)}, 100`, rotated so it fills from top.
  Center: the number to one decimal (e.g. `7.2`).
- Radial-glow background consistent with the mockup (sage glow), using `--rd-*` tokens.
- **Empty state** (`scores` null or `overall_congruence` ≤ 0): replace the ring with a
  gentle line — *"Your sense of alignment will take shape as you keep talking."*

**Section 2 — What you value** (value bars) — for each `values[]` entry:
- Row: `value_name` (title-cased) + a small pill **badge** (living it / mixed / emerging).
- Badge color: living it → `--rd-sage`, mixed → `--rd-accent-bright`, emerging → `--rd-muted`
  (pill bg is the same color at low alpha).
- Fill bar: width `purity_score × 10` clamped 0–100, badge-colored.
- `desc` line (`--rd-muted-2`): living it → `pure_expression`; mixed → `distorted_expression
  || pure_expression`; emerging → *"Newly surfaced in recent conversations."* Every branch
  has a plain fallback so the line is never blank.
- **Empty state** (`values` empty): *"Your values will appear here as they surface in
  conversation."*

**Section 3 — A tension worth noticing** (only `conflicts[0]`)
- `SectionLabel` "A tension worth noticing" (`--rd-muted`).
- Serif line: `Title(value_a)` `↔` `Title(value_b)`; then `description` (`--rd-muted-2`).
- **Hidden entirely** when `conflicts` is empty (no empty-state card — it's a grace note).

**Section 4 — Beliefs** (the added card)
- `SectionLabel` "Beliefs surfacing".
- Each `statements[]` item: a small colored dot + the `content` in quotes (`--rd-ink-soft`).
- Dot color by `statement_type`: `empowering_belief`/`core_identity` → `--rd-sage`;
  `limiting_belief`/`worthiness_pattern`/`root_belief` → `--rd-danger`.
- **Hidden entirely** when `statements` is empty.

## 5. Logic module (`src/pages/rd/youLogic.ts`, unit-tested)

Pure functions, data-in → view-model-out (no React, no fetching):
- `overallCongruence(scores) → number | null` — `null` when `scores` falsy or
  `overall_congruence` ≤ 0.
- `type ValueBar = { name: string; badge: 'living it'|'mixed'|'emerging'; badgeColorVar:
  string; fillPct: number; desc: string }`
  `valueBars(values) → ValueBar[]`.
- `type Tension = { a: string; b: string; desc: string }`
  `topTension(conflicts) → Tension | null`.
- `type Belief = { content: string; colorVar: string }`
  `beliefs(statements) → Belief[]`.

Tests in `youLogic.test.ts` (Vitest, mirrors `insightsLogic.test.ts`): badge thresholds
(confidence boundary 0.5, expression branches), fill clamping, desc fallbacks,
`overallCongruence` 0/null → null, `topTension` empty → null and first-only, belief color
mapping, empty arrays → empty results.

## 6. Routing & cleanup

- `src/App.tsx`: change the line-23 lazy import from `'./pages/Identity'` to
  `'./pages/rd/You'`. This repoints ALL four routes that reference the single `Identity`
  binding — `/you` and `/identity` in both the authenticated and unauthenticated route
  trees (lines ~58, ~61, ~93, ~96). No other edits to those blocks.
- Delete `src/pages/Identity.tsx` once the new screen renders. (Its evidence-trail endpoint
  `api.getValueEvidence` is no longer called from any screen; leave the API method + backend
  route in place — harmless, and out of scope to remove.)
- No nav changes — "You" already sits in the bottom nav.

## 7. Insights Alignment removal (carry-over from Insights QC)

Rationale: `profile.congruence` AND `profile.context_maps` are both dead seeds (nothing
writes them), so the Insights "Alignment" rings can never populate. The real alignment
story (overall congruence + values) now lives on the You screen, so the Insights section is
redundant as well as empty.

- `src/pages/rd/Insights.tsx`: remove the entire Alignment `Card` (Section 2) and its
  `alignmentRings` import/usage. Insights becomes two sections: Emotional Capacity + Patterns.
- `src/pages/rd/insightsLogic.ts`: delete the `alignmentRings` function and the
  `AlignmentRing` type (now unused).
- `src/pages/rd/insightsLogic.test.ts`: delete the `alignmentRings` describe block.
- Verify no other importer references `alignmentRings`/`AlignmentRing` before deleting.

## 8. States & resilience

- **Loading:** quiet `--rd-muted` line inside `Screen` (mirror Insights), not a spinner.
- **Error:** on `getIdentity()` failure, a calm message + "Try again" (reload), styled `--rd-*`.
  `RouteErrorBoundary` (already wrapping lazy routes) still catches chunk-load errors.
- **New user (no identity data):** header renders; Section 1 empty state; Section 2 empty
  state; Sections 3 and 4 hidden. Screen never shows blank cards.

## 9. Testing & deploy

- `npm run build` (`tsc -b && vite build`) green.
- `npm run test:web` green, including new `youLogic.test.ts` and the trimmed
  `insightsLogic.test.ts`.
- Manual verification on iPad (installed PWA) + desktop: header, all four sections from real
  data, each empty/hidden state, error/Retry, nav highlight on You, and Insights now showing
  two sections (no Alignment).
- Deploy: merge to `main`, then **force** `vercel --prod --yes` (git auto-deploy is flaky —
  see [[project-nlp-voice-feature]]). Verify the live `/assets/*.js` bundle contains
  `What you value` and that `heart.sovereignty.app` aliases the new deployment.

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `overall_congruence` = 0 seed looks like real data | Treat ≤ 0 as no-data → empty state. |
| Value `desc` fields sometimes empty | Per-branch plain fallback copy; never blank. |
| Removing Insights Alignment breaks a stale import | Grep for `alignmentRings`/`AlignmentRing` before deleting; build catches dangling refs. |
| `/identity` legacy route now renders the new screen | Intended; the new You screen is the identity screen redesigned. |
| Deleting `Identity.tsx` orphans evidence endpoint | Endpoint + backend route left intact (harmless); only the unused screen is removed. |

## 11. Open questions (resolve visually during build)

- Exact ring size/glow + Newsreader weights vs. the mockup (faithful, not pixel-perfect).
- Whether `SectionLabel` casing matches the mockup exactly per section.
