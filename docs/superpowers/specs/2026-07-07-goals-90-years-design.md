# Goals — "Your 90 years" — Design Spec

**Date:** 2026-07-07
**Status:** Approved (design), ready for implementation plan
**Source of truth:** `~/Downloads/NLP Trainer Redesign.zip` → `design_handoff_alignment_app/` (README.md + `Alignment Redesign.dc.html` prototype). Screens §6–§8, State Management, Nav.

## Summary

Add a brand-new **Goals** system to the nlp-trainer app ("Alignment"): a life-timeline where goals are pinned to decades of the user's 90-year life, each with category, target date, milestones, and material/experience rewards (with photos). Ships as a new bottom-nav tab plus three views: the timeline list, a full-screen goal editor, and a full-screen goal detail.

Built on the established `rd/` redesign pattern (see the 4 shipped redesign screens): pure logic module + Vitest, calm `--rd-*` tokens, full-screen overlays modeled on `src/pages/rd/Player.tsx`. No changes to existing screens except `BottomNav.tsx` and `App.tsx` routes.

## Decisions (locked)

1. **Reward image storage:** base64 data-URL stored inline in the DB (matches prototype; zero new file infra; delete-goal auto-cleans).
2. **Birth year capture:** one-time prompt on first Goals open. `birthYear` (default 1992) drives all age math. Persisted to `users.onboarding` JSON. Reduce-Motion toggle deferred.
3. **Integration:** feature branch → build → full QC/systematic-debugging → merge `main` → force-deploy prod (`vercel --prod --yes` + Railway) → verify live bundle.

## Backend

### Table (append to `server/db/index.js` `SCHEMA_SQL`)
```sql
CREATE TABLE IF NOT EXISTS goals (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT DEFAULT '',
  category    TEXT DEFAULT 'Health',
  target_date TEXT,                 -- ISO 'YYYY-MM-DD'
  milestones  TEXT DEFAULT '[]',    -- JSON [{ text, done }]
  rewards     TEXT DEFAULT '[]',    -- JSON [{ type:'material'|'experience', name, image }] (image = dataURL or '')
  completed   INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
```
JSON-in-TEXT columns match the existing `sessions.chat_messages` / `scripts` convention. No normalized child tables.

### birthYear
Store in `users.onboarding` JSON, mirroring `setUserTimezone`/`getUserTimezone` in `server/services/profile.js`:
- `getUserBirthYear(userId)` → number | null
- `setUserBirthYear(userId, year)` → validates 1920–2015, writes onboarding.birthYear
- Surface on `GET /api/profile` response (add `birthYear` to payload) and accept `birthYear` on `PUT /api/profile` (route already calls `updateProfile`; extend to also persist birthYear via the onboarding setter).

### Service — `server/services/goals.js` (+ `goals.test.js`)
Pure DB layer, ownership-checked, JSON parse/stringify at the boundary:
- `listGoals(userId)` → array of parsed goals (milestones/rewards as objects, completed as boolean), newest-relevant order (client re-groups by decade).
- `createGoal(userId, draft)` → inserts, returns parsed goal. Drops rewards with neither `name.trim()` nor `image` (prototype `saveGoal` rule).
- `updateGoal(userId, id, patch)` → ownership check, updates provided fields, bumps `updated_at`, returns parsed goal. 404-equivalent (null) if not owned.
- `deleteGoal(userId, id)` → ownership-checked delete.
- Use `safeJsonParse` (existing) for milestones/rewards so a corrupt row can't 500 the list.

### Route — `server/routes/goals.js`, mounted `app.use('/api/goals', requireAuth, goalsRouter)` in `server/index.js`
- `GET /api/goals` → `{ goals: [...] }`
- `POST /api/goals` (body = draft) → `{ goal }`, 201
- `PUT /api/goals/:id` (body = patch, incl. `completed` for mark-achieved) → `{ goal }` or 404
- `DELETE /api/goals/:id` → `{ success: true }` or 404
Follow the error-handling shape of `server/routes/profile.js` (try/catch, `console.error`, 500 JSON).

## Frontend (all under `src/pages/rd/`)

### `goalsLogic.ts` (pure, Vitest — port the prototype exactly)
Given `birthYear` and `thisYear` (from client clock — timeline is presentational):
- `curAge = max(0, thisYear − birthYear)`.
- **Goal → card** (`goalToCard`): `year = parseInt(targetDate.slice(0,4)) || thisYear`; `age = year − birthYear`; `total/doneCount` from milestones; `prog = completed ? 100 : (total ? round(doneCount/total*100) : 0)`; first-image thumb list (≤3, overlapping); `rewardLine` = `''` if none, else single→named name or "A reward waiting", else "N rewards waiting"; `metaLine = "{year} · age {age} · {category}"`; `showProgress = prog > 0`; achieved → sage border + "achieved" label.
- **Decades:** `startDec = min(80, max(0, floor(curAge/10)*10))`; loop `d0 = startDec..80 step 10`. Goal belongs to decade `d0` iff `max(startDec, floor(min(89, max(curAge, year−birthYear))/10)*10) === d0`. Per decade: `label "{d0}s"`, `years "{birthYear+d0} – {birthYear+d0+9}"`, `isNow = curAge ≥ d0 && curAge < d0+10`, dot state (now → glowing blue, has-goals → soft blue, empty → faint), goals sorted by `targetDate`, add-row label ("Add a goal for your {d0}s" or "+ add another") and prefill date year (`isNow ? thisYear+1 : birthYear+d0+2`).
- `GOAL_CATS`: Health `#A9C6B3`, Wealth `#7FB4D9`, Family `#C7A9B4`, Craft `#9DB4CC`, Adventure `#B3D6EC`, Spirit `#A5A3C9`. Default Health.
- Draft validity: `title.trim().length > 0 && !!targetDate`.
- `ageAtLine(birthYear, targetDate)` → "You'll be {age} when this comes true." (editor live line).

### `Goals.tsx` (`/goals`, inside `AppShell`)
- Header: H1 "Your 90 years", sub "Every goal, pinned to the life it belongs to.", 42px circular gradient **+** button (opens editor, no prefill date).
- Life bar: 5px track, gradient fill to `curAge/90`, glowing 11px dot; labels "age {curAge}" / "90".
- Decade rail (vertical): node dot + fading line per decade; header serif "{d0}s" + years range + "you are here" pill on current.
- Goal cards per README §6 (full-bleed reward photo bg when present + dark gradient, meta row, serif title, reward thumb strip + line, progress bar once `showProgress`, sage border when achieved). Tap → detail overlay.
- Each decade ends with a dashed add-goal row (prefills target date in that decade).
- Empty state (no goals at all): italic serif "Ninety years is longer than you think. What belongs in yours?"
- **First-visit birth-year prompt:** if `birthYear` is null, render a calm inline prompt ("What year were you born?", number input, Continue) before the timeline; on submit `PUT /api/profile { birthYear }` then render timeline.
- Holds overlay state: `goalOverlay` ('editor'|'detail'|null), `detailId`, `draft`, `deleteArmed` — mirrors prototype.

### `GoalEditor.tsx` (full-screen overlay, like `Player`)
Per README §7: header (× close, "New goal"/"Edit goal", Save pill disabled until valid); fields with uppercase eyebrow labels — The goal (text), Why it matters (textarea), When (dark date picker + live "You'll be {age}…" line), Life area (6 category chips), Milestones (rows + × remove, input + square + button, Enter adds), Rewards (54px photo square → file picker → **canvas downscale max 900px, JPEG 0.78 → dataURL**; name input with type placeholder; Material/Experience label + × remove; two dashed add buttons). Save: drop rewards with neither name nor image; POST (new) or PUT (edit); new goal → open its detail.

### `GoalDetail.tsx` (full-screen overlay)
Per README §8: hero image (300px) when any reward has a photo, content overlaps −76px; else plain spacing. Overlaid back + edit-pencil buttons (blurred). Meta row + serif title 30px + description. Progress card (label + "{done} of {total}", gradient bar, tappable milestone rows toggling done via PUT). "Waiting for you" rewards grid (2-col, image or tinted material/experience placeholder). "Mark as achieved" pill (PUT completed toggle). "Delete this goal" two-tap confirm (turns `#C98A8A`) → DELETE → back to list.

### Nav — `BottomNav.tsx` + `App.tsx`
- Add **Goals** tab. New 6-slot grid (`repeat(6,1fr)`), order **Home · Goals | orb | Insights · Library · You** (spec-mandated; Insights moves to right group). Goals icon: stroke SVG (target/flag), 20–21px, 1.7 stroke, active `--rd-ink` / inactive `--rd-dim`.
- Add `<Route path="/goals" element={<Goals />} />` inside `AppShell` in **both** route blocks (SignedIn + fallback) of `App.tsx`, lazy-imported.

## State & data contract

Goal shape (client): `{ id, title, description, category, targetDate (ISO), milestones:[{text,done}], rewards:[{type,name,image}], completed }`. Server column `target_date` ↔ client `targetDate` (map in service or api layer — pick one boundary and keep it consistent). `completed` boolean client / INTEGER db.

User settings: `birthYear` (onboarding JSON). `userName` already sourced from Clerk on Home. `reduceMotion` deferred → new looping animations (life-bar dot pulse, orbs) use CSS `prefers-reduced-motion` like `Player`.

## Out of scope (v1)
- Reduce-Motion in-app toggle (CSS media query only).
- Deep-linking/route for a specific goal (editor/detail are in-page overlays).
- Normalized milestone/reward tables (JSON columns instead).
- Image CDN / volume-file storage (base64-in-DB instead; revisit if DB bloat becomes real).

## QC / systematic-debugging loop
1. Unit: `goalsLogic` Vitest (age math, decade placement edge cases, reward line, progress), `goals` service tests (CRUD, ownership, reward-drop rule, JSON round-trip).
2. `tsc` typecheck + `vite build` clean.
3. Server tests green (`npm test` in `server/`).
4. Live Chrome walkthrough on deployed prod: first-visit birth-year prompt → create goal + photo upload → correct decade placement + meta → edit → milestone toggle/progress → mark achieved (sage border) → two-tap delete → nav order/active states → console clean.
5. systematic-debugging skill on anything surfaced.
6. Verify live: grep deployed `/assets/*.js` for a distinctive Goals string ("Your 90 years").

## Files
**New:** `src/pages/rd/Goals.tsx`, `GoalEditor.tsx`, `GoalDetail.tsx`, `goalsLogic.ts`, `goalsLogic.test.ts`; `server/routes/goals.js`; `server/services/goals.js`, `goals.test.js`.
**Modified:** `server/db/index.js` (table), `server/services/profile.js` (birthYear get/set), `server/routes/profile.js` (birthYear in/out), `server/index.js` (mount route), `src/services/api.ts` (goals + birthYear), `src/components/rd/BottomNav.tsx` (Goals tab), `src/App.tsx` (route).
