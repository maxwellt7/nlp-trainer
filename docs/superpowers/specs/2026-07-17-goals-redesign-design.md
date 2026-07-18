# Goals "Your 90 years" Redesign — Design & Development Specification

**Date:** 2026-07-17
**Status:** Proposed (v2 of the Goals screen shipped 2026-07-07)
**Feedback driving this:** (1) "I still feel like it's not the most user-friendly, and it's a little bit challenging to see the entire goals on a spectrum." (2) Earlier annotation: "should be 90 years worth of goals, not until I'm 90."

## 1. Diagnosis of v1

The current screen is a **vertical decade rail** starting at the *current* decade:

- **No at-a-glance whole-life view.** Seeing everything requires scrolling through every decade; the "spectrum" only exists in your head. The life bar at the top shows *age progress* but carries **zero goal information**.
- **The past is missing.** The rail starts at the current decade, so the timeline reads "until I'm 90," not "my 90 years." Achieved goals and life-so-far context have nowhere to live.
- **Empty decades cost full screen-height.** Six sparse decades × (heading + dashed add-card + 30px padding) means most of the scroll is scaffolding, not goals.
- **Navigation is linear only.** No way to jump to "my 60s" without scrolling past everything before it.

## 2. Design — "The Spectrum + The Chapters"

Two connected layers on one screen. The spectrum shows the whole life at once; the chapters hold the detail.

### Layer 1 — Life Spectrum (the fix for "see it all at once")

Replace the info-free life bar with a **full-width interactive spectrum of all 90 years, birth → 90**:

```
   YOUR 90 YEARS
   ▁▁▁▂▁▁│▃▁▅▂▁▁▁▁▂▁▁
   0s 10s 20s ▲30s 40s 50s 60s 70s 80s
              you
```

- **Track:** a horizontal band (~64px tall) spanning birth → 90. Lived years get a subtle fill (the current bar's gradient); the future stays dark.
- **Goal markers:** every goal is a **dot on the track at its target year**, colored by its category color; achieved goals render in sage with a subtle glow. Multiple goals in one year stack vertically (up to 3, then a `+n` count). The spectrum *is* the dataset in one glance — density, gaps, and balance become visible for the first time.
- **"You are here" needle:** thin bright line at the current age (replaces the glowing dot).
- **Interaction:** tapping anywhere on the spectrum scrolls the chapter list to that decade (`scrollIntoView`, smooth). Tapping a marker cluster scrolls to that decade *and* flashes the matching cards. No pinch-zoom — tap-to-jump covers navigation without gesture complexity.
- Sits **sticky at the top** of the Goals screen (below the title, `position: sticky; top: 0` inside the scroll container with the `--rd-bg` background) so the map is always available while browsing chapters. Height is modest, so it costs ~90px of viewport.

### Layer 2 — Chapters (the decades, made cheap and complete)

- **All decades render, birth → 80s** — including past decades, answering "90 years worth of goals." Past decades are framed as **chapters already written**: goals placed there render as *memories/achieved*; the decade sub-label reads e.g. "your 20s · 2012–2021 · lived."
- **Empty decades collapse to a single compact row** (label + years + a small `+`), instead of a full dashed card block. Tapping the row or `+` opens the editor prefilled to that decade. Decades with goals keep the current card layout (cards are good — they're not the problem).
- **Current decade auto-scrolled into view on load** (the spectrum still shows everything above it, so past chapters don't push "now" out of reach).
- **Category legend / filter chips** under the spectrum (the 6 existing category colors). Tapping a chip dims non-matching markers *and* cards — lets Max see e.g. only "family" goals across the whole life. Single-select, tap again to clear.

### What stays

GoalEditor, GoalDetail, backend API, data model — **unchanged**. This is a presentation-layer redesign of `Goals.tsx` + `goalsLogic.ts` only.

## 3. Development plan

| # | Task | Files | Notes |
|---|---|---|---|
| 1 | Pure logic: `spectrumData(goals, birthYear, thisYear)` → `{ markers: [{yearPct, color, achieved, goalId, decade}], nowPct, decades }`; extend `buildDecades` to include past decades + `lived` flag + `isEmpty` | `src/pages/rd/goalsLogic.ts` (+ Vitest) | Year→% math, stacking/`+n` clustering, all edge ages (age 0 goals, age 90, unknown-year goals → "someday" shelf at the far right) |
| 2 | `LifeSpectrum` component: track, markers, needle, decade tick labels, tap-to-jump, filter dimming | new `src/pages/rd/LifeSpectrum.tsx` | Pure SVG; `role="slider"`-free (it's a map, not an input) but each cluster is a labeled button for a11y |
| 3 | Chapters refactor: collapsed empty-decade rows, past-decade "lived" framing, auto-scroll to current decade, category chips | `src/pages/rd/Goals.tsx` | `useRef` map of decade anchors for scroll targets |
| 4 | Sticky-spectrum layout + polish (safe-area, reduced-motion: no marker glow animation) | `Goals.tsx` | Sticky inside AppShell's scroll div — verify on iOS standalone (known scroll-container quirks; portal rule doesn't apply since this isn't a fixed overlay) |
| 5 | QC: tests green, build, on-device pass (installed PWA, close+reopen twice for SW) | — | Live-verify via `nlp-training-tool.vercel.app` alias (heart.sovereignty.app is DNS-blocked from the sandbox) |

**Effort:** ~1 focused day. **Risk:** low — no backend, no data migration; the one thing to watch is `position: sticky` behavior inside the AppShell scroll container on iOS standalone (fallback: non-sticky spectrum at top, still delivers the at-a-glance view).

## 4. Open decisions (defaults chosen, flag if you disagree)

1. **Past-decade goals:** default = allow placing goals in past decades (they render as memories/achieved). Alternative: past chapters are read-only context.
2. **"Someday" goals:** goals without a target year get a shelf at the right edge of the spectrum + a "Someday" chapter after the 80s. (Currently a year is required — this would relax that; can defer.)
3. **Spectrum height:** compact 64px band vs. a taller 110px band with category lanes. Default = compact; lanes are a v3 option if density grows.
