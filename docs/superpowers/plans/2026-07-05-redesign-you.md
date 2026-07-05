# You Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Identity/values screen as the calm "You" screen (*"What you value"*: overall-congruence ring, value bars, one tension, a beliefs card), and remove the now-dead Alignment section from Insights.

**Architecture:** A pure, unit-tested logic module (`youLogic.ts`) maps `api.getIdentity()` data to view-models; a presentational screen (`pages/rd/You.tsx`) renders them with `src/components/rd/` primitives + `--rd-*` tokens; the `/you` + `/identity` routes are repointed and the old Identity screen deleted; Insights' Alignment card and the unused `alignmentRings` helper are removed.

**Tech Stack:** React 19, Vite, TypeScript, Vitest. No new dependencies. Frontend-only — no backend/API changes.

## Global Constraints

- All new code under `src/pages/rd/`, reusing existing `src/components/rd/` primitives. No new deps.
- Use only `--rd-*` tokens + `var(--font-display)`/`var(--font-sans)`; do NOT touch old `--color-brand-*`/gold tokens or Tailwind color classes.
- No fabricated data: derive everything from current identity values; honest empty states; hide optional sections when empty (never blank cards).
- Value badge: `confidence < 0.5` → **emerging** (`--rd-muted`); else `expression === 'pure'` → **living it** (`--rd-sage`); else (`mixed`/`distorted`) → **mixed** (`--rd-accent-bright`). Badge is text-only in the badge color (no pill background), matching the shipped Insights qualifier treatment.
- Value bar fill = `purity_score × 10`, clamped 0–100.
- Overall congruence ring = `scores.overall_congruence` (×10 → %); treat `null` scores or `overall_congruence ≤ 0` as no-data (empty state).
- Tension shows only `conflicts[0]`; hidden when no conflicts. Beliefs hidden when no statements.
- `npm run build` (`tsc -b && vite build`) and `npm run test:web` (`vitest run`) must stay green.
- Data (verified): `api.getIdentity()` → `{ values, conflicts, statements, scores }`. `values[]`: `{value_name, confidence 0–1, purity_score 0–10, expression 'pure'|'distorted'|'mixed', pure_expression, distorted_expression, evidence_count}` (sorted confidence DESC). `conflicts[]`: `{value_a, value_b, conflict_type, description}`. `statements[]`: `{statement_type: 'core_identity'|'limiting_belief'|'empowering_belief'|'worthiness_pattern'|'root_belief', content, confidence}`. `scores`: `{…, overall_congruence}` 0–10, may be null.

---

### Task 1: `youLogic` — overallCongruence + valueBars

**Files:**
- Create: `src/pages/rd/youLogic.ts`
- Test: `src/pages/rd/youLogic.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `overallCongruence(scores: any): number | null` — `null` when `scores` falsy, non-finite, or `overall_congruence ≤ 0`.
  - `type ValueBar = { name: string; badge: 'living it'|'mixed'|'emerging'; badgeColorVar: string; fillPct: number; desc: string }`
  - `valueBars(values: any): ValueBar[]` — `[]` for missing/empty input.

- [ ] **Step 1: Write the failing tests**

Create `src/pages/rd/youLogic.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { overallCongruence, valueBars } from './youLogic';

describe('overallCongruence', () => {
  it('returns null for missing scores or non-positive congruence', () => {
    expect(overallCongruence(null)).toBeNull();
    expect(overallCongruence(undefined)).toBeNull();
    expect(overallCongruence({ overall_congruence: 0 })).toBeNull();
    expect(overallCongruence({ overall_congruence: -1 })).toBeNull();
  });
  it('returns the numeric congruence when positive', () => {
    expect(overallCongruence({ overall_congruence: 7.2 })).toBe(7.2);
  });
});

describe('valueBars', () => {
  it('returns [] for empty or missing input', () => {
    expect(valueBars([])).toEqual([]);
    expect(valueBars(undefined)).toEqual([]);
  });
  it('marks low-confidence values as emerging regardless of expression', () => {
    const [bar] = valueBars([{ value_name: 'belonging', confidence: 0.3, purity_score: 4.4, expression: 'pure' }]);
    expect(bar.badge).toBe('emerging');
    expect(bar.badgeColorVar).toBe('--rd-muted');
    expect(bar.desc).toBe('Newly surfaced in recent conversations.');
    expect(bar.name).toBe('Belonging');
    expect(bar.fillPct).toBe(44);
  });
  it('marks confident pure values as living it with pure_expression desc', () => {
    const [bar] = valueBars([{ value_name: 'honesty', confidence: 0.9, purity_score: 8.4, expression: 'pure', pure_expression: 'Shows up cleanly in most of what you share.' }]);
    expect(bar.badge).toBe('living it');
    expect(bar.badgeColorVar).toBe('--rd-sage');
    expect(bar.fillPct).toBe(84);
    expect(bar.desc).toBe('Shows up cleanly in most of what you share.');
  });
  it('marks confident mixed/distorted values as mixed with distorted_expression desc', () => {
    const [bar] = valueBars([{ value_name: 'freedom', confidence: 0.8, purity_score: 6.2, expression: 'distorted', distorted_expression: 'Sometimes independence, sometimes avoidance.' }]);
    expect(bar.badge).toBe('mixed');
    expect(bar.badgeColorVar).toBe('--rd-accent-bright');
    expect(bar.desc).toBe('Sometimes independence, sometimes avoidance.');
  });
  it('clamps fill and falls back when desc fields are missing', () => {
    const [bar] = valueBars([{ value_name: 'growth', confidence: 0.7, purity_score: 12, expression: 'pure' }]);
    expect(bar.fillPct).toBe(100);
    expect(bar.desc).toBe('Shows up cleanly in what you share.');
  });
  it('treats confidence exactly 0.5 as not emerging', () => {
    const [bar] = valueBars([{ value_name: 'growth', confidence: 0.5, purity_score: 7, expression: 'pure' }]);
    expect(bar.badge).toBe('living it');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/nlp-trainer && npx vitest run src/pages/rd/youLogic.test.ts`
Expected: FAIL — `Failed to resolve import './youLogic'`.

- [ ] **Step 3: Write the implementation**

Create `src/pages/rd/youLogic.ts`:

```ts
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function titleCase(s: string): string {
  if (!s) return '';
  return s
    .split(/[\s_]+/)
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function overallCongruence(scores: any): number | null {
  if (!scores || typeof scores !== 'object') return null;
  const v = Number(scores.overall_congruence);
  if (!Number.isFinite(v) || v <= 0) return null;
  return v;
}

export type ValueBar = {
  name: string;
  badge: 'living it' | 'mixed' | 'emerging';
  badgeColorVar: string;
  fillPct: number;
  desc: string;
};

export function valueBars(values: any): ValueBar[] {
  if (!Array.isArray(values)) return [];
  return values.map((v: any) => {
    const confidence = Number(v?.confidence) || 0;
    const purity = Number(v?.purity_score) || 0;
    const pure = (v?.pure_expression || '').trim();
    const distorted = (v?.distorted_expression || '').trim();

    let badge: ValueBar['badge'];
    let badgeColorVar: string;
    let desc: string;
    if (confidence < 0.5) {
      badge = 'emerging';
      badgeColorVar = '--rd-muted';
      desc = 'Newly surfaced in recent conversations.';
    } else if (v?.expression === 'pure') {
      badge = 'living it';
      badgeColorVar = '--rd-sage';
      desc = pure || 'Shows up cleanly in what you share.';
    } else {
      badge = 'mixed';
      badgeColorVar = '--rd-accent-bright';
      desc = distorted || pure || 'Sometimes clean, sometimes a cover — worth watching.';
    }

    return { name: titleCase(v?.value_name || ''), badge, badgeColorVar, fillPct: clamp(purity * 10, 0, 100), desc };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/nlp-trainer && npx vitest run src/pages/rd/youLogic.test.ts`
Expected: PASS (all Task 1 cases).

- [ ] **Step 5: Commit**

```bash
cd ~/nlp-trainer && git add src/pages/rd/youLogic.ts src/pages/rd/youLogic.test.ts
git commit -m "feat: youLogic overallCongruence + valueBars"
```

---

### Task 2: `youLogic` — topTension + beliefs

**Files:**
- Modify: `src/pages/rd/youLogic.ts`
- Modify: `src/pages/rd/youLogic.test.ts`

**Interfaces:**
- Consumes: `titleCase` (already defined in `youLogic.ts` from Task 1).
- Produces:
  - `type Tension = { a: string; b: string; desc: string }`
  - `topTension(conflicts: any): Tension | null` — `null` when empty/missing or the first conflict lacks both value names.
  - `type Belief = { content: string; colorVar: string }`
  - `beliefs(statements: any): Belief[]` — `[]` for missing/empty; skips items with empty content. `empowering_belief`/`core_identity` → `--rd-sage`; all other types → `--rd-danger`.

- [ ] **Step 1: Write the failing tests**

Append to `src/pages/rd/youLogic.test.ts`:

```ts
import { topTension, beliefs } from './youLogic';

describe('topTension', () => {
  it('returns null when there are no conflicts', () => {
    expect(topTension([])).toBeNull();
    expect(topTension(undefined)).toBeNull();
  });
  it('returns only the first conflict, title-cased', () => {
    const t = topTension([
      { value_a: 'freedom', value_b: 'belonging', description: 'You want both.' },
      { value_a: 'x', value_b: 'y', description: 'ignored' },
    ]);
    expect(t).toEqual({ a: 'Freedom', b: 'Belonging', desc: 'You want both.' });
  });
});

describe('beliefs', () => {
  it('returns [] for empty or missing input', () => {
    expect(beliefs([])).toEqual([]);
    expect(beliefs(undefined)).toEqual([]);
  });
  it('colors empowering/core sage and limiting/worthiness/root danger', () => {
    const b = beliefs([
      { statement_type: 'empowering_belief', content: 'I can handle hard things.' },
      { statement_type: 'core_identity', content: 'I am a builder.' },
      { statement_type: 'limiting_belief', content: 'I am behind.' },
      { statement_type: 'worthiness_pattern', content: 'I must earn rest.' },
      { statement_type: 'root_belief', content: 'Love is conditional.' },
    ]);
    expect(b.map(x => x.colorVar)).toEqual(['--rd-sage', '--rd-sage', '--rd-danger', '--rd-danger', '--rd-danger']);
    expect(b[0].content).toBe('I can handle hard things.');
  });
  it('skips items with empty content', () => {
    expect(beliefs([{ statement_type: 'core_identity', content: '' }])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/nlp-trainer && npx vitest run src/pages/rd/youLogic.test.ts`
Expected: FAIL — `topTension`/`beliefs` not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/pages/rd/youLogic.ts`:

```ts
export type Tension = { a: string; b: string; desc: string };

export function topTension(conflicts: any): Tension | null {
  if (!Array.isArray(conflicts) || conflicts.length === 0) return null;
  const c = conflicts[0];
  if (!c || (!c.value_a && !c.value_b)) return null;
  return { a: titleCase(c.value_a || ''), b: titleCase(c.value_b || ''), desc: c.description || '' };
}

export type Belief = { content: string; colorVar: string };

const SAGE_TYPES = new Set(['empowering_belief', 'core_identity']);

export function beliefs(statements: any): Belief[] {
  if (!Array.isArray(statements)) return [];
  return statements
    .filter((s: any) => s && (s.content || '').trim())
    .map((s: any) => ({
      content: s.content,
      colorVar: SAGE_TYPES.has(s.statement_type) ? '--rd-sage' : '--rd-danger',
    }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/nlp-trainer && npx vitest run src/pages/rd/youLogic.test.ts`
Expected: PASS (all Task 1 + Task 2 cases).

- [ ] **Step 5: Commit**

```bash
cd ~/nlp-trainer && git add src/pages/rd/youLogic.ts src/pages/rd/youLogic.test.ts
git commit -m "feat: youLogic topTension + beliefs"
```

---

### Task 3: `You.tsx` redesigned screen

**Files:**
- Create: `src/pages/rd/You.tsx`

**Interfaces:**
- Consumes: `overallCongruence`, `valueBars`, `topTension`, `beliefs` from `./youLogic`; `api.getIdentity()` from `../../services/api`; `Screen`, `Card`, `SectionLabel` from `../../components/rd/*`.
- Produces: `default` React component mounted at `/you` in Task 5.

- [ ] **Step 1: Write the component**

Create `src/pages/rd/You.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import Screen from '../../components/rd/Screen';
import Card from '../../components/rd/Card';
import SectionLabel from '../../components/rd/SectionLabel';
import { overallCongruence, valueBars, topTension, beliefs } from './youLogic';

export default function You() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getIdentity()
      .then((d: any) => setData(d || null))
      .catch((err: any) => setError(err?.message || 'Could not load your profile.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Screen>
        <div style={{ color: 'var(--rd-muted)', fontSize: 14, marginTop: 40 }}>Gathering what you've shared…</div>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 400, margin: '0 0 8px' }}>What you value</h1>
        <div style={{ color: 'var(--rd-muted)', fontSize: 14, marginBottom: 18 }}>We couldn't reach your profile just now.</div>
        <button onClick={() => window.location.reload()} style={{
          background: 'var(--rd-accent)', color: '#06121c', border: 'none', borderRadius: 999,
          padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>Try again</button>
      </Screen>
    );
  }

  const congruence = overallCongruence(data?.scores);
  const bars = valueBars(data?.values);
  const tension = topTension(data?.conflicts);
  const beliefList = beliefs(data?.statements);
  const congruencePct = congruence != null ? Math.round(Math.min(10, Math.max(0, congruence)) * 10) : 0;

  return (
    <Screen>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 400, margin: '0 0 6px' }}>What you value</h1>
      <div style={{ fontSize: 14, color: 'var(--rd-muted)', lineHeight: 1.55, marginBottom: 26 }}>
        Built slowly, from what you've shared — not from a quiz.
      </div>

      {/* Section 1 — Overall congruence */}
      <Card>
        {congruence == null ? (
          <div style={{ fontSize: 14, color: 'var(--rd-muted)', lineHeight: 1.55, textAlign: 'center', padding: '8px 0' }}>
            Your sense of alignment will take shape as you keep talking.
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <SectionLabel>Overall Congruence</SectionLabel>
            <div style={{ position: 'relative', width: 108, height: 108, margin: '6px auto 0' }}>
              <svg viewBox="0 0 36 36" style={{ width: 108, height: 108, transform: 'rotate(-90deg)' }}>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--rd-border)" strokeWidth={2.2} />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--rd-sage)" strokeWidth={2.2} strokeLinecap="round" strokeDasharray={`${congruencePct}, 100`} />
              </svg>
              <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--rd-ink)' }}>
                {congruence.toFixed(1)}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Section 2 — What you value */}
      <div style={{ marginTop: 20 }}>
        <Card>
          <SectionLabel>What You Value</SectionLabel>
          {bars.length === 0 && (
            <div style={{ fontSize: 14, color: 'var(--rd-muted)', lineHeight: 1.55 }}>
              Your values will appear here as they surface in conversation.
            </div>
          )}
          {bars.map((b, i) => (
            <div key={b.name || i} style={{ marginTop: i === 0 ? 0 : 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 15, color: 'var(--rd-ink-soft)' }}>{b.name}</span>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: `var(${b.badgeColorVar})` }}>{b.badge}</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'var(--rd-border)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${b.fillPct}%`, borderRadius: 999, background: `var(${b.badgeColorVar})` }} />
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--rd-muted-2)', marginTop: 6, lineHeight: 1.5 }}>{b.desc}</div>
            </div>
          ))}
        </Card>
      </div>

      {/* Section 3 — A tension worth noticing */}
      {tension && (
        <div style={{ marginTop: 20 }}>
          <Card>
            <SectionLabel>A Tension Worth Noticing</SectionLabel>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 8 }}>
              {tension.a} <span style={{ color: 'var(--rd-muted)' }}>↔</span> {tension.b}
            </div>
            {tension.desc && <div style={{ fontSize: 13.5, color: 'var(--rd-muted-2)', lineHeight: 1.55 }}>{tension.desc}</div>}
          </Card>
        </div>
      )}

      {/* Section 4 — Beliefs */}
      {beliefList.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <SectionLabel>Beliefs Surfacing</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {beliefList.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: `var(${b.colorVar})`, marginTop: 6, flexShrink: 0 }} />
                <div style={{ fontSize: 14, color: 'var(--rd-ink-soft)', fontStyle: 'italic', lineHeight: 1.5 }}>"{b.content}"</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Screen>
  );
}
```

- [ ] **Step 2: Type-check + build**

Run: `cd ~/nlp-trainer && npm run build`
Expected: PASS — `tsc -b` clean, `vite build` completes. (Not yet routed; this proves it compiles.)

- [ ] **Step 3: Commit**

```bash
cd ~/nlp-trainer && git add src/pages/rd/You.tsx
git commit -m "feat: redesigned You screen (rd)"
```

---

### Task 4: Remove the Alignment section from Insights

**Files:**
- Modify: `src/pages/rd/Insights.tsx`
- Modify: `src/pages/rd/insightsLogic.ts`
- Modify: `src/pages/rd/insightsLogic.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: Insights renders two sections (Emotional Capacity + Patterns). `alignmentRings`/`AlignmentRing` no longer exist.

- [ ] **Step 1: Trim `insightsLogic.ts`**

In `src/pages/rd/insightsLogic.ts`, delete the `AlignmentRing` type and the entire `alignmentRings` function (the block starting `export type AlignmentRing = …` through the end of `export function alignmentRings(congruence: any): AlignmentRing[] { … }`). Leave `capacityBars`, `buildPatterns`, and the shared `clamp`/`titleCase`/`qualifier` helpers intact.

Note: `titleCase` is used only by `alignmentRings`. After removing `alignmentRings`, if `titleCase` becomes unused, delete `titleCase` too (otherwise `tsc`/lint may flag an unused function). Verify by grepping: `grep -n "titleCase" src/pages/rd/insightsLogic.ts` — if the only remaining reference is its own definition, remove it.

- [ ] **Step 2: Trim `insightsLogic.test.ts`**

In `src/pages/rd/insightsLogic.test.ts`, delete the entire `describe('alignmentRings', () => { … })` block, and remove `alignmentRings` from the import (`import { capacityBars, alignmentRings } from './insightsLogic';` → `import { capacityBars } from './insightsLogic';`; leave the separate `buildPatterns` import line as-is).

- [ ] **Step 3: Trim `Insights.tsx`**

In `src/pages/rd/Insights.tsx`:
1. Change the import `import { capacityBars, alignmentRings, buildPatterns } from './insightsLogic';` → `import { capacityBars, buildPatterns } from './insightsLogic';`
2. Delete the `const ARC = '…';` line near the top (it was used only by the rings).
3. Delete the line `const rings = alignmentRings(profile?.congruence);`
4. Delete the entire `{/* Section 2 — Alignment */}` block — the `<div style={{ marginTop: 20 }}><Card> … Alignment … </Card></div>` wrapper and everything inside it, up to but not including `{/* Section 3 — Patterns we've noticed */}`.

- [ ] **Step 4: Verify no dangling references**

Run: `cd ~/nlp-trainer && grep -rn "alignmentRings\|AlignmentRing\|const ARC" src/`
Expected: NO output (all references removed).

- [ ] **Step 5: Build + web tests**

Run: `cd ~/nlp-trainer && npm run build && npm run test:web`
Expected: both PASS. `tsc -b` clean (no unused-symbol errors), Vitest green (the `alignmentRings` describe block is gone; remaining `insightsLogic` + `homeLogic` + `youLogic` suites pass).

- [ ] **Step 6: Commit**

```bash
cd ~/nlp-trainer && git add src/pages/rd/Insights.tsx src/pages/rd/insightsLogic.ts src/pages/rd/insightsLogic.test.ts
git commit -m "refactor: remove permanently-empty Alignment section from Insights"
```

---

### Task 5: Route swap, delete old Identity screen, verify

**Files:**
- Modify: `src/App.tsx:23`
- Delete: `src/pages/Identity.tsx`

**Interfaces:**
- Consumes: `src/pages/rd/You.tsx` (Task 3).
- Produces: `/you` and `/identity` (both route trees) render the redesigned screen; old Identity screen gone.

- [ ] **Step 1: Repoint the lazy import**

In `src/App.tsx`, change line 23 from:

```tsx
const Identity = lazy(() => import('./pages/Identity'));
```

to:

```tsx
const Identity = lazy(() => import('./pages/rd/You'));
```

(All four routes — `/you` and `/identity` in both the authenticated and unauthenticated trees, lines ~58/61/93/96 — reference this one binding, so no other edits. The binding name `Identity` stays; only its target changes.)

- [ ] **Step 2: Delete the old screen**

```bash
cd ~/nlp-trainer && git rm src/pages/Identity.tsx
```

- [ ] **Step 3: Verify no dangling references**

Run: `cd ~/nlp-trainer && grep -rn "pages/Identity" src/`
Expected: NO output.

- [ ] **Step 4: Full build + web tests**

Run: `cd ~/nlp-trainer && npm run build && npm run test:web`
Expected: both PASS — no dangling import to the deleted file; all Vitest suites (`youLogic`, `insightsLogic`, `homeLogic`) green.

- [ ] **Step 5: Commit**

```bash
cd ~/nlp-trainer && git add src/App.tsx
git commit -m "feat: route /you + /identity to redesigned screen, remove old Identity"
```

---

## Post-plan verification (human-in-the-loop, after all tasks)

Not a task step — the operator runs these before deploy:
- Whole-branch review (requesting-code-review) → fix findings.
- Deploy: merge to `main`, then **force** `vercel --prod --yes` (git auto-deploy is flaky — see [[project-nlp-voice-feature]]). Verify the live `/assets/*.js` bundle contains `What you value` and that `heart.sovereignty.app` aliases the new deployment; confirm Insights no longer renders an Alignment section.
- On-device (iPad PWA): You header + four sections from real data, each empty/hidden state, error/Retry, You nav highlight; Insights shows two sections.

## Self-Review notes

- **Spec coverage:** spec §4 Section 1 → Task 3 ring + Task 1 `overallCongruence`; §4 Section 2 → Task 3 bars + Task 1 `valueBars`; §4 Section 3 → Task 3 tension + Task 2 `topTension`; §4 Section 4 → Task 3 beliefs + Task 2 `beliefs`; §5 logic module → Tasks 1–2 with tests; §6 routing/cleanup → Task 5; §7 Insights Alignment removal → Task 4; §8 states → Task 3 loading/error + section empty/hidden states; §9 testing/deploy → Tasks 4–5 + post-plan block. All covered.
- **No fabricated data:** overall_congruence ≤ 0 → null (Task 1); optional sections hidden when empty (Task 3); badges/desc derive from real fields with plain fallbacks.
- **Type consistency:** `ValueBar`/`Tension`/`Belief` defined in Tasks 1–2 and consumed unchanged in Task 3; `badgeColorVar`/`colorVar` used as `var(${…})` throughout; `overallCongruence`/`valueBars`/`topTension`/`beliefs` signatures match between definition and use.
- **Badge is text-only** (no pill bg) per Global Constraints — avoids `color-mix`, matches shipped Insights qualifier treatment.
