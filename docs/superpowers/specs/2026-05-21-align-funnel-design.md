# Align Funnel — System Design

**Date:** 2026-05-21
**Status:** Draft — awaiting user approval before writing-plans
**Related docs:**
- Copy + UX spec: `~/Documents/Claude/Projects/❤️ Sacred Heart/Alignment Engine — Quiz Funnel Build Plan.md`
- nlp-trainer system map: `~/Desktop/nlp-trainer-system-map.md`
- Project memory: `project_nlp_trainer.md`

## 1. Goals

Build a new, hand-coded quiz funnel hosted at `align.sovereignty.app/start` that replaces the existing 5-question quiz at `start.sovereignty.app/quiz` with the 9-question "Alignment Diagnostic" defined in the build plan.

Functional goals:

1. Deliver the 9-question quiz, email gate, programmatic results page (12 variants = 4 programs × 3 depth bands), and $7-with-$27-bump Stripe Checkout flow.
2. Persist every lead in the existing `nlp-trainer` Railway backend (single system of record).
3. Send a 6-email branched drip sequence via **Resend** (not GHL) with one-click unsubscribe and purchase-exit handling.
4. Fire Meta Pixel + CAPI events at the canonical funnel points: `Lead` at the email gate, `InitiateCheckout` at the offer CTA, `Purchase` on Stripe webhook success.
5. Hand off purchasers to the existing `heart.sovereignty.app` provisioning flow (zero changes to that side).

Quality goals:

- Mobile-first UX that meets all of build-plan Section 8.5 (one-question-per-screen, tap-to-advance, ≤350 ms transitions with no blank frames, persistent progress, ≥44 px tap targets, back button preserves answers).
- Idempotent backend ingestion — repeated submits or retried webhooks never double-tag, double-email, or double-bill.
- 100 % test coverage on the scoring engine (deterministic) and result-routing function.
- Fully observable failure modes — leads never silently lost.

## 2. Non-goals

- Fixing the 3 known defects on the **existing** `start.sovereignty.app` landing page (build-plan §8.4). The new funnel starts clean.
- Multivariate quiz-length test (build-plan §7's 6Q / 9Q / 12Q split test). Ships medium (9Q) only; length test is a follow-up.
- Privacy-policy edits in the heart app (still references Meta Llama — separate decision).
- Changes to Stripe pricing, the order-bump fulfillment process, or the heart-app provisioning flow.
- Changes to the existing `start.sovereignty.app` deployment — it stays running until traffic cuts over.

## 3. Architecture overview

```
                  ┌───────────────────────────────────────────────┐
                  │  Meta ads / cold traffic                       │
                  └───────────────────┬───────────────────────────┘
                                      ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  align.sovereignty.app  (NEW — Vercel, Next.js 16 App Router)│
   │                                                                │
   │  Pages:                                                        │
   │    /                — minimal shell → /start                  │
   │    /start           — quiz state machine (client)              │
   │    /start/result    — SSR result page (token-gated)            │
   │    /checkout/success — bounce to heart.sovereignty.app/sign-up │
   │    /checkout/cancel  — soft cancel page                        │
   │                                                                │
   │  Server (API routes):                                          │
   │    /api/quiz/submit  — score answers → POST to nlp-trainer    │
   │                        → return signed lead_token              │
   │    /api/quiz/event   — proxy to nlp-trainer for CAPI events   │
   │    /api/checkout     — create Stripe Checkout Session          │
   │                        with diagnostic metadata                │
   │                                                                │
   │  Tracking: Meta Pixel 2035820893688270 (client) + CAPI         │
   │  (forwarded via nlp-trainer's existing /api/quiz/event).       │
   └─────────────┬─────────────────────────────────────┬───────────┘
                 │ POST /api/quiz/lead (extended)      │
                 │ POST /api/quiz/event                │ Stripe.com
                 ▼                                     │ (Checkout)
   ┌──────────────────────────────────────────────────────────────┐
   │  nlp-trainer (Railway, EXISTING)                              │
   │                                                                │
   │  EXTEND quiz_leads schema (+13 columns).                      │
   │  EXTEND /api/quiz/lead to accept new fields + auto-enqueue    │
   │  6 email_sends rows.                                          │
   │                                                                │
   │  NEW table:    quiz_email_sends                               │
   │  NEW endpoint: GET /api/quiz/lead/:token  (token-scoped read) │
   │  NEW endpoint: GET /api/email/unsubscribe?token=…             │
   │  NEW endpoint: POST /api/email/resend-webhook                 │
   │  NEW cron:     funnel-drip-scheduler (every 15 min)           │
   │  NEW emails/:  6 React Email templates + shared layout        │
   │                                                                │
   │  EXISTING /api/stripe-webhook (one new line: mark             │
   │  quiz_leads.purchased = 1 on checkout.session.completed).     │
   │  EXISTING /api/provision-access (no change).                  │
   │  EXISTING handleQuizLead in GHL service (extended to send     │
   │  the new tags: program, depth_band; custom fields q9_fear).   │
   └────────┬───────────────────────────────────┬─────────────────┘
            │                                   │
            ▼                                   ▼
   ┌─────────────────────┐             ┌──────────────────────┐
   │ Resend (NEW)         │             │ Existing externals    │
   │  - Domain verify     │             │  - GoHighLevel        │
   │  - 6 templates       │             │  - Clerk              │
   │  - Webhooks: open,   │             │  - Stripe             │
   │    click, bounce,    │             │  - Meta Graph (CAPI)  │
   │    complained        │             │  - Pinecone, Dropbox  │
   └─────────────────────┘             └──────────────────────┘
```

### Key principles

- **Funnel is a thin Next.js app.** No DB on the funnel side. State-machine quiz UI, scoring done server-side on submit, Stripe checkout creation, success/cancel handoff. Everything else proxies to nlp-trainer.
- **nlp-trainer is system of record.** All lead data persists there; the funnel never owns user state. Adding 1 new table (`quiz_email_sends`) + extending 1 (`quiz_leads`).
- **Email drip is server-cron + Resend.** Same cron pattern as the existing Dropbox→Pinecone sync. Drip job is idempotent (no double-sends), per-lead unsubscribe token, exits any lead who purchases.
- **Existing infrastructure is reused untouched** for: Stripe webhook handling, Clerk provisioning, Meta CAPI events, GHL contact creation (just adding new tags). Zero touch on `start.sovereignty.app` or the heart app.
- **No data sync needed** between the funnel and the admin dashboard — both already read from `quiz_leads`.

## 4. Repository + tech stack

### 4.1 New repo

- **GitHub:** `maxwellt7/align-funnel` (private).
- **Local clone:** `~/Desktop/align-funnel/`.
- **Hosting:** Vercel project `align-funnel`, production domain `align.sovereignty.app`.
- **CI:** Vercel auto-deploys main → production; PRs get preview URLs (same setup as the existing nlp-training-tool Vercel project).

### 4.2 Stack

- **Framework:** Next.js 16 App Router + TypeScript (`strict`).
- **Styling:** Tailwind CSS 4 + class-variance-authority for variants. Dark theme matching the Alignment Engine palette (`#0a0a0f` background, gold `#b8860b` accents). Cinzel for display, Inter for UI.
- **State:** Zustand for the quiz state machine. No Redux, no Context-only.
- **Stripe:** `stripe` Node SDK for server-side Checkout Session creation. Server-only env var on Vercel.
- **Resend:** `resend` Node SDK (used by nlp-trainer backend, NOT by the funnel).
- **Email templating:** `@react-email/components` (lives in nlp-trainer's `server/emails/`).
- **Testing:** Vitest for unit + integration, Playwright for E2E.
- **Lint/format:** ESLint (Next config) + Prettier.

### 4.3 File layout

```
align-funnel/
├── app/
│   ├── layout.tsx                  # root layout — fonts, Meta pixel script, theme
│   ├── page.tsx                    # landing (/) — minimal shell → /start
│   ├── start/
│   │   ├── page.tsx                # quiz host (client)
│   │   ├── result/
│   │   │   └── page.tsx            # SSR result render (reads ?token=...)
│   │   └── thanks/page.tsx         # post-Q9 fallback (rare)
│   ├── checkout/
│   │   ├── success/page.tsx        # bounces to heart.sovereignty.app/sign-up
│   │   └── cancel/page.tsx         # soft cancel
│   ├── api/
│   │   ├── quiz/submit/route.ts    # POST → score → forward → return lead_token
│   │   ├── quiz/event/route.ts     # POST → proxy to nlp-trainer
│   │   └── checkout/route.ts       # POST → Stripe Checkout Session
│   ├── privacy/page.tsx            # static
│   └── terms/page.tsx              # static
├── components/
│   ├── quiz/
│   │   ├── QuizFlow.tsx            # state machine root (client)
│   │   ├── QuestionScreen.tsx      # single-question presenter (tap-to-advance)
│   │   ├── ProgressBar.tsx
│   │   ├── EmailGate.tsx
│   │   └── transitions.ts          # framer-motion presets (≤350 ms)
│   ├── result/
│   │   ├── ResultPage.tsx          # composes: comfort → bad news → good news → offer
│   │   ├── ProgramBadNews.tsx
│   │   ├── GoodNews.tsx
│   │   └── OfferBlock.tsx
│   └── ui/                         # primitive components
├── lib/
│   ├── quiz/
│   │   ├── questions.ts            # the 9 questions as typed config (single source of truth for copy)
│   │   ├── scoring.ts              # pure: { pattern + depth → program + band }
│   │   └── routing.ts              # { program, band } → result-page variant
│   ├── api/
│   │   ├── nlp-trainer.ts          # typed client to backend
│   │   ├── stripe.ts               # server-side Stripe wrapper
│   │   └── tracking.ts             # Meta Pixel client + CAPI forwarder
│   └── env.ts                      # typed env vars (zod)
├── tests/
│   ├── unit/                       # vitest
│   ├── integration/                # backend contracts (against local nlp-trainer)
│   └── e2e/                        # playwright
├── public/
├── next.config.ts
├── tailwind.config.ts
├── vercel.json
├── package.json
└── README.md
```

## 5. Backend changes (nlp-trainer)

All backend changes ship as a single feature branch + PR. No standalone backend service.

### 5.1 Schema migrations

Run via boot-time `try { ALTER TABLE ... } catch (column-already-exists)` blocks for additive columns, and `CREATE TABLE IF NOT EXISTS` for new tables. Idempotent under repeated deploys.

**`quiz_leads` — additive columns:**

| Column                | Type    | Notes                                         |
|-----------------------|---------|-----------------------------------------------|
| `pattern_scores`      | TEXT    | JSON `{"A":n,"B":n,"C":n,"D":n}` (0..7 each)  |
| `result_program`      | TEXT    | enum: `over-preparer` / `self-censor` / `invisible-ceiling` / `loop` |
| `depth_score`         | INTEGER | 0..12                                         |
| `depth_band`          | TEXT    | enum: `surface` / `established` / `deep-rooted` |
| `q2_style`            | TEXT    | enum: `driven` / `analytical` / `instinctive` / `strategic` |
| `q9_fear`             | TEXT    | raw answer text (drives Email 4 merge)        |
| `utm_source`          | TEXT    |                                               |
| `utm_medium`          | TEXT    |                                               |
| `utm_campaign`        | TEXT    |                                               |
| `utm_content`         | TEXT    |                                               |
| `gate_at`             | TEXT    | ISO timestamp — drip clock starts here        |
| `unsubscribed`        | INTEGER | 0/1, default 0                                |
| `purchased`           | INTEGER | 0/1, default 0; set by stripe-webhook         |
| `bump_purchased`      | INTEGER | 0/1, default 0; set by stripe-webhook         |

**New table `quiz_email_sends`:**

```sql
CREATE TABLE IF NOT EXISTS quiz_email_sends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_lead_id INTEGER NOT NULL REFERENCES quiz_leads(id),
  email_num INTEGER NOT NULL,            -- 1..6
  status TEXT NOT NULL,                  -- queued | sent | failed | skipped_purchased | skipped_unsubscribed
  resend_message_id TEXT,
  error_message TEXT,
  scheduled_for TEXT NOT NULL,           -- ISO; gate_at + offset
  sent_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (quiz_lead_id, email_num)       -- guarantees no duplicate scheduling
);
CREATE INDEX IF NOT EXISTS idx_qes_due
  ON quiz_email_sends (status, scheduled_for);
```

### 5.2 Endpoint extensions and additions

**`POST /api/quiz/lead`** — extended. New fields are accepted alongside existing ones. Existing callers (the old `start.sovereignty.app`) keep working — new fields default to `NULL`.

Request body (additive fields):
```json
{
  "email": "...", "name": "...",
  "answers": { "q1": "A", "q2": "driven", ... },
  "pattern_scores": { "A": 5, "B": 2, "C": 0, "D": 0 },
  "result_program": "over-preparer",
  "depth_score": 8, "depth_band": "established",
  "q2_style": "analytical",
  "q9_fear": "That a year from now, nothing will have changed",
  "utm": { "source": "fb", "medium": "paid", "campaign": "...", "content": "..." },
  "source_url": "...", "user_agent": "...", "fbp": "...", "fbc": "..."
}
```

Side effects, in order, in a single transaction where possible:
1. `INSERT INTO quiz_leads (..., gate_at = now())`.
2. `INSERT INTO quiz_email_sends (quiz_lead_id, email_num, status='queued', scheduled_for=gate_at+offset)` × 6, where offsets are `[1h, 24h, 48h, 72h, 96h, 144h]`.
3. Fire Meta CAPI `Lead` event (existing helper).
4. Push to GHL via existing `handleQuizLead`, extended to include:
   - Tag: `funnel:align`
   - Tag: `program:{result_program}`
   - Tag: `depth:{depth_band}`
   - Custom field: `q9_fear` → raw text
   - Custom field: `pattern_scores` → JSON

**`GET /api/quiz/lead/:token`** — NEW. Token-scoped read. Token is HMAC over `{lead_id, exp}` signed with `LEAD_TOKEN_HMAC_SECRET`. Returns only the fields needed to render the result page: `{ first_name, result_program, depth_band }`. Used by the funnel's `/start/result?token=` SSR.

**`GET /api/email/unsubscribe?token=...`** — NEW. Token is HMAC over `{email, lead_id, intent: "unsub"}`. Verifies, sets `unsubscribed = 1`, renders confirmation HTML. CAN-SPAM-compliant.

**`POST /api/email/resend-webhook`** — NEW. Receives Resend webhook events. Verifies signature via `svix` library + `RESEND_WEBHOOK_SECRET`. Maps events → `quiz_email_sends` updates:

| Resend event       | Action                                                          |
|--------------------|-----------------------------------------------------------------|
| `email.delivered`  | no-op for v1 (status is already `sent` after the API call returns); kept as a webhook subscription so we can add a `delivered_at` column later without re-subscribing |
| `email.opened`     | optional metric — skip for v1                                   |
| `email.clicked`    | optional metric — skip for v1                                   |
| `email.bounced`    | mark lead `unsubscribed = 1`, send row `status = 'failed'`      |
| `email.complained` | mark lead `unsubscribed = 1`, send row `status = 'failed'`      |

**`/api/stripe-webhook`** — EXISTING. One additive line inside the existing `checkout.session.completed` handler:
```js
db.prepare(`UPDATE quiz_leads SET purchased = 1 WHERE email = ?`).run(email);
// If bump in session: UPDATE quiz_leads SET bump_purchased = 1 ...
```
No other changes to this file.

### 5.3 Funnel drip scheduler

New service at `server/services/funnel-drip-scheduler.js`. Modeled exactly on the existing `knowledge-base-scheduler.js`. Initialized at boot via a small change in `server/index.js`:

```js
import { initFunnelDripScheduler } from './services/funnel-drip-scheduler.js';
// ...
try { initFunnelDripScheduler(); } catch (err) { console.error('...', err.message); }
```

Cron interval: every **15 minutes** (`*/15 * * * *`) in `America/Los_Angeles`.

Per-tick algorithm:

```
1. Select up to 50 due rows:
   SELECT s.id, s.email_num, q.id as lead_id, q.email, q.name,
          q.result_program, q.q9_fear
   FROM quiz_email_sends s
   JOIN quiz_leads q ON q.id = s.quiz_lead_id
   WHERE s.status = 'queued'
     AND s.scheduled_for <= datetime('now')
     AND q.unsubscribed = 0
   ORDER BY s.scheduled_for ASC
   LIMIT 50;

2. For each row:
   a. If quiz_leads.purchased = 1 AND email_num NOT IN (purchase_exit_allowlist):
      UPDATE quiz_email_sends SET status='skipped_purchased' WHERE id=row.id;
      continue;
   b. Resolve per-program merges via PROGRAM_MERGES dict.
   c. Render template[email_num] to HTML via React Email.
   d. POST to Resend API (resend.emails.send).
   e. On success: UPDATE quiz_email_sends SET status='sent',
                        resend_message_id=resp.id, sent_at=now() WHERE id=row.id.
   f. On failure: increment attempts; if attempts < 3, schedule retry +1 hour;
                  else status='failed'.
3. Wait for next tick.
```

Purchase exit allowlist = `[]` (empty for v1) — purchase exits the whole sequence. Adjustable later if a post-purchase email is wanted.

### 5.4 Email templates (in nlp-trainer)

New directory `server/emails/`:

```
server/emails/
├── _shared/
│   ├── EmailLayout.tsx           # dark-theme outer shell, footer, unsubscribe link
│   ├── tokens.ts                 # colors, fonts (match funnel)
│   └── render.ts                 # React Email → HTML utility
├── 01-result-recap.tsx
├── 02-mechanism.tsx
├── 03-proof.tsx
├── 04-fear.tsx
├── 05-objections.tsx
├── 06-last-call.tsx
└── data/
    ├── program-merges.ts         # per-program program_line + fear_line (frozen from build plan)
    └── subject-lines.ts          # 6 subject-line generators
```

Each template exports a default React component + a named `subject(props)` function. Copy is verbatim from build plan §6.

Per-program merge data (frozen):

```ts
export const PROGRAM_MERGES = {
  'over-preparer': {
    program: 'The Over-Preparer',
    program_line: 'the program that equates feeling safe with preparing more — so "ready" never arrives',
    fear_line:    'another year of preparing harder and still freezing when it counts',
  },
  'self-censor': {
    program: 'The Self-Censor',
    program_line: 'the program that intercepts your words in the half-second before you say them',
    fear_line:    "another year of replaying conversations you wish you'd spoken up in",
  },
  'invisible-ceiling': {
    program: 'The Invisible Ceiling',
    program_line: 'the program holding the quiet rule that someone like you operates at this level',
    fear_line:    'another year stalled at the same ceiling, watching the gap stay exactly where it is',
  },
  'loop': {
    program: 'The Loop',
    program_line: "the program faithfully re-running a template you didn't choose",
    fear_line:    'another year of the same pattern quietly repeating in new disguises',
  },
};
```

### 5.5 New env vars (Railway)

```
RESEND_API_KEY=re_...
RESEND_FROM_ADDRESS=Max <max@sovereignty.app>
RESEND_WEBHOOK_SECRET=whsec_...
UNSUBSCRIBE_HMAC_SECRET=<64 random bytes hex>
LEAD_TOKEN_HMAC_SECRET=<64 random bytes hex>
ALIGN_FUNNEL_URL=https://align.sovereignty.app
```

## 6. Funnel app design

### 6.1 Pages

| Path                  | Render | Purpose                                                              |
|-----------------------|--------|----------------------------------------------------------------------|
| `/`                   | SSR    | Minimal landing — branding + CTA → `/start`. Optional; could redirect. |
| `/start`              | Client | Quiz state machine; renders Q1 → Q9 → email gate.                    |
| `/start/result`       | SSR    | Reads `?token=`, fetches lead from nlp-trainer, renders the right variant. |
| `/checkout/success`   | SSR    | Soft "you're in" screen + JS redirect to `https://heart.sovereignty.app/sign-up?email=`. |
| `/checkout/cancel`    | SSR    | "Come back any time" + back-to-result link.                          |
| `/privacy`            | SSR    | Static.                                                              |
| `/terms`              | SSR    | Static.                                                              |

### 6.2 Quiz state machine

`QuizFlow.tsx` is a client component with a Zustand store:

```ts
type QuizState = {
  step: 'q1'|'q2'|'q3'|'q4'|'q5'|'q6'|'q7'|'q8'|'q9'|'gate'|'submitting';
  answers: Record<QuestionId, AnswerValue>;
  multiSelect: Record<'q3', string[]>;  // Q3 only
  startedAt: number;                     // for time-in-quiz KPI
  setAnswer(qid: QuestionId, value: AnswerValue): void;
  goNext(): void;
  goBack(): void;
};
```

Transition rules:
- **Tap an option** → `setAnswer` writes to store → `goNext()` → step+1 → next question's component is rendered behind the current one (via framer-motion `layoutId`-ish technique) before the exit animation begins. No fully-blank frame ever appears.
- **Q3** is the only multi-select question; "Done" button appears after ≥1 selection.
- **Back button** decrements step; previous answer is highlighted (zustand persists).
- After Q9 → step=`gate` → email form interstitial.
- Gate submit → step=`submitting` → POST `/api/quiz/submit` → on success router.push(`/start/result?token=<lead_token>`).

### 6.3 Questions as data

`lib/quiz/questions.ts` is the single source of truth for all 9 questions, options, sub-lines, reason-for-asking lines, and answer tags. Strongly typed:

```ts
type Question = {
  id: 'q1'|...|'q9';
  act: 1|2|3;
  prompt: string;
  subline?: string;
  reasonForAsking?: string;       // Act 3 only
  type: 'single' | 'multi';
  options: Array<{
    id: string;
    label: string;
    pattern?: 'A'|'B'|'C'|'D'|'none';
    depth?: 0|1|2|3;
    style?: 'driven'|'analytical'|'instinctive'|'strategic';
    isSkip?: boolean;
  }>;
};
```

Editing copy = edit one file. Tests iterate over this config to assert invariants (every option has a valid tag, each pattern is reachable in Q4, every Act-3 question has a skip, etc.).

### 6.4 Scoring engine (`lib/quiz/scoring.ts`)

Pure function — no DOM, no fetch, no Date.

```ts
export function scoreQuiz(answers: QuizAnswers): {
  pattern_scores: { A: number; B: number; C: number; D: number };
  result_program: 'over-preparer'|'self-censor'|'invisible-ceiling'|'loop';
  depth_score: number;     // 0..12
  depth_band: 'surface'|'established'|'deep-rooted';
}
```

**Pattern weights:** Q1=1, Q4=3, Q6=2, Q8=1. Sum weights for each of A/B/C/D. Highest wins. Tie-break = pattern chosen in Q4.

**Depth contributions:** Q3 multi-count → 0/1/2/3, Q5 depth value, Q7 depth value (skip = 1), Q9 depth value (skip = 1). Sum 0..12. Bands: 0–4 `surface`, 5–8 `established`, 9–12 `deep-rooted`.

Mapping (A/B/C/D → program slug):
```
A → 'over-preparer'
B → 'self-censor'
C → 'invisible-ceiling'
D → 'loop'
```

**Scoring is authoritative server-side.** The client may compute a preview, but the API route at `/api/quiz/submit` re-scores from raw answers; only the server's score is sent to nlp-trainer. Prevents tampering via devtools.

### 6.5 Result page (`/start/result`)

Server component. Flow:

1. Parse `?token=` from URL.
2. Server-fetch `GET ${BACKEND_URL}/api/quiz/lead/${token}` (the new token-scoped endpoint).
3. Read `{ first_name, result_program, depth_band }`.
4. Render `<ResultPage program={...} band={...} firstName={...} />` which composes:
   - **Comfort block** (shared, build-plan §5a).
   - **Bad-news block** — `<ProgramBadNews program={program} band={band} />` (4 program-specific variants × 3 intensity tones).
   - **Good-news block** (shared, build-plan §5c).
   - **Offer block** — $7 CTA with bump checkbox + guarantee text.

Tracking on mount (client component nested):
- Meta Pixel `ViewContent` with `content_name="result:{program}:{band}"`.
- POST `/api/quiz/event` with `event_name="ResultViewed"`.

### 6.6 Checkout flow

`/api/checkout` (POST) — request body: `{ lead_token, include_bump: bool }`.

Server-side:
1. Verify `lead_token` HMAC.
2. Fetch `email` from nlp-trainer via the same `/api/quiz/lead/:token` endpoint.
3. `stripe.checkout.sessions.create({ ... })` with:
   - `mode: 'payment'`
   - `line_items`: `[{ price: STRIPE_PRICE_7USD, quantity: 1 }]` plus `{ price: STRIPE_PRICE_27USD_BUMP }` if include_bump.
   - `success_url: 'https://align.sovereignty.app/checkout/success?cs={CHECKOUT_SESSION_ID}'`
   - `cancel_url: 'https://align.sovereignty.app/checkout/cancel'`
   - `customer_email: email`
   - `metadata: { lead_id, result_program, depth_band, funnel: 'align' }`
4. Fire Meta Pixel + CAPI `InitiateCheckout` event.
5. Return `{ url }` → client `window.location = url`.

On Stripe success, Stripe redirects back to `/checkout/success` with the session ID. Meanwhile, the existing `/api/stripe-webhook` on nlp-trainer fires asynchronously and:
- Marks `quiz_leads.purchased = 1`.
- Provisions `paid_users` (existing).
- Creates Clerk user (existing).
- Fires CAPI `Purchase` (existing).

`/checkout/success` shows a brief "you're in — taking you to the app…" screen, then JS-redirects to `https://heart.sovereignty.app/sign-up?email=<email>` (the email is in the Stripe session metadata, fetched server-side).

### 6.7 New env vars (Vercel funnel project)

```
NEXT_PUBLIC_BACKEND_URL=https://nlp-training-backend-production.up.railway.app
NEXT_PUBLIC_META_PIXEL_ID=2035820893688270
NEXT_PUBLIC_FUNNEL_URL=https://align.sovereignty.app
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRICE_7USD=price_...               # $7 one-time price ID
STRIPE_PRICE_27USD_BUMP=price_...         # $27 bump price ID
LEAD_TOKEN_HMAC_SECRET=<same as Railway>
```

`STRIPE_PRICE_*` IDs come from Stripe Dashboard (existing $7 product can be reused; $27 bump may need creating).

## 7. Tracking + analytics events

Centralized in `lib/api/tracking.ts`. Fires both client-side Meta Pixel and (for server-side dedup) POSTs to `/api/quiz/event` which forwards to nlp-trainer's existing CAPI helper.

| Event              | Trigger                                       | Pixel | CAPI |
|--------------------|-----------------------------------------------|-------|------|
| `PageView`         | Every route change                            | yes   | no   |
| `ViewContent`      | Each question render                          | yes   | yes  |
| `Lead`             | Email-gate submit success                     | yes   | yes  |
| `InitiateCheckout` | Offer CTA click → Checkout Session created    | yes   | yes  |
| `Purchase`         | Stripe webhook (server-side, existing)        | no    | yes  |

All hashed PII (email SHA-256, lowercased + trimmed) — handled by nlp-trainer's existing helper.

## 8. Testing strategy

### 8.1 Unit (vitest) — target ~50 tests, <2 s total

- `scoring.test.ts` — deterministic answer sets per program × per band; tie-break (Q4 wins); skip option scoring.
- `questions.test.ts` — invariants on the question config (all tags valid, every pattern reachable in Q4, every Act-3 has a skip, no duplicate option IDs).
- `routing.test.ts` — 12 program×band combinations route to the correct variant + intensity tone.
- `merges.test.ts` — per-program merge strings match build-plan §6 verbatim.

### 8.2 Integration — backend contracts

Spin up local nlp-trainer (`cd server && node index.js` on port 3001) + funnel (`npm run dev`). Tests POST against `http://localhost:3001/api/quiz/lead` etc.

- `api/quiz/lead.integration.test.ts` — synthetic lead → assert quiz_leads row has all 14 new columns populated, 6 quiz_email_sends rows queued with correct offsets, CAPI called once, GHL service called with correct tags.
- `api/email/unsubscribe.integration.test.ts` — token → GET → assert lead marked unsubscribed → next cron tick skips.
- `drip-scheduler.integration.test.ts` — seed leads (>7d ago) → run scheduler → assert 6 emails dispatched (mocked Resend). Seed purchased lead → assert no emails.

### 8.3 E2E (Playwright) — against Vercel preview + Railway

- `quiz-happy-path.spec.ts` — full tap-through; assert correct program/band; assert pixel events fired in order.
- `stripe-checkout.spec.ts` — complete checkout with Stripe test card; assert redirect chain.
- `quiz-back-button.spec.ts` — back/forward preserves answers.
- `quiz-skip-options.spec.ts` — Act-3 skips score as depth=1.
- `mobile-tap-targets.spec.ts` — viewport 390×844; assert all interactive elements ≥44 px².
- `no-blank-screen.spec.ts` — DOM sampling during transitions confirms no blank frame.
- `drip-first-email.spec.ts` — gate submit → trigger scheduler manually → assert Email 1 lands at Resend's test recipient.

## 9. Deploy plan

1. Build locally with green unit + integration tests.
2. Push to GitHub → Vercel auto-builds preview URL.
3. Run E2E suite against preview URL using Stripe test mode and Resend sandbox.
4. Add custom domain `align.sovereignty.app` in Vercel project settings.
5. User adds DNS — CNAME `align` → `cname.vercel-dns.com` (~10 min propagation).
6. Promote preview → production via Vercel UI.
7. Smoke test on real mobile device against `https://align.sovereignty.app/start`.
8. Hand off — repo URL, deploy URL, test evidence bundle.

## 10. Acceptance criteria — definition of "100% complete"

The build is delivered only when **every** row of this table is green:

| Checkpoint                                                                                              | Evidence                                  |
|---------------------------------------------------------------------------------------------------------|-------------------------------------------|
| All unit + integration + E2E tests pass                                                                 | CI/test runner output                     |
| Build-plan §8.5 UX checklist — all 9 items pass                                                          | Manual verification + screenshots         |
| 12 result variants (4 programs × 3 bands) render correctly                                              | Playwright screenshot grid                |
| Stripe Checkout completes in test mode → bounces to heart.sovereignty.app/sign-up                       | Recorded E2E run                          |
| Email 1 lands in a real test inbox within 1 h of gate submit                                            | Screenshot of inbox + Resend dashboard    |
| Lead row in Railway has all 14 new columns populated, `pattern_scores` JSON is well-formed              | DB query output                           |
| Meta Events Manager shows `Lead` at gate, `InitiateCheckout` at CTA, `Purchase` after Stripe webhook    | Screenshot                                |
| Resend webhook is delivering events back to backend (open/click reflected in `quiz_email_sends` or logs) | DB query showing webhook side effects     |
| `align.sovereignty.app/start` resolves over HTTPS with valid cert                                       | curl + browser                            |
| Lighthouse Mobile Performance ≥ 85 on `/start`                                                          | Lighthouse report                         |
| Unsubscribe link from a sent email actually unsubscribes the lead                                       | DB query before/after                     |

## 11. Manual handoffs — what the user owns

Five blocking steps stay on the human side:

1. **Resend account + DNS verification** (~15 min one-time).
2. **Add 6 env vars on Railway**: `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `RESEND_WEBHOOK_SECRET`, `UNSUBSCRIBE_HMAC_SECRET`, `LEAD_TOKEN_HMAC_SECRET`, `ALIGN_FUNNEL_URL`.
3. **Add 7 env vars on Vercel funnel project**: `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_FUNNEL_URL`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_7USD`, `STRIPE_PRICE_27USD_BUMP`, `LEAD_TOKEN_HMAC_SECRET`.
4. **Create $27 Stripe bump price** in Stripe Dashboard (one-time payment, attached to existing product or new) and provide the price ID.
5. **DNS CNAME** `align` → `cname.vercel-dns.com` at the DNS host.
6. **Promote to production** in Vercel UI after smoke-testing the preview.

I will not touch DNS / Stripe Dashboard / Resend account directly.

## 12. Out of scope

- Section 8.4 of build plan (3 defects on existing `start.sovereignty.app`).
- Quiz-length test (build-plan §7).
- Heart-app privacy-policy Llama mention.
- Pricing changes.
- Internationalization.
- Cookie banner / GDPR consent UI (not required for US-targeted traffic per current policy).

## 13. Open questions

None at spec write time. Will surface during the implementation plan if any arise.
