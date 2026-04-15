# Chat Workspace Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework the Alignment Engine workspace so today’s Daily Session auto-opens as the primary thread, general chat becomes an optional mode, conversation history lives in the sidebar, normal chats can be deleted, new chats open directly into the composer, and the result is previewed safely in a development environment while the prior audio-generation auth failure is diagnosed separately.

**Architecture:** Keep the current `/hypnosis` route as the single workspace surface, but change its boot logic and layout so the active thread is selected first and the history list becomes a persistent sidebar. Extend the existing sessions API and session persistence layer rather than introducing a new store. Implement deletion only for `general_chat` sessions at the backend, then wire the frontend to optimistically remove deleted sessions and immediately focus newly created chats.

**Tech Stack:** React 19 + Vite + TypeScript frontend, Express backend, SQLite via `sql.js`, Clerk-authenticated API requests, development preview deployment.

---

### Task 1: Add backend coverage for deleteable normal chats and daily-session preservation

**Files:**
- Modify: `server/services/memory-conversations.test.js`
- Modify: `server/db/session-migrations.test.js` only if schema behavior needs extra regression coverage

**Step 1: Write the failing test**

Add one test proving that deleting a `general_chat` session removes it from sidebar results for that user, and one test proving a `daily_hypnosis` session cannot be deleted through the same helper.

**Step 2: Run test to verify it fails**

Run: `cd server && node --test services/memory-conversations.test.js`

Expected: FAIL because no deletion helper exists yet or daily-session protection is missing.

**Step 3: Write minimal implementation**

Implement only the persistence helpers required by the test, including ownership-safe lookup and deletion rules that reject `daily_hypnosis` deletion.

**Step 4: Run test to verify it passes**

Run: `cd server && node --test services/memory-conversations.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add server/services/memory-conversations.test.js server/services/memory.js
git commit -m "test: cover chat deletion rules"
```

### Task 2: Expose delete-session and sidebar-friendly session APIs

**Files:**
- Modify: `server/services/memory.js`
- Modify: `server/routes/profile.js`

**Step 1: Write the failing test**

Use the backend session test file to define the API-facing behavior indirectly: normal chats are deletable, daily sessions are not, and session ordering still prefers latest activity.

**Step 2: Run test to verify it fails**

Run: `cd server && node --test services/memory-conversations.test.js`

Expected: FAIL for missing delete helper and/or incorrect filtering behavior.

**Step 3: Write minimal implementation**

Add a deletion helper such as `deleteSessionForUser(sessionId, userId)` in `server/services/memory.js`. Update `server/routes/profile.js` to expose `DELETE /api/profile/sessions/:sessionId` and keep `GET /api/profile/sessions` returning enough metadata for the sidebar, including lock state, session type, title, timestamps, script/audio references, and ordering by latest activity.

**Step 4: Run tests to verify they pass**

Run: `cd server && node --test services/memory-conversations.test.js db/session-migrations.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add server/services/memory.js server/routes/profile.js server/services/memory-conversations.test.js
git commit -m "feat: add chat deletion api"
```

### Task 3: Add frontend API support for deleting chats and cleaner session selection

**Files:**
- Modify: `src/services/api.ts`
- Modify: `src/pages/Hypnosis.tsx`

**Step 1: Write the failing test or reproduction harness**

Because the project currently lacks a frontend automated test runner, document the failing reproduction in code comments or a developer checklist first: creating a new general chat currently adds a history card but does not reliably land inside the active composer; deleting a chat is unsupported.

**Step 2: Run the failing reproduction**

Run the app locally after frontend changes begin and verify the current broken behavior before fixing it.

Expected: New chat appears without reliably opening into an active thread, and no delete action exists.

**Step 3: Write minimal implementation**

Add `api.deleteSession(sessionId)` to `src/services/api.ts`. In `Hypnosis.tsx`, replace the current overview-first bootstrap with thread-first selection logic: load today’s daily session by default when available, otherwise initialize it; keep a top mode toggle for Daily Session versus Normal Chat; create general chats with `forceNew: true`; set the newly created session as selected immediately; clear stale state when switching; and focus the composer after new-chat creation completes.

**Step 4: Run verification**

Run: `npm run build`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/services/api.ts src/pages/Hypnosis.tsx
git commit -m "feat: prioritize daily session workspace"
```

### Task 4: Replace the current conversation cards with a true sidebar interaction model

**Files:**
- Modify: `src/pages/Hypnosis.tsx`
- Create only if needed: `src/components/ConversationSidebar.tsx`

**Step 1: Write the failing behavior definition**

Define the sidebar acceptance criteria in the implementation notes: conversation history is always visible on desktop, clearly separates today’s Daily Session from general chats, exposes delete affordances only on normal chats, and selecting any row opens that thread immediately.

**Step 2: Run the failing reproduction**

Verify the existing layout still renders large stacked cards rather than a compact sidebar.

Expected: FAIL against the acceptance criteria.

**Step 3: Write minimal implementation**

Refactor the left column into a tighter sidebar with sections such as `Today` and `Chats`, smaller row-based history items, a primary `Daily Session` entry, an optional `New Chat` action, and inline delete buttons for `general_chat` rows only. Keep the composer and message area as the primary visual focus. Ensure all text inputs continue to wrap and `Enter` adds a new line instead of sending automatically.

**Step 4: Run verification**

Run: `npm run build`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/pages/Hypnosis.tsx src/components/ConversationSidebar.tsx
git commit -m "feat: add sidebar-first chat workspace"
```

### Task 5: Diagnose and fix the recreated audio authorization mismatch

**Files:**
- Modify: `api/index.js`
- Modify: `server/routes/audio.js`
- Modify: `src/components/AuthProvider.tsx` only if token propagation is incomplete

**Step 1: Write the failing test or reproduction**

Create a backend regression test if practical around ownership/auth fallback, or otherwise reproduce the exact failure by creating a saved script under an authenticated user and attempting audio generation through the same deployment path.

**Step 2: Run it to verify it fails**

Run the relevant backend test or authenticated reproduction.

Expected: FAIL because one request path resolves the user differently from the next, most likely through `default-user` fallback in `api/index.js`.

**Step 3: Write minimal implementation**

Remove unsafe fallback behavior where an authenticated deployment silently maps missing Clerk auth to `default-user`, or align the ownership check in `server/routes/audio.js` so a script saved under the authenticated user remains generateable by that same user through the deployed API path.

**Step 4: Run verification**

Run the focused backend test and then the real authenticated audio generation flow.

Expected: PASS.

**Step 5: Commit**

```bash
git add api/index.js server/routes/audio.js src/components/AuthProvider.tsx
git commit -m "fix: align audio generation auth"
```

### Task 6: Verify the full flow and ship only to development preview

**Files:**
- Modify as needed: deployment configuration files only if preview wiring requires it
- Record results in: `docs/plans/2026-04-15-chat-workspace-redesign.md`

**Step 1: Run full verification**

Run:

```bash
npm run build
cd server && node --test db/session-migrations.test.js services/memory-conversations.test.js
```

Then manually verify these user flows in the development environment:

1. Opening `/hypnosis` lands directly inside today’s Daily Session.
2. Switching to normal chat creates and opens a fresh thread immediately.
3. Sidebar history selection opens the chosen thread.
4. Normal chat deletion removes the chat and never offers delete for daily sessions.
5. `Enter` inserts a new line and only the send button submits.
6. Recreated audio generation succeeds and the file appears in Audios.

**Step 2: Deploy to preview**

Deploy the feature branch to a development preview environment only.

**Step 3: Capture preview details**

Record the preview URL, commit SHA, and any known limitations.

**Step 4: Commit final adjustments**

```bash
git add .
git commit -m "chore: finalize chat workspace preview"
```

### Task 6 progress note: current preview deployment state

- Branch `chat-ux-dev` has been pushed to origin.
- Commit SHA currently deployed for preview: `646ae12cd9e008f32f1a253b37dbdff6566b4af2`.
- Vercel check returned `success` for the latest branch commit.
- Deployment overview: `https://vercel.com/max-maxwellmayes-projects/nlp-training-tool/FRaoPUmAHAAfYopJWHgXBUoBhp2r`
- Preview domain: `https://nlp-training-tool-git-chat-ux-dev-max-maxwellmayes-projects.vercel.app`
- Runtime verification note: the preview deployment currently loads the Alignment Engine shell but remains stuck on the `INITIALIZING` screen, so the preview is live but not yet fully review-ready.


### Preview verification notes update

The Vercel preview deployment is healthy at the platform level, but direct access to the preview domain is gated by Vercel authentication, which causes 401 responses for `/` and `/manifest.json` outside an authorized session and leaves the browser stuck on the app's `INITIALIZING` state.

A secondary sandbox-hosted preview was exposed publicly at `https://4173-i8heexvtz5afr70si7uai-23ad98d4.us2.manus.computer`. Static assets and `manifest.json` return `200 OK`, and the compiled bundle still contains the expected React bootstrap plus the fallback warning `Missing VITE_CLERK_PUBLISHABLE_KEY — auth will be disabled`. However, the page is still rendering a blank screen in browser verification, so this exposed preview is reachable but not yet trustworthy as a review environment.


### Audio recovery verification update

The recreated hypnosis audio is now confirmed in the live Audios library. The authenticated production page at `/audios` shows **two** entries titled `Living Your Full Identity and Self`, both marked `Audio Ready`. The newest recovered item is timestamped **Apr 15, 2026, 06:23 AM**, confirming that the regenerated upload ultimately completed successfully.


### Public preview recovery update

After guarding the layout's unconditional Clerk avatar widgets and rebuilding the worktree, the exposed development preview can render the app UI. A manual bundle execution in browser verification mounted the dashboard successfully, and the page now visibly shows the redesigned environment shell with navigation and the command dashboard. This confirms the public review environment is no longer fundamentally blank, though I still need to confirm whether the bootstrap issue resolves automatically on a fresh user visit or whether an additional initialization fix is required before treating it as stable.
