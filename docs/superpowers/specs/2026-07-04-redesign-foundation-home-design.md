# App Redesign — Foundation + Home — Design Spec

- **Date:** 2026-07-04
- **Status:** Draft for review
- **Repo:** maxwellt7/nlp-trainer (React 19 + Vite + Tailwind v4; frontend on Vercel `heart.sovereignty.app`, backend on Railway)
- **Source mockup:** `~/Downloads/NLP Trainer Redesign.html` (interactive multi-screen prototype)

## 1. Summary

First sub-project of a full visual + IA redesign toward a calm, editorial, therapeutic
aesthetic. This spec covers the **shared foundation** (design tokens, fonts, the
bottom-nav app shell, reusable primitives) and the **Home screen**. Insights, You, and
Library are redesigned in later sub-projects; during this transition they keep their
current screens but are reached through the new bottom nav.

Frontend-only. No backend/API changes — the redesign re-presents existing data.

## 2. Decomposition (whole redesign)

Independent sub-projects, each its own spec → plan → build:
1. **Foundation + Home** (this spec)
2. Insights
3. You (Identity/values + profile)
4. Library (audios + history)

Home leads because it establishes the visual language the others inherit.

## 3. Locked decisions

| Decision | Choice |
|---|---|
| Aesthetic | Faithful to the mockup's visual language; adapt only where real data differs from sample content |
| Screen scope | Mobile-first, centered column; on desktop a centered narrow column (no bespoke wide layouts) |
| Navigation | Bottom tab bar (Home · Insights · **orb** · Library · You) **replaces** the left sidebar app-wide |
| Center orb | Opens a **chooser sheet**: Daily Session / General Chat × Text / Voice, then launches the chat |
| Transition | Foundation swaps the shell app-wide; only Home is rebuilt now. Insights/You/Library render their CURRENT screens inside the new shell until redesigned |
| Tokens | New calm palette added under NEW token names; existing gold tokens untouched so un-redesigned screens keep working |
| Voice option in chooser | Present but **disabled ("Voice — coming soon")** until the paused voice feature ships (see [[project-nlp-voice-feature]]) |

## 4. Design tokens (extracted from the mockup)

Add to `src/index.css` `@theme` under new names (do NOT overwrite `--color-brand-*` /
`--color-accent-gold*`; old screens still use those).

**Fonts** (add Google Fonts import alongside the existing one):
- `Newsreader` (serif) — display/headings; italic for names/emphasis.
- `Albert Sans` (sans) — UI/body.
- Tokens: `--font-display: 'Newsreader', serif;` `--font-sans: 'Albert Sans', sans-serif;`

**Color** (calm palette):
- `--rd-bg: #06121c;` (deep navy base) · `--rd-bg-deep: #081018;`
- `--rd-ink: #eaf0f4;` (primary text) · `--rd-ink-soft: #d3dee8;`
- `--rd-muted: #9db4cc;` · `--rd-muted-2: #6b8095;` · `--rd-dim: #5b7085;`
- `--rd-accent: #5a93bd;` (soft blue) · `--rd-accent-bright: #7fb4d9;` · `--rd-accent-deep: #3e6a8c;`
- `--rd-sage: #a9c6b3;` (secondary; streak/"growing") · `--rd-sage-soft: #c9e0d1;`
- `--rd-surface: rgba(255,255,255,0.05);` · `--rd-surface-2: rgba(255,255,255,0.07);` · `--rd-border: rgba(255,255,255,0.08);`
- `--rd-accent-glow: rgba(90,147,189,0.35);` (orb/card glow)
- `--rd-danger: #ff8a80;`

**Radii/scale:** `--rd-radius-card: 20px;` (softer than current 12px) · `--rd-radius-pill: 999px;`
Type scale (display): greeting ~34px, card title ~22px, section label 11px uppercase +tracking. (Confirm exact sizes against the mockup during build; faithful, not pixel-perfect.)

## 5. App shell / navigation

- **New `AppShell`** (replaces `Layout`'s sidebar chrome): a centered column
  (`max-width ~440px`, horizontally centered on desktop) with a fixed **bottom tab
  bar** and safe-area padding for iOS.
- **`BottomNav`**: 4 tabs + center orb. Tabs: Home (`/`), Insights (`/insights`),
  Library (`/library` → temporary alias to current audios/history), You (`/you` →
  temporary alias to current identity/profile). Active state via `NavLink` on distinct
  paths.
- **`Orb`**: centered raised glowing button; opens `ChooserSheet`.
- **`ChooserSheet`** (bottom sheet): pick **Daily Session** or **General Chat**, and
  **Text** (enabled) or **Voice** (disabled, "coming soon"). On confirm, navigate to the
  existing chat route in the chosen mode (`/hypnosis` daily, `/chat` general — reuses the
  route/mode logic already built). Voice wiring is deferred to the voice sub-project.
- Old routes remain valid; the shell just reframes navigation. Admin stays at `/admin`
  (not in the tab bar), reachable from You for admins.

## 6. Reusable primitives (new components under `src/components/rd/`)

Each small and single-purpose:
- `Screen` — centered scroll column with consistent page padding.
- `Card` — translucent surface, `--rd-radius-card`, subtle border/glow.
- `SectionLabel` — uppercase tracked label ("YOUR WEEK", "RECENT REFLECTIONS").
- `BottomNav`, `Orb`, `ChooserSheet` — as above.
- `StreakDots` — 7-day row (filled/empty/today states).

Interfaces are plain prop objects (data in, presentational out); no data fetching inside
primitives — screens fetch and pass data down.

## 7. Home screen (`src/pages/rd/Home.tsx`, mounted at `/`)

Sections top-to-bottom (matching the mockup):
1. **Greeting** — date line (e.g. "SATURDAY, JULY 4") + "Good {timeOfDay}, {firstName}"
   (serif; name italic). `timeOfDay` from local clock; `firstName` from the user (Clerk
   profile / existing profile data).
2. **Tonight's Session** card — "Ready when you are." + subcopy + **Begin** button →
   opens today's Daily Session (`/hypnosis`, existing flow).
3. **Your Week** — `StreakDots` + "N days in a row". Data: `GET /api/profile/streak`
   (existing) → derive 7-day filled state + current streak.
4. **Recent Reflections** — list of recent session summaries (date + summary + tags).
   Data: `GET /api/profile/sessions?limit=…` (existing) → map `chat_summary` + derived
   tags/date. Tapping one opens that thread (`/hypnosis?sessionId=…`, existing).
5. **Footer stat** — "N sessions · H hours of inner work · one conversation at a time."
   Derived from streak/session totals (sessions count; hours estimated from session
   count × avg, or omitted if not derivable — no fabricated numbers).

Empty/new-user states: friendly, on-brand copy (no blank sections); reuse the
`RouteErrorBoundary` already in place.

## 8. Data mapping (all existing endpoints; no backend work)

| UI piece | Source |
|---|---|
| Greeting name | user profile / Clerk |
| Streak dots + "N days" | `GET /api/profile/streak` |
| Recent reflections | `GET /api/profile/sessions` |
| Session/hours stat | streak/session totals |

If any field isn't available from current endpoints, the section degrades gracefully
(hidden or shows an honest empty state) rather than showing mock data.

## 9. Transition & isolation

- Building the shell app-wide but only rebuilding Home means old screens render inside
  the new shell temporarily. They keep their gold tokens (untouched), so they look like
  themselves until each is redesigned — visually "mixed" briefly, but functional.
- New code lives under `src/components/rd/` and `src/pages/rd/` to keep the redesign
  isolated and reviewable; old files are removed per-screen as each is redesigned.

## 10. Testing

- Frontend build (`tsc -b && vite build`) green.
- Manual verification on iPad (installed PWA) + desktop: nav, orb → chooser, Begin flow,
  Home data rendering, empty-state.
- Keep all existing server tests green (no backend changes).
- Deploy note: Vercel git auto-deploy has been flaky — force `vercel --prod --yes` after
  the frontend push and verify the live bundle (see [[project-nlp-voice-feature]] gotcha).

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Mixed old/new visuals during transition | Expected + acceptable; new tokens are additive so old screens are unaffected; redesign screens in quick succession |
| Font loading flash | Preload Newsreader/Albert Sans; `font-display: swap`; fallback stack |
| Chooser's Voice path not built | Ship Voice disabled ("coming soon"); Text path uses existing chat |
| iOS safe areas / bottom nav overlap | Use `env(safe-area-inset-bottom)` padding in `AppShell`/`BottomNav` |
| Streak/reflection data shape differs from mock | Map from real endpoints; graceful degradation, no fabricated numbers |

## 12. Open questions
- Exact Newsreader weights/sizes per element (resolve visually against the mockup during build).
- "Hours of inner work" — derive from session count × average, or omit? (Default: omit if not cleanly derivable.)
