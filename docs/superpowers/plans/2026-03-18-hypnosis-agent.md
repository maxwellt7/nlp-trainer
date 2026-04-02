# Hypnosis Agent Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Hypnosis feature that conducts an adaptive intake chat and generates ElevenLabs-ready self-hypnosis scripts with SSML break tags, using the full NLP knowledge base.

**Architecture:** New Hypnosis page (3-state: welcome → intake chat → script display), new backend route with chat and generate endpoints, new hypnotist system prompt. Reuses existing Chat component and NLP data loading patterns from practice routes.

**Tech Stack:** React, TypeScript, Express, Anthropic SDK (existing stack)

**Spec:** `docs/superpowers/specs/2026-03-18-hypnosis-agent-design.md`

---

## Chunk 1: Backend + Frontend

### Task 1: Create hypnotist system prompt

**Files:**
- Create: `server/data/prompts/hypnotist.txt`

- [ ] **Step 1: Create hypnotist.txt**

The prompt instructs Claude to respond in JSON during intake, use NLP patterns, and generate SSML-formatted scripts.

- [ ] **Step 2: Commit**

```bash
git add server/data/prompts/hypnotist.txt
git commit -m "feat: add hypnotist system prompt"
```

---

### Task 2: Create hypnosis backend route

**Files:**
- Create: `server/routes/hypnosis.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create hypnosis.js with chat and generate endpoints**

Pattern follows existing `practice.js` — uses `loadAllContent()` and `loadPrompt()` helpers (copy from practice.js since they share the same data dir structure).

Two endpoints:
- `POST /chat` — intake conversation, `max_tokens: 1024`, parses JSON response for `reply` and `readyToGenerate`
- `POST /generate` — script generation, `max_tokens: 8192`, parses JSON response for `title`, `duration`, `estimatedMinutes`, `script`

- [ ] **Step 2: Register route in server/index.js**

Add:
```js
import hypnosisRoutes from './routes/hypnosis.js';
app.use('/api/hypnosis', hypnosisRoutes);
```

- [ ] **Step 3: Test endpoints**

```bash
curl -s -X POST http://localhost:3001/api/hypnosis/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"I want to sleep better"}]}' | head -c 300
```

- [ ] **Step 4: Commit**

```bash
git add server/routes/hypnosis.js server/index.js
git commit -m "feat: add hypnosis API routes for chat and script generation"
```

---

### Task 3: Add hypnosis API methods to frontend

**Files:**
- Modify: `src/services/api.ts`

- [ ] **Step 1: Add hypnosis methods**

Add to the api object:
```ts
// Hypnosis
hypnosisChat: (messages: any[]) =>
  request<any>('/hypnosis/chat', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  }),
hypnosisGenerate: (messages: any[]) =>
  request<any>('/hypnosis/generate', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  }),
```

- [ ] **Step 2: Commit**

```bash
git add src/services/api.ts
git commit -m "feat: add hypnosis API methods"
```

---

### Task 4: Create Hypnosis page

**Files:**
- Create: `src/pages/Hypnosis.tsx`

- [ ] **Step 1: Create Hypnosis.tsx with 3 states**

**Welcome state:** Description text + "Start Session" button.

**Intake state:** Reuses Chat component with `coached={false}`. On each assistant message, check `readyToGenerate`. When true, show "Generate Script" button above the chat input. Cancel button to return to welcome.

**Script state:** Renders title, duration badge, script text with SSML tags parsed into visual pause markers, Copy Script button, New Session button.

Script rendering: regex-replace `<break time="Xs"/>` with styled React elements (thin horizontal line with duration label).

- [ ] **Step 2: Commit**

```bash
git add src/pages/Hypnosis.tsx
git commit -m "feat: add Hypnosis page with intake chat and script display"
```

---

### Task 5: Wire Hypnosis into app

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1: Add route to App.tsx**

```tsx
import Hypnosis from './pages/Hypnosis';
// Add inside Route element:
<Route path="/hypnosis" element={<Hypnosis />} />
```

- [ ] **Step 2: Add nav item to Layout.tsx**

Insert between Practice and Reference in the navItems array:
```ts
{ to: '/hypnosis', label: 'Hypnosis', icon: '✦' },
```

- [ ] **Step 3: Verify full flow**

1. Click Hypnosis in nav → see welcome screen
2. Click Start Session → chat with agent
3. Answer questions → see "Generate Script" button appear
4. Click Generate → see script with pause markers
5. Click Copy Script → clipboard has raw SSML text
6. Click New Session → back to welcome

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/Layout.tsx
git commit -m "feat: wire Hypnosis page into app navigation and routes"
```
