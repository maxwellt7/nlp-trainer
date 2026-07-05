# Insights Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Insights screen in the calm/editorial redesign language (three sections: Emotional capacity, Alignment rings, Patterns we've noticed), wired to the same `api.getProfile()` data.

**Architecture:** A pure, unit-tested logic module (`insightsLogic.ts`) maps raw profile fields to view-models; a presentational screen (`pages/rd/Insights.tsx`) renders them with `src/components/rd/` primitives + `--rd-*` tokens; the `/insights` route is repointed and the old screen deleted.

**Tech Stack:** React 19, Vite, TypeScript, Vitest. No new dependencies. Frontend-only — no backend/API changes.

## Global Constraints

- All new code lives under `src/pages/rd/` and `src/components/rd/` (existing primitives).
- Use only `--rd-*` tokens + `var(--font-display)` / `var(--font-sans)`; do NOT touch old `--color-brand-*` / gold tokens.
- No fabricated data or trends: derive everything from current profile values; show honest empty states, never mock numbers.
- Reuse existing primitives (`Screen`, `Card`, `SectionLabel`) — no new primitives.
- `npm run build` (`tsc -b && vite build`) and `npm run test:web` (`vitest run`) must stay green.
- Mobile-first centered column (handled by `Screen`, max-width 440).
- Data fields (verified): `capacity_index {suppression,discharge,capacity}` 0–10 default 5; `congruence {[domain]:number}` keys not fixed, may be `{}`; `meta_programs {direction:"toward"|"away"|null, frame:"internal"|"external"|null, chunk:"global"|"specific"|null, rep_system:"visual"|"auditory"|"kinesthetic"|null}`; `victim_healer {score:-5..5, trending?}`; `force_audit {subtle:0-10, clean:0-10}`. Client receives these already parsed as objects (the current screen consumes them so).

---

### Task 1: `insightsLogic` — capacity bars + alignment rings

**Files:**
- Create: `src/pages/rd/insightsLogic.ts`
- Test: `src/pages/rd/insightsLogic.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `type CapacityBar = { key: 'suppression'|'discharge'|'capacity'; label: string; value: number; pct: number; qualifier: string; desc: string; colorVar: string }`
  - `capacityBars(capacityIndex: any): CapacityBar[] | null` — `null` = empty state (missing, or all three values are the default 5).
  - `type AlignmentRing = { label: string; score: number; dash: string }`
  - `alignmentRings(congruence: any): AlignmentRing[]` — `[]` = empty state.

- [ ] **Step 1: Write the failing tests**

Create `src/pages/rd/insightsLogic.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { capacityBars, alignmentRings } from './insightsLogic';

describe('capacityBars', () => {
  it('returns null when capacity_index is missing', () => {
    expect(capacityBars(undefined)).toBeNull();
    expect(capacityBars({})).toBeNull();
  });

  it('treats all-default (every value 5) as empty', () => {
    expect(capacityBars({ suppression: 5, discharge: 5, capacity: 5 })).toBeNull();
  });

  it('maps the three keys to labels, pct and colors', () => {
    const bars = capacityBars({ suppression: 3, discharge: 6, capacity: 8 });
    expect(bars).not.toBeNull();
    expect(bars!.map(b => b.label)).toEqual(['Holding in', 'Releasing', 'Staying with it']);
    expect(bars!.map(b => b.pct)).toEqual([30, 60, 80]);
    expect(bars!.map(b => b.colorVar)).toEqual(['--rd-muted', '--rd-accent-bright', '--rd-sage']);
  });

  it('buckets the qualifier word by value', () => {
    const bars = capacityBars({ suppression: 2, discharge: 5.5, capacity: 9 })!;
    expect(bars.map(b => b.qualifier)).toEqual(['quiet', 'steady', 'strong']);
  });

  it('clamps pct into 0..100', () => {
    const bars = capacityBars({ suppression: -1, discharge: 12, capacity: 7 })!;
    expect(bars[0].pct).toBe(0);
    expect(bars[1].pct).toBe(100);
  });
});

describe('alignmentRings', () => {
  it('returns [] when congruence is empty or missing', () => {
    expect(alignmentRings(undefined)).toEqual([]);
    expect(alignmentRings({})).toEqual([]);
  });

  it('title-cases keys and builds the dash string', () => {
    const rings = alignmentRings({ work: 6.8, home_life: 7.9 });
    expect(rings[0]).toEqual({ label: 'Work', score: 6.8, dash: '68, 100' });
    expect(rings[1]).toEqual({ label: 'Home Life', score: 7.9, dash: '79, 100' });
  });

  it('caps at 4 rings', () => {
    const rings = alignmentRings({ a: 1, b: 2, c: 3, d: 4, e: 5 });
    expect(rings).toHaveLength(4);
  });

  it('ignores non-numeric values', () => {
    const rings = alignmentRings({ work: 5, bad: 'x' as any });
    expect(rings.map(r => r.label)).toEqual(['Work']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/nlp-trainer && npx vitest run src/pages/rd/insightsLogic.test.ts`
Expected: FAIL — `Failed to resolve import './insightsLogic'` / functions not defined.

- [ ] **Step 3: Write the implementation**

Create `src/pages/rd/insightsLogic.ts`:

```ts
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function qualifier(value: number): string {
  if (value < 4) return 'quiet';
  if (value < 7) return 'steady';
  return 'strong';
}

function titleCase(key: string): string {
  return key
    .split('_')
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export type CapacityBar = {
  key: 'suppression' | 'discharge' | 'capacity';
  label: string;
  value: number;
  pct: number;
  qualifier: string;
  desc: string;
  colorVar: string;
};

const CAPACITY_DEFS: Array<Omit<CapacityBar, 'value' | 'pct' | 'qualifier'>> = [
  { key: 'suppression', label: 'Holding in', desc: 'How much you hold back instead of feel.', colorVar: '--rd-muted' },
  { key: 'discharge', label: 'Releasing', desc: 'How freely emotion moves through you when it arrives.', colorVar: '--rd-accent-bright' },
  { key: 'capacity', label: 'Staying with it', desc: 'Your ability to sit with discomfort without escaping it.', colorVar: '--rd-sage' },
];

export function capacityBars(capacityIndex: any): CapacityBar[] | null {
  if (!capacityIndex || typeof capacityIndex !== 'object') return null;
  const vals = CAPACITY_DEFS.map(d => Number(capacityIndex[d.key]));
  if (vals.some(v => !Number.isFinite(v))) return null;
  // All-default (every value 5) reads as "no real data yet".
  if (vals.every(v => v === 5)) return null;
  return CAPACITY_DEFS.map((d, i) => {
    const value = vals[i];
    return { ...d, value, pct: clamp(value * 10, 0, 100), qualifier: qualifier(value) };
  });
}

export type AlignmentRing = { label: string; score: number; dash: string };

export function alignmentRings(congruence: any): AlignmentRing[] {
  if (!congruence || typeof congruence !== 'object') return [];
  const rings: AlignmentRing[] = [];
  for (const [key, raw] of Object.entries(congruence)) {
    const score = Number(raw);
    if (!Number.isFinite(score)) continue;
    const pct = Math.round(clamp(score, 0, 10) * 10);
    rings.push({ label: titleCase(key), score, dash: `${pct}, 100` });
    if (rings.length === 4) break;
  }
  return rings;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/nlp-trainer && npx vitest run src/pages/rd/insightsLogic.test.ts`
Expected: PASS (all cases in Task 1).

- [ ] **Step 5: Commit**

```bash
cd ~/nlp-trainer && git add src/pages/rd/insightsLogic.ts src/pages/rd/insightsLogic.test.ts
git commit -m "feat: insightsLogic capacityBars + alignmentRings"
```

---

### Task 2: `insightsLogic` — buildPatterns

**Files:**
- Modify: `src/pages/rd/insightsLogic.ts`
- Modify: `src/pages/rd/insightsLogic.test.ts`

**Interfaces:**
- Consumes: profile object with `meta_programs`, `victim_healer`, `force_audit`.
- Produces:
  - `type Pattern = { title: string; desc: string; colorVar: string }`
  - `buildPatterns(profile: any): Pattern[]` — `[]` = empty state. Order: direction, frame, chunk, rep_system, victim_healer, force. Dot color cycles `['--rd-accent-bright','--rd-muted','--rd-sage']` by final index.

- [ ] **Step 1: Write the failing tests**

Append to `src/pages/rd/insightsLogic.test.ts`:

```ts
import { buildPatterns } from './insightsLogic';

describe('buildPatterns', () => {
  it('returns [] when nothing is detected', () => {
    expect(buildPatterns({})).toEqual([]);
    expect(buildPatterns({ meta_programs: { direction: null, frame: null, chunk: null, rep_system: null } })).toEqual([]);
  });

  it('translates meta_programs to plain-language titles in order', () => {
    const p = buildPatterns({ meta_programs: { direction: 'toward', frame: 'external', chunk: 'global', rep_system: 'visual' } });
    expect(p.map(x => x.title)).toEqual([
      'You move toward, not away',
      "Other people's eyes matter a lot",
      'You think in the big picture first',
      'You think in pictures',
    ]);
  });

  it('cycles dot colors by index', () => {
    const p = buildPatterns({ meta_programs: { direction: 'toward', frame: 'external', chunk: 'global', rep_system: 'auditory' } });
    expect(p.map(x => x.colorVar)).toEqual(['--rd-accent-bright', '--rd-muted', '--rd-sage', '--rd-accent-bright']);
  });

  it('folds in victim_healer only when strongly one-sided', () => {
    expect(buildPatterns({ victim_healer: { score: 3 } }).map(x => x.title)).toEqual(["You're taking ownership of your part"]);
    expect(buildPatterns({ victim_healer: { score: -3 } }).map(x => x.title)).toEqual(['Some things still feel done to you']);
    expect(buildPatterns({ victim_healer: { score: 1 } })).toEqual([]);
  });

  it('folds in force_audit only on a clear margin', () => {
    expect(buildPatterns({ force_audit: { clean: 8, subtle: 3 } }).map(x => x.title)).toEqual(['You influence cleanly, without pushing']);
    expect(buildPatterns({ force_audit: { clean: 3, subtle: 8 } }).map(x => x.title)).toEqual(['You sometimes push harder than you need to']);
    expect(buildPatterns({ force_audit: { clean: 5, subtle: 5 } })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/nlp-trainer && npx vitest run src/pages/rd/insightsLogic.test.ts`
Expected: FAIL — `buildPatterns` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/pages/rd/insightsLogic.ts`:

```ts
export type Pattern = { title: string; desc: string; colorVar: string };

const PATTERN_COLORS = ['--rd-accent-bright', '--rd-muted', '--rd-sage'];

const META_COPY: Record<string, Record<string, { title: string; desc: string }>> = {
  direction: {
    toward: { title: 'You move toward, not away', desc: 'You frame goals as things you want, rather than things you fear. That gives your sessions forward pull.' },
    away: { title: "You move away from what you don't want", desc: "You're motivated by moving away from discomfort. Naming what you do want can add pull." },
  },
  frame: {
    external: { title: "Other people's eyes matter a lot", desc: "Much of your stress traces back to how you imagine being seen. We're gently loosening this." },
    internal: { title: 'You check decisions against your own compass', desc: 'You weigh choices by your own standards more than outside approval.' },
  },
  chunk: {
    global: { title: 'You think in the big picture first', desc: 'You reach for the overall shape before the details.' },
    specific: { title: 'You work from the details up', desc: 'You build understanding from specifics toward the whole.' },
  },
  rep_system: {
    visual: { title: 'You think in pictures', desc: 'You process experience most vividly through images.' },
    auditory: { title: 'You think in words and tone', desc: 'You process experience most vividly through sound and language.' },
    kinesthetic: { title: 'You think through feeling', desc: 'You process experience most vividly through bodily sensation.' },
  },
};

export function buildPatterns(profile: any): Pattern[] {
  const out: Array<{ title: string; desc: string }> = [];
  const mp = profile?.meta_programs || {};
  for (const key of ['direction', 'frame', 'chunk', 'rep_system']) {
    const val = mp[key];
    const copy = val && META_COPY[key]?.[val];
    if (copy) out.push(copy);
  }

  const vhScore = Number(profile?.victim_healer?.score);
  if (Number.isFinite(vhScore)) {
    if (vhScore >= 2) out.push({ title: "You're taking ownership of your part", desc: 'You increasingly meet situations as something you can shape, not just endure.' });
    else if (vhScore <= -2) out.push({ title: 'Some things still feel done to you', desc: "A few areas still feel outside your control. We'll keep widening where you have a say." });
  }

  const clean = Number(profile?.force_audit?.clean);
  const subtle = Number(profile?.force_audit?.subtle);
  if (Number.isFinite(clean) && Number.isFinite(subtle)) {
    if (clean - subtle >= 2) out.push({ title: 'You influence cleanly, without pushing', desc: 'You tend to create conditions where people want to follow, rather than forcing.' });
    else if (subtle - clean >= 2) out.push({ title: 'You sometimes push harder than you need to', desc: 'Overexplaining or managing reactions can creep in. Trusting the point to land is the practice.' });
  }

  return out.map((p, i) => ({ ...p, colorVar: PATTERN_COLORS[i % PATTERN_COLORS.length] }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/nlp-trainer && npx vitest run src/pages/rd/insightsLogic.test.ts`
Expected: PASS (all Task 1 + Task 2 cases).

- [ ] **Step 5: Commit**

```bash
cd ~/nlp-trainer && git add src/pages/rd/insightsLogic.ts src/pages/rd/insightsLogic.test.ts
git commit -m "feat: insightsLogic buildPatterns"
```

---

### Task 3: `Insights.tsx` redesigned screen

**Files:**
- Create: `src/pages/rd/Insights.tsx`

**Interfaces:**
- Consumes: `capacityBars`, `alignmentRings`, `buildPatterns` from `./insightsLogic`; `api.getProfile()` from `../../services/api`; `Screen`, `Card`, `SectionLabel` from `../../components/rd/*`.
- Produces: `default` React component mounted at `/insights` in Task 4.

- [ ] **Step 1: Write the component**

Create `src/pages/rd/Insights.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import Screen from '../../components/rd/Screen';
import Card from '../../components/rd/Card';
import SectionLabel from '../../components/rd/SectionLabel';
import { capacityBars, alignmentRings, buildPatterns } from './insightsLogic';

const ARC = 'M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831';

export default function Insights() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getProfile()
      .then((d: any) => setProfile(d?.profile || null))
      .catch((err: any) => setError(err?.message || 'Could not load your insights.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Screen>
        <div style={{ color: 'var(--rd-muted)', fontSize: 14, marginTop: 40 }}>Gathering what we've noticed…</div>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 400, margin: '0 0 8px' }}>How you're doing</h1>
        <div style={{ color: 'var(--rd-muted)', fontSize: 14, marginBottom: 18 }}>We couldn't reach your insights just now.</div>
        <button onClick={() => window.location.reload()} style={{
          background: 'var(--rd-accent)', color: '#06121c', border: 'none', borderRadius: 999,
          padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>Try again</button>
      </Screen>
    );
  }

  const bars = capacityBars(profile?.capacity_index);
  const rings = alignmentRings(profile?.congruence);
  const patterns = buildPatterns(profile);

  return (
    <Screen>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 400, margin: '0 0 6px' }}>How you're doing</h1>
      <div style={{ fontSize: 14, color: 'var(--rd-muted)', lineHeight: 1.55, marginBottom: 26 }}>
        A gentle read on what your recent conversations reveal.
      </div>

      {/* Section 1 — Emotional capacity */}
      <Card>
        <SectionLabel>Emotional Capacity</SectionLabel>
        {!bars && (
          <div style={{ fontSize: 14, color: 'var(--rd-muted)', lineHeight: 1.55 }}>
            Your emotional patterns will come into focus after a few more conversations.
          </div>
        )}
        {bars && bars.map((b, i) => (
          <div key={b.key} style={{ marginTop: i === 0 ? 0 : 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 14, color: 'var(--rd-ink-soft)' }}>{b.label}</span>
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--rd-muted-2)' }}>{b.qualifier}</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'var(--rd-border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${b.pct}%`, borderRadius: 999, background: `var(${b.colorVar})` }} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--rd-muted-2)', marginTop: 6, lineHeight: 1.5 }}>{b.desc}</div>
          </div>
        ))}
      </Card>

      {/* Section 2 — Alignment */}
      <div style={{ marginTop: 20 }}>
        <Card>
          <SectionLabel>Alignment</SectionLabel>
          {rings.length === 0 && (
            <div style={{ fontSize: 14, color: 'var(--rd-muted)', lineHeight: 1.55 }}>
              As different areas of your life come up, you'll see how aligned they feel here.
            </div>
          )}
          {rings.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 12 }}>
              {rings.map(r => (
                <div key={r.label} style={{ textAlign: 'center' }}>
                  <div style={{ position: 'relative', width: 60, height: 60, margin: '0 auto 8px' }}>
                    <svg viewBox="0 0 36 36" style={{ width: 60, height: 60, transform: 'rotate(0deg)' }}>
                      <path d={ARC} fill="none" stroke="var(--rd-border)" strokeWidth={3} />
                      <path d={ARC} fill="none" stroke="var(--rd-accent-bright)" strokeWidth={3} strokeLinecap="round" strokeDasharray={r.dash} />
                    </svg>
                    <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--rd-ink)' }}>
                      {Math.round(r.score)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--rd-muted)' }}>{r.label}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Section 3 — Patterns we've noticed */}
      <div style={{ marginTop: 28 }}>
        <SectionLabel>Patterns We've Noticed</SectionLabel>
        {patterns.length === 0 && (
          <div style={{ fontSize: 14, color: 'var(--rd-muted)', lineHeight: 1.55 }}>
            As we talk more, the patterns in how you think will show up here.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {patterns.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: `var(${p.colorVar})`, marginTop: 6, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 15, color: 'var(--rd-ink-soft)', marginBottom: 3 }}>{p.title}</div>
                <div style={{ fontSize: 13, color: 'var(--rd-muted-2)', lineHeight: 1.55 }}>{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}
```

- [ ] **Step 2: Type-check + build**

Run: `cd ~/nlp-trainer && npm run build`
Expected: PASS — `tsc -b` clean, `vite build` completes. (Component not yet routed; this proves it compiles.)

- [ ] **Step 3: Commit**

```bash
cd ~/nlp-trainer && git add src/pages/rd/Insights.tsx
git commit -m "feat: redesigned Insights screen (rd)"
```

---

### Task 4: Route swap, delete old screen, verify

**Files:**
- Modify: `src/App.tsx:22`
- Delete: `src/pages/Insights.tsx`

**Interfaces:**
- Consumes: `src/pages/rd/Insights.tsx` (Task 3).
- Produces: `/insights` renders the redesigned screen; old screen gone.

- [ ] **Step 1: Repoint the lazy import**

In `src/App.tsx`, change line 22 from:

```tsx
const Insights = lazy(() => import('./pages/Insights'));
```

to:

```tsx
const Insights = lazy(() => import('./pages/rd/Insights'));
```

(Both `<Route path="/insights" element={<Insights />} />` blocks — lines ~57 and ~92 — reference this one binding, so no other edits.)

- [ ] **Step 2: Delete the old screen**

```bash
cd ~/nlp-trainer && git rm src/pages/Insights.tsx
```

- [ ] **Step 3: Full build + web tests**

Run: `cd ~/nlp-trainer && npm run build && npm run test:web`
Expected: both PASS. Build has no dangling reference to the deleted file; all Vitest suites (including `insightsLogic.test.ts` and existing `homeLogic.test.ts`) green.

- [ ] **Step 4: Commit**

```bash
cd ~/nlp-trainer && git add src/App.tsx
git commit -m "feat: route /insights to redesigned screen, remove old Insights"
```

---

## Post-plan verification (human-in-the-loop, after all tasks)

Not a task step — the operator runs these before deploy:
- Whole-branch review (requesting-code-review) → fix findings.
- Deploy: merge to `main`, then **force** `vercel --prod --yes` (git auto-deploy is flaky — see [[project-nlp-voice-feature]]). Verify the live `/assets/*.js` bundle contains `How you're doing` and that `heart.sovereignty.app` aliases the new deployment.
- On-device (iPad PWA): header renders, three sections populate from real data, each empty state, error/Retry, Insights nav highlight.

## Self-Review notes

- **Spec coverage:** §4 Section 1 → Task 3 capacity card + Task 1 `capacityBars`; §4 Section 2 → Task 3 rings + Task 1 `alignmentRings`; §4 Section 3 → Task 3 patterns + Task 2 `buildPatterns`; §5 logic module → Tasks 1–2 with tests; §6 routing/cleanup → Task 4; §7 states → Task 3 loading/error + section empty states; §8 testing/deploy → Task 4 + post-plan block. All covered.
- **Trends:** no per-field history used anywhere; qualifier words derived from current value only (Task 1). All-default capacity → empty (Task 1 test + impl).
- **Type consistency:** `CapacityBar`/`AlignmentRing`/`Pattern` defined in Tasks 1–2 and consumed unchanged in Task 3; `colorVar` used as `var(${colorVar})` throughout.
- **Dropped blocks** (Four Stages, Context Maps, Victim–Healer bar, Force bars) intentionally absent — their data feeds patterns or is retired per approved spec.
