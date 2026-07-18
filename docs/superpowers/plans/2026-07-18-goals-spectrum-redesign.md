# Goals "Life Spectrum" Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the info-free life bar with an interactive full-life spectrum (birth → 90, every goal a colored marker), and make the decade rail span all 90 years with cheap collapsed empty decades.

**Architecture:** Presentation-layer only — no backend or data-model changes. Pure data shaping goes in `goalsLogic.ts` (Vitest-covered), a new `LifeSpectrum.tsx` renders the spectrum, and `Goals.tsx` is refactored for chapters/chips/sticky/scroll behavior. Spec: `docs/superpowers/specs/2026-07-17-goals-redesign-design.md`.

**Tech Stack:** React 18 + TS, inline styles with `--rd-*` tokens, Vitest (`npm run test:web`), plain divs (no chart lib).

## Global Constraints

- Follow the `rd` design language: inline styles, `--rd-*` tokens, `var(--font-display)` serif for headings, calm microcopy.
- No new dependencies.
- GoalEditor, GoalDetail, `/api/goals`, and the `Goal` type are **unchanged**.
- Reduced motion: no new animation may run under `prefers-reduced-motion: reduce`.
- All tests green after every task: `npm run test:web` (48 existing) and `npx tsc -b`.
- "Someday" goals (no target year) are OUT of scope — `targetDate` stays required.

---

### Task 1: goalsLogic — full-life decades + goal category on cards

**Files:**
- Modify: `src/pages/rd/goalsLogic.ts` (interfaces `Decade`, `GoalCard`; function `buildDecades`; new helper `goalDecade`)
- Test: `src/pages/rd/goalsLogic.test.ts`

**Interfaces:**
- Consumes: existing `Goal`, `goalCard`, `catColor`, `currentAge`.
- Produces: `Decade` gains `lived: boolean` (decade entirely before the current one); `GoalCard` gains `category: string` (raw name, for filtering); `buildDecades` now returns **9 decades (0s → 80s) always**, placing past-dated goals in their true decade; exported `goalDecade(g: Goal, birthYear: number, thisYear: number): number`.

- [ ] **Step 1: Update the failing tests** — in `goalsLogic.test.ts`, replace the whole `describe('buildDecades', ...)` block with:

```ts
describe('buildDecades', () => {
  it('spans all decades 0s → 80s and marks the current one', () => {
    const decs = buildDecades([], 1992, 2025); // curAge 33 -> now = 30s
    expect(decs.length).toBe(9);
    expect(decs[0].d0).toBe(0);
    expect(decs[decs.length - 1].d0).toBe(80);
    const now = decs.find(d => d.isNow)!;
    expect(now.d0).toBe(30);
    expect(now.years).toBe('2022 – 2031');
    expect(now.prefillYear).toBe(2026); // isNow -> thisYear+1
    expect(decs.find(d => d.d0 === 40)!.prefillYear).toBe(1992 + 40 + 2);
  });
  it('marks decades before the current one as lived', () => {
    const decs = buildDecades([], 1992, 2025);
    expect(decs.find(d => d.d0 === 20)!.lived).toBe(true);
    expect(decs.find(d => d.d0 === 30)!.lived).toBe(false); // isNow, not lived
    expect(decs.find(d => d.d0 === 40)!.lived).toBe(false);
  });
  it('places a goal into the right decade', () => {
    const decs = buildDecades([base({ targetDate: '2045-01-01' })], 1992, 2025); // age 53 -> 50s
    expect(decs.find(d => d.d0 === 50)!.goals.length).toBe(1);
  });
  it('places a past-dated goal in its true (lived) decade, not the current one', () => {
    const decs = buildDecades([base({ targetDate: '2000-01-01' })], 1992, 2025); // age 8 -> 0s
    expect(decs.find(d => d.d0 === 0)!.goals.length).toBe(1);
    expect(decs.find(d => d.d0 === 30)!.goals.length).toBe(0);
  });
  it('lived add-label reads as memory; future as goal', () => {
    const decs = buildDecades([], 1992, 2025);
    expect(decs.find(d => d.d0 === 20)!.addLabel).toBe('Add a memory from your 20s');
    expect(decs.find(d => d.d0 === 50)!.addLabel).toBe('Add a goal for your 50s');
  });
  it('goal cards carry their raw category for filtering', () => {
    const decs = buildDecades([base({ targetDate: '2045-01-01', category: 'Family' })], 1992, 2025);
    expect(decs.find(d => d.d0 === 50)!.goals[0].category).toBe('Family');
  });
});
```

- [ ] **Step 2: Run to verify failures** — `npm run test:web` → the new `buildDecades` tests FAIL (9-length, lived, past placement, category).

- [ ] **Step 3: Implement** — in `goalsLogic.ts`:

Add `category` to `GoalCard` (interface + return of `goalCard`):

```ts
export interface GoalCard {
  id: string;
  hasImage: boolean;
  image: string;
  catColor: string;
  category: string;
  metaLine: string;
  title: string;
  thumbs: string[];
  rewardLine: string;
  showProgress: boolean;
  progressPct: string;
  achieved: boolean;
}
// in goalCard(...)'s return object add:
//   category: g.category,
```

Replace `Decade` + `buildDecades` with:

```ts
export interface Decade {
  d0: number;
  label: string;
  years: string;
  isNow: boolean;
  lived: boolean;
  hasGoals: boolean;
  goals: GoalCard[];
  addLabel: string;
  prefillYear: number;
}

// Decade (0/10/…/80) a goal belongs to, from its target year; ages clamp into 0–89.
export function goalDecade(g: Goal, birthYear: number, thisYear: number): number {
  const y = parseInt((g.targetDate || '').slice(0, 4)) || thisYear;
  const a = Math.min(89, Math.max(0, y - birthYear));
  return Math.floor(a / 10) * 10;
}

export function buildDecades(goals: Goal[], birthYear: number, thisYear: number): Decade[] {
  const curAge = currentAge(birthYear, thisYear);
  const nowD0 = Math.min(80, Math.floor(curAge / 10) * 10);
  const out: Decade[] = [];
  for (let d0 = 0; d0 <= 80; d0 += 10) {
    const gs = goals
      .filter(g => goalDecade(g, birthYear, thisYear) === d0)
      .sort((a, b) => (a.targetDate || '').localeCompare(b.targetDate || ''));
    const isNow = d0 === nowD0;
    const lived = d0 < nowD0;
    out.push({
      d0,
      label: `${d0}s`,
      years: `${birthYear + d0} – ${birthYear + d0 + 9}`,
      isNow,
      lived,
      hasGoals: gs.length > 0,
      goals: gs.map(g => goalCard(g, birthYear, thisYear)),
      addLabel: gs.length
        ? '+ add another'
        : lived ? `Add a memory from your ${d0}s` : `Add a goal for your ${d0}s`,
      prefillYear: isNow ? thisYear + 1 : birthYear + d0 + 2,
    });
  }
  return out;
}
```

- [ ] **Step 4: Verify** — `npm run test:web` all green; `npx tsc -b` clean (Goals.tsx keeps compiling — it only reads fields that still exist).

- [ ] **Step 5: Commit** — `git add src/pages/rd/goalsLogic.ts src/pages/rd/goalsLogic.test.ts && git commit -m "feat(goals): full-life decades (0s-80s) with lived flag + card category"`

---

### Task 2: goalsLogic — spectrumData

**Files:**
- Modify: `src/pages/rd/goalsLogic.ts` (append)
- Test: `src/pages/rd/goalsLogic.test.ts` (append)

**Interfaces:**
- Produces (consumed by Tasks 3–4):

```ts
export interface SpectrumDot { goalId: string; color: string; achieved: boolean; category: string; }
export interface SpectrumCluster { year: number; pct: number; d0: number; dots: SpectrumDot[]; extra: number; }
export interface SpectrumData {
  nowPct: number; // 0..100, current age on the 0–90 span
  clusters: SpectrumCluster[]; // one per target year that has goals, ascending
  ticks: { d0: number; pct: number; label: string }[]; // 9 decade ticks
}
export function spectrumData(goals: Goal[], birthYear: number, thisYear: number): SpectrumData
```

- [ ] **Step 1: Write failing tests** — append to `goalsLogic.test.ts` (add `spectrumData` to the import):

```ts
describe('spectrumData', () => {
  it('needle at current age / 90', () => {
    expect(spectrumData([], 1992, 2025).nowPct).toBeCloseTo((33 / 90) * 100);
    expect(spectrumData([], 1920, 2025).nowPct).toBe(100); // age >90 clamps
  });
  it('one cluster per year, positioned by age, ascending', () => {
    const s = spectrumData([
      base({ id: 'a', targetDate: '2045-01-01' }),               // age 53
      base({ id: 'b', targetDate: '2030-06-01', category: 'Family' }), // age 38
    ], 1992, 2025);
    expect(s.clusters.length).toBe(2);
    expect(s.clusters[0].year).toBe(2030);
    expect(s.clusters[0].pct).toBeCloseTo((38 / 90) * 100);
    expect(s.clusters[0].d0).toBe(30);
    expect(s.clusters[0].dots[0]).toEqual({ goalId: 'b', color: '#C7A9B4', achieved: false, category: 'Family' });
  });
  it('caps dots at 3 with an extra count', () => {
    const gs = ['a', 'b', 'c', 'd', 'e'].map(id => base({ id, targetDate: '2045-01-01' }));
    const c = spectrumData(gs, 1992, 2025).clusters[0];
    expect(c.dots.length).toBe(3);
    expect(c.extra).toBe(2);
  });
  it('achieved dots are flagged; out-of-range years clamp onto the span', () => {
    const s = spectrumData([
      base({ id: 'won', targetDate: '2000-01-01', completed: true }), // past
      base({ id: 'far', targetDate: '2095-01-01' }),                  // beyond 90
    ], 1992, 2025);
    expect(s.clusters[0].dots[0].achieved).toBe(true);
    expect(s.clusters[0].pct).toBeCloseTo((8 / 90) * 100);
    expect(s.clusters[1].pct).toBeCloseTo((89 / 90) * 100); // clamped to age 89
  });
  it('nine decade ticks 0s..80s', () => {
    const t = spectrumData([], 1992, 2025).ticks;
    expect(t.length).toBe(9);
    expect(t[0]).toEqual({ d0: 0, pct: 0, label: '0s' });
    expect(t[8].label).toBe('80s');
  });
});
```

- [ ] **Step 2: Run to verify fail** — `npm run test:web` → `spectrumData is not a function`.

- [ ] **Step 3: Implement** — append to `goalsLogic.ts`:

```ts
export interface SpectrumDot { goalId: string; color: string; achieved: boolean; category: string; }
export interface SpectrumCluster { year: number; pct: number; d0: number; dots: SpectrumDot[]; extra: number; }
export interface SpectrumData {
  nowPct: number;
  clusters: SpectrumCluster[];
  ticks: { d0: number; pct: number; label: string }[];
}

export function spectrumData(goals: Goal[], birthYear: number, thisYear: number): SpectrumData {
  const nowPct = Math.min(100, (currentAge(birthYear, thisYear) / 90) * 100);
  const byYear = new Map<number, Goal[]>();
  for (const g of goals) {
    const y = parseInt((g.targetDate || '').slice(0, 4)) || thisYear;
    const clamped = Math.min(birthYear + 89, Math.max(birthYear, y));
    byYear.set(clamped, [...(byYear.get(clamped) || []), g]);
  }
  const clusters = [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, gs]) => {
      const age = year - birthYear;
      const sorted = [...gs].sort((a, b) => a.title.localeCompare(b.title));
      return {
        year,
        pct: (age / 90) * 100,
        d0: Math.floor(age / 10) * 10,
        dots: sorted.slice(0, 3).map(g => ({
          goalId: g.id, color: catColor(g.category), achieved: g.completed, category: g.category,
        })),
        extra: Math.max(0, gs.length - 3),
      };
    });
  const ticks = Array.from({ length: 9 }, (_, i) => ({
    d0: i * 10, pct: (i * 10 / 90) * 100, label: `${i * 10}s`,
  }));
  return { nowPct, clusters, ticks };
}
```

- [ ] **Step 4: Verify** — `npm run test:web` green, `npx tsc -b` clean.
- [ ] **Step 5: Commit** — `git commit -m "feat(goals): spectrumData — year clusters, needle pct, decade ticks"`

---

### Task 3: LifeSpectrum component

**Files:**
- Create: `src/pages/rd/LifeSpectrum.tsx`

**Interfaces:**
- Consumes: `SpectrumData`, `SpectrumCluster` from `./goalsLogic`.
- Produces: `export default function LifeSpectrum({ data, activeCategory, onJump }: { data: SpectrumData; activeCategory: string | null; onJump: (d0: number) => void })` — Task 4 renders it inside the sticky header.

No unit test (pure presentation; logic already covered). Verified via typecheck + Task 5 visual QC.

- [ ] **Step 1: Implement** — create `src/pages/rd/LifeSpectrum.tsx`:

```tsx
import type { SpectrumCluster, SpectrumData } from './goalsLogic';

// The whole-life map: lived fill, "now" needle, one dot-stack per goal year.
// Tapping anywhere jumps to that decade; clusters are real buttons for a11y.
export default function LifeSpectrum({ data, activeCategory, onJump }: {
  data: SpectrumData;
  activeCategory: string | null;
  onJump: (d0: number) => void;
}) {
  const jumpFromTrack = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(0.999, Math.max(0, (e.clientX - r.left) / r.width));
    onJump(Math.min(80, Math.floor((pct * 90) / 10) * 10));
  };
  return (
    <div>
      <div onClick={jumpFromTrack} style={{ position: 'relative', height: 56, cursor: 'pointer' }}>
        {/* track + lived fill */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 4, marginTop: -2, borderRadius: 999, background: 'rgba(255,255,255,0.07)' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${data.nowPct}%`, borderRadius: 999, background: 'linear-gradient(90deg, rgba(157,180,204,0.35), rgba(127,180,217,0.45))' }} />
        </div>
        {/* now needle */}
        <div style={{ position: 'absolute', left: `${data.nowPct}%`, top: 6, bottom: 6, width: 2, marginLeft: -1, borderRadius: 1, background: '#B3D6EC', boxShadow: '0 0 10px rgba(179,214,236,0.7)' }} />
        {/* goal clusters */}
        {data.clusters.map(c => <Cluster key={c.year} c={c} activeCategory={activeCategory} onJump={onJump} />)}
      </div>
      {/* decade ticks */}
      <div style={{ position: 'relative', height: 16 }}>
        {data.ticks.map(t => (
          <span key={t.d0} onClick={() => onJump(t.d0)} style={{
            position: 'absolute', left: `${t.pct}%`, transform: 'translateX(-4%)',
            fontSize: 10, color: 'var(--rd-dim)', cursor: 'pointer', letterSpacing: '0.04em',
          }}>{t.label}</span>
        ))}
      </div>
    </div>
  );
}

function Cluster({ c, activeCategory, onJump }: {
  c: SpectrumCluster; activeCategory: string | null; onJump: (d0: number) => void;
}) {
  const n = c.dots.length + c.extra;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onJump(c.d0); }}
      aria-label={`${n} goal${n === 1 ? '' : 's'} around ${c.year}`}
      style={{
        position: 'absolute', left: `${c.pct}%`, top: 0, bottom: 0, width: 22, marginLeft: -11,
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
      }}
    >
      {c.dots.map(d => {
        const dim = activeCategory != null && d.category !== activeCategory;
        return (
          <span key={d.goalId} style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: d.achieved ? 'var(--rd-sage)' : d.color,
            boxShadow: d.achieved ? '0 0 8px rgba(169,198,179,0.7)' : 'none',
            opacity: dim ? 0.15 : 1,
          }} />
        );
      })}
      {c.extra > 0 && <span style={{ fontSize: 9, color: 'var(--rd-muted-2)', lineHeight: 1 }}>+{c.extra}</span>}
    </button>
  );
}
```

- [ ] **Step 2: Verify** — `npx tsc -b` clean (component not yet mounted; that's Task 4).
- [ ] **Step 3: Commit** — `git commit -m "feat(goals): LifeSpectrum component — track, needle, clusters, ticks"`

---

### Task 4: Goals.tsx — sticky spectrum, chips, chapters, jump/auto-scroll

**Files:**
- Modify: `src/pages/rd/Goals.tsx`
- Modify: `src/index.css` (one keyframe)

**Interfaces:**
- Consumes: `LifeSpectrum` (Task 3), `spectrumData`, `Decade.lived`, `GoalCard.category`, `GOAL_CATS` from `goalsLogic`.

- [ ] **Step 1: Add the flash keyframe** to `src/index.css` (near `orbBreathe`), reduced-motion-safe:

```css
@keyframes rdFlash {
  0% { background: rgba(127, 180, 217, 0.08); }
  100% { background: transparent; }
}
@media (prefers-reduced-motion: reduce) {
  .rd-flash { animation: none !important; }
}
```

- [ ] **Step 2: Refactor `Goals.tsx`.** Keep: load/error/birth-year-prompt states, overlays, `GoalCardView`. Change the signed-in body as follows.

New imports/state/refs (top of component, alongside existing state):

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import LifeSpectrum from './LifeSpectrum';
import { buildDecades, currentAge, spectrumData, GOAL_CATS, type GoalCard } from './goalsLogic';

const [activeCategory, setActiveCategory] = useState<string | null>(null);
const [flashD0, setFlashD0] = useState<number | null>(null);
const decadeRefs = useRef<Record<number, HTMLDivElement | null>>({});
const didAutoScroll = useRef(false);
const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

const spectrum = useMemo(
  () => (birthYear ? spectrumData(goals, birthYear, thisYear) : null),
  [goals, birthYear, thisYear],
);

const jumpTo = (d0: number) => {
  decadeRefs.current[d0]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setFlashD0(d0);
  if (flashTimer.current) clearTimeout(flashTimer.current);
  flashTimer.current = setTimeout(() => setFlashD0(null), 900);
};

// On first load with past decades above, bring "now" into view (spectrum stays visible above).
useEffect(() => {
  if (loading || birthYear == null || didAutoScroll.current) return;
  didAutoScroll.current = true;
  const now = decades.find(d => d.isNow);
  if (now && decades.some(d => d.lived)) {
    decadeRefs.current[now.d0]?.scrollIntoView({ block: 'start' });
  }
}, [loading, birthYear, decades]);

useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);
```

Replace the old life-bar block (`{/* Life bar */} <div style={{ margin: '22px 0 30px 0' }}>…</div>`) with a sticky header — it bleeds over `Screen`'s 20px side padding so the background covers edge-to-edge while scrolling:

```tsx
{/* Life spectrum — sticky whole-life map */}
<div style={{
  position: 'sticky', top: 0, zIndex: 5, background: 'var(--rd-bg)',
  margin: '18px -20px 8px', padding: '10px 20px 8px',
}}>
  {spectrum && <LifeSpectrum data={spectrum} activeCategory={activeCategory} onJump={jumpTo} />}
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#5B7085', margin: '6px 0 10px' }}>
    <span>age {curAge}</span><span>90</span>
  </div>
  {/* category filter chips */}
  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
    {GOAL_CATS.map(cat => {
      const on = activeCategory === cat.name;
      return (
        <button key={cat.name} onClick={() => setActiveCategory(on ? null : cat.name)} style={{
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, cursor: 'pointer',
          fontSize: 11.5, padding: '5px 11px', borderRadius: 999,
          border: `1px solid ${on ? 'rgba(127,180,217,0.5)' : 'var(--rd-border)'}`,
          background: on ? 'rgba(127,180,217,0.12)' : 'var(--rd-surface)',
          color: on ? 'var(--rd-ink)' : 'var(--rd-muted)',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: cat.color }} />
          {cat.name}
        </button>
      );
    })}
  </div>
</div>
```

Replace the decade rail `decades.map(...)` body: each decade gets an anchor ref + scroll margin (clears the ~150px sticky header), collapsed rendering for empty non-current decades, `lived` framing, flash, and card dimming:

```tsx
<div style={{ display: 'flex', flexDirection: 'column' }}>
  {decades.map(dec => {
    const anchor = (el: HTMLDivElement | null) => { decadeRefs.current[dec.d0] = el; };
    // Collapsed row: empty decades that aren't "now" cost one line, not a card block.
    if (!dec.hasGoals && !dec.isNow) {
      return (
        <div key={dec.d0} ref={anchor} onClick={() => setOverlay({ kind: 'editor', prefillYear: dec.prefillYear })}
          role="button" className={flashD0 === dec.d0 ? 'rd-flash' : undefined}
          style={{
            display: 'flex', alignItems: 'baseline', gap: 10, padding: '11px 4px',
            borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer',
            scrollMarginTop: 150, borderRadius: 10,
            animation: flashD0 === dec.d0 ? 'rdFlash 0.9s ease' : undefined,
          }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--rd-muted)' }}>{dec.label}</span>
          <span style={{ fontSize: 11, color: '#5B7085' }}>{dec.years}{dec.lived ? ' · lived' : ''}</span>
          <span style={{ marginLeft: 'auto', fontSize: 16, color: '#6B8095' }}>+</span>
        </div>
      );
    }
    // Expanded chapter (has goals, or is the current decade): existing layout + lived label + flash + dimming.
    return (
      <div key={dec.d0} ref={anchor} className={flashD0 === dec.d0 ? 'rd-flash' : undefined}
        style={{
          display: 'flex', gap: 16, scrollMarginTop: 150, borderRadius: 12, marginTop: 8,
          animation: flashD0 === dec.d0 ? 'rdFlash 0.9s ease' : undefined,
        }}>
        {/* keep the existing dot+line gutter column unchanged */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 12, paddingTop: 8 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
            ...(dec.isNow
              ? { background: '#7FB4D9', boxShadow: '0 0 12px rgba(127,180,217,0.6)' }
              : dec.hasGoals
                ? { background: 'rgba(157,180,204,0.55)' }
                : { background: 'rgba(255,255,255,0.12)' }),
          }} />
          <div style={{ width: 1.5, flex: 1, background: 'linear-gradient(180deg, rgba(157,180,204,0.25), rgba(157,180,204,0.04))', marginTop: 7 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingBottom: 30 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--rd-ink)' }}>{dec.label}</span>
            <span style={{ fontSize: 11.5, color: '#5B7085' }}>{dec.years}{dec.lived ? ' · lived' : ''}</span>
            {dec.isNow && (
              <span style={{ fontSize: 10.5, color: '#7FB4D9', background: 'rgba(127,180,217,0.1)', padding: '3px 10px', borderRadius: 999 }}>you are here</span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
            {dec.goals.map(card => (
              <div key={card.id} style={{
                opacity: activeCategory != null && card.category !== activeCategory ? 0.35 : 1,
                transition: 'opacity 0.2s ease',
              }}>
                <GoalCardView card={card} onOpen={() => setOverlay({ kind: 'detail', id: card.id })} />
              </div>
            ))}
            <div onClick={() => setOverlay({ kind: 'editor', prefillYear: dec.prefillYear })} role="button"
              style={{ border: '1.5px dashed rgba(157,180,204,0.22)', borderRadius: 18, padding: '13px 18px', fontSize: 13, color: '#6B8095', cursor: 'pointer', textAlign: 'center' }}>
              {dec.addLabel}
            </div>
          </div>
        </div>
      </div>
    );
  })}
</div>
```

Also delete the now-redundant empty-state italics condition change: keep `goalsEmpty` quote block as-is (it still reads well above the chapters).

- [ ] **Step 3: Verify** — `npx tsc -b` clean; `npm run test:web` green; `npm run build` succeeds.
- [ ] **Step 4: Manual smoke in browser** (vite dev or preview): spectrum renders with markers; tapping a tick/cluster scrolls + flashes; chips dim cards and markers; empty decades are single rows; past decades show "· lived"; current decade auto-scrolled into view on load.
- [ ] **Step 5: Commit** — `git commit -m "feat(goals): sticky Life Spectrum + category chips + collapsed full-life chapters"`

---

### Task 5: QC, deploy, live-verify

- [ ] **Step 1:** Full suite: `npm run test:web`, `node --test tests/*.test.js`, `node --experimental-strip-types --test tests/*.test.ts`, `npm run build` — all green.
- [ ] **Step 2:** Push `main`; verify Vercel picked it up (the webhook is flaky — if the live bundle is stale, `vercel --prod --yes`).
- [ ] **Step 3:** Live-verify via `https://nlp-training-tool.vercel.app` (heart.sovereignty.app is DNS-blocked from the sandbox): grep the live `Goals-*.js` chunk for a distinctive string (e.g. `Add a memory from your`).
- [ ] **Step 4:** On-device check by Max (installed PWA — close + reopen twice to flush the SW cache). Watch specifically: sticky behavior of the spectrum inside the AppShell scroll container on iOS standalone. **Fallback if sticky misbehaves:** drop `position: 'sticky'` from the header div (everything else keeps working; the spectrum then scrolls with the page).

---

## Self-review notes

- Spec coverage: spectrum band w/ markers+needle+tap-jump (T2/T3), sticky (T4), all-decades incl. past + collapsed empties + lived framing (T1/T4), category chips dimming markers+cards (T3/T4), auto-scroll to now (T4), reduced-motion (T4 keyframe guard; no other new animation), a11y cluster buttons (T3). "Someday" goals deliberately out of scope per Global Constraints.
- Type consistency: `SpectrumData/SpectrumCluster/SpectrumDot` defined in T2, consumed verbatim in T3/T4; `GoalCard.category` added in T1, used in T4; `Decade.lived` added in T1, used in T4.
