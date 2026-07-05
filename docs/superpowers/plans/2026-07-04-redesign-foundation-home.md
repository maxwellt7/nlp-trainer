# Redesign: Foundation + Home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the calm-redesign foundation (design tokens, fonts, bottom-nav app shell, reusable primitives) and a fully rebuilt, data-wired Home screen, without disturbing the not-yet-redesigned screens.

**Architecture:** Additive design tokens in Tailwind v4 `@theme` (new names, old gold tokens untouched). New presentational components under `src/components/rd/`, new Home under `src/pages/rd/`. A new `AppShell` replaces `Layout`'s sidebar with a centered column + bottom tab bar; the center orb opens a chooser sheet that routes into the existing chat flow. Pure logic (greeting, streak dots) is unit-tested with Vitest; components verified by build + on-device.

**Tech Stack:** React 19, Vite 8, Tailwind v4, react-router-dom 7, Vitest (new), Newsreader + Albert Sans (Google Fonts).

## Global Constraints

- Mobile-first, centered column (`max-width ~440px`, centered on desktop). No bespoke wide-desktop layouts.
- Faithful to the mockup's visual language; adapt where real data differs. Not pixel-perfect.
- New tokens use `--rd-*` / `--font-*` names; DO NOT modify existing `--color-brand-*` / `--color-accent-gold*` (un-redesigned screens depend on them).
- Fonts: `--font-display: 'Newsreader', serif` (display, italic for names), `--font-sans: 'Albert Sans', sans-serif` (UI/body).
- Palette (verbatim): bg `#06121c`, ink `#eaf0f4`, muted `#9db4cc`/`#6b8095`, accent `#5a93bd`/`#7fb4d9`, sage `#a9c6b3`, surface `rgba(255,255,255,0.05)`, border `rgba(255,255,255,0.08)`, danger `#ff8a80`.
- Frontend-only; NO backend/API changes. Use existing endpoints: `GET /api/profile/streak`, `GET /api/profile/sessions`, `GET /api/profile`.
- Voice option in the chooser is disabled ("coming soon"); Text path uses the existing chat.
- New code under `src/components/rd/` and `src/pages/rd/`. Branch: `feature/redesign-foundation-home`.
- Verify build (`npm run build`) green after each task. After the final push, force `vercel --prod --yes` (git auto-deploy is flaky) and confirm the live bundle.

---

### Task 1: Design tokens + fonts

**Files:**
- Modify: `src/index.css` (add font import + `@theme` tokens; do not touch existing tokens)

- [ ] **Step 1: Add the Google Fonts import** at the very top of `src/index.css`, after the existing `@import url('...Inter...')` line:

```css
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..600&family=Albert+Sans:wght@300;400;500;600;700&display=swap');
```

- [ ] **Step 2: Add redesign tokens** inside the existing `@theme { ... }` block (append before its closing `}`), leaving all existing tokens as-is:

```css
  /* ── Redesign (calm) tokens — additive; do not replace brand tokens ── */
  --font-display: 'Newsreader', ui-serif, Georgia, serif;
  --font-sans: 'Albert Sans', -apple-system, BlinkMacSystemFont, sans-serif;

  --rd-bg: #06121c;
  --rd-bg-deep: #081018;
  --rd-ink: #eaf0f4;
  --rd-ink-soft: #d3dee8;
  --rd-muted: #9db4cc;
  --rd-muted-2: #6b8095;
  --rd-dim: #5b7085;
  --rd-accent: #5a93bd;
  --rd-accent-bright: #7fb4d9;
  --rd-accent-deep: #3e6a8c;
  --rd-sage: #a9c6b3;
  --rd-sage-soft: #c9e0d1;
  --rd-surface: rgba(255,255,255,0.05);
  --rd-surface-2: rgba(255,255,255,0.07);
  --rd-border: rgba(255,255,255,0.08);
  --rd-accent-glow: rgba(90,147,189,0.35);
  --rd-danger: #ff8a80;
  --rd-radius-card: 20px;
```

- [ ] **Step 3: Verify build** — `npm run build` → completes; no CSS errors.
- [ ] **Step 4: Commit** — `git add src/index.css && git commit -m "feat(rd): calm redesign design tokens + Newsreader/Albert Sans fonts"`

### Task 2: Vitest + pure logic helpers (TDD)

**Files:**
- Create: `src/pages/rd/homeLogic.ts`, `src/pages/rd/homeLogic.test.ts`
- Modify: `package.json` (add `vitest` devDep + `"test:web": "vitest run"` script), `vite.config.ts` (add `test` config)

**Interfaces:**
- Produces:
  - `greeting(date: Date): { dateLabel: string; timeOfDay: 'morning' | 'afternoon' | 'evening' }`
  - `weekDots(streak: { last_session_date?: string; current_streak?: number } | null, today: Date): Array<{ day: string; state: 'filled' | 'empty' | 'today' }>`

- [ ] **Step 1: Install Vitest** — `npm install -D vitest --legacy-peer-deps`. Add to `package.json` scripts: `"test:web": "vitest run"`.

- [ ] **Step 2: Configure Vitest** in `vite.config.ts` — add a `test` key to the config object:

```ts
// inside defineConfig({ ... })
test: { environment: 'node', include: ['src/**/*.test.ts'] },
```

- [ ] **Step 3: Write failing tests** — `src/pages/rd/homeLogic.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { greeting, weekDots } from './homeLogic';

describe('greeting', () => {
  it('labels the date and picks morning/afternoon/evening', () => {
    const g = greeting(new Date('2026-07-04T09:00:00'));
    expect(g.timeOfDay).toBe('morning');
    expect(g.dateLabel.toUpperCase()).toContain('JULY');
    expect(greeting(new Date('2026-07-04T15:00:00')).timeOfDay).toBe('afternoon');
    expect(greeting(new Date('2026-07-04T20:00:00')).timeOfDay).toBe('evening');
  });
});

describe('weekDots', () => {
  it('returns 7 days Mon..Sun with today marked', () => {
    const dots = weekDots({ current_streak: 4, last_session_date: '2026-07-04' }, new Date('2026-07-04T12:00:00'));
    expect(dots).toHaveLength(7);
    expect(dots.map(d => d.day)).toEqual(['M','T','W','T','F','S','S']);
    // 2026-07-04 is a Saturday -> index 5 is "today"
    expect(dots[5].state).toBe('today');
  });
  it('handles no streak', () => {
    const dots = weekDots(null, new Date('2026-07-04T12:00:00'));
    expect(dots).toHaveLength(7);
    expect(dots.every(d => d.state !== 'filled')).toBe(true);
  });
});
```

- [ ] **Step 4: Run tests → FAIL** — `npm run test:web` → fails (module not found).

- [ ] **Step 5: Implement** — `src/pages/rd/homeLogic.ts`:

```ts
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // JS getDay(): 0=Sun
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun

export function greeting(date: Date): { dateLabel: string; timeOfDay: 'morning' | 'afternoon' | 'evening' } {
  const h = date.getHours();
  const timeOfDay = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  const dateLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return { dateLabel, timeOfDay };
}

export function weekDots(
  streak: { last_session_date?: string; current_streak?: number } | null,
  today: Date,
): Array<{ day: string; state: 'filled' | 'empty' | 'today' }> {
  const todayDow = today.getDay();
  const streakLen = streak?.current_streak || 0;
  // Days (from today backwards) that are part of the current streak.
  const filledDates = new Set<string>();
  for (let i = 0; i < streakLen; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    filledDates.add(d.toISOString().slice(0, 10));
  }
  return WEEK_ORDER.map((dow) => {
    // Find the date in the current week (Mon..Sun) for this weekday.
    const delta = dow - todayDow;
    const d = new Date(today);
    d.setDate(today.getDate() + delta);
    const iso = d.toISOString().slice(0, 10);
    const isToday = dow === todayDow;
    let state: 'filled' | 'empty' | 'today' = 'empty';
    if (isToday) state = 'today';
    else if (filledDates.has(iso)) state = 'filled';
    return { day: DAY_LABELS[dow], state };
  });
}
```

- [ ] **Step 6: Run tests → PASS** — `npm run test:web`.
- [ ] **Step 7: Commit** — `git add src/pages/rd/homeLogic.ts src/pages/rd/homeLogic.test.ts package.json package-lock.json vite.config.ts && git commit -m "feat(rd): Home pure logic (greeting, week dots) + Vitest"`

### Task 3: Presentational primitives

**Files:**
- Create: `src/components/rd/Screen.tsx`, `src/components/rd/Card.tsx`, `src/components/rd/SectionLabel.tsx`, `src/components/rd/StreakDots.tsx`
- Test: build + on-device

**Interfaces:**
- Produces: `Screen({children})`, `Card({children, className?})`, `SectionLabel({children})`, `StreakDots({dots})` where `dots` is `weekDots(...)`'s return type.

- [ ] **Step 1: `Screen.tsx`** — centered scroll column:

```tsx
export default function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--rd-bg)', minHeight: '100dvh', color: 'var(--rd-ink)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '32px 20px 120px' }}>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `Card.tsx`**:

```tsx
export default function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={className} style={{
      background: 'var(--rd-surface)', border: '1px solid var(--rd-border)',
      borderRadius: 'var(--rd-radius-card)', padding: 20,
    }}>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: `SectionLabel.tsx`**:

```tsx
export default function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
      color: 'var(--rd-muted-2)', marginBottom: 12,
    }}>{children}</div>
  );
}
```

- [ ] **Step 4: `StreakDots.tsx`**:

```tsx
import { weekDots } from '../../pages/rd/homeLogic';

type Dots = ReturnType<typeof weekDots>;

export default function StreakDots({ dots }: { dots: Dots }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      {dots.map((d, i) => (
        <div key={i} style={{ textAlign: 'center', flex: 1 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', margin: '0 auto 6px',
            background: d.state === 'filled' ? 'var(--rd-sage)' : 'transparent',
            border: d.state === 'today' ? '1px solid var(--rd-accent-bright)'
                   : d.state === 'filled' ? 'none' : '1px solid var(--rd-dim)',
          }} />
          <div style={{ fontSize: 11, color: d.state === 'today' ? 'var(--rd-ink)' : 'var(--rd-dim)' }}>{d.day}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Verify build** — `npm run build` green.
- [ ] **Step 6: Commit** — `git add src/components/rd && git commit -m "feat(rd): presentational primitives (Screen, Card, SectionLabel, StreakDots)"`

### Task 4: BottomNav + Orb + ChooserSheet

**Files:**
- Create: `src/components/rd/ChooserSheet.tsx`, `src/components/rd/BottomNav.tsx`
- Test: build + on-device

**Interfaces:**
- Consumes: `useNavigate`, `useLocation` from react-router-dom.
- Produces: `BottomNav()` (self-contained; renders tabs + orb + manages its own chooser open state), `ChooserSheet({open, onClose, onPick})` where `onPick(kind: 'daily' | 'general')` navigates.

- [ ] **Step 1: `ChooserSheet.tsx`** — bottom sheet with Daily/General × Text/Voice(disabled):

```tsx
export default function ChooserSheet({ open, onClose, onPick }: {
  open: boolean; onClose: () => void; onPick: (kind: 'daily' | 'general') => void;
}) {
  if (!open) return null;
  const row = (label: string, sub: string, kind: 'daily' | 'general') => (
    <button onClick={() => onPick(kind)} style={{
      display: 'block', width: '100%', textAlign: 'left', background: 'var(--rd-surface)',
      border: '1px solid var(--rd-border)', borderRadius: 16, padding: 16, marginBottom: 12, color: 'var(--rd-ink)',
    }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--rd-muted)' }}>{sub}</div>
    </button>
  );
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 440, margin: '0 auto', background: 'var(--rd-bg-deep)',
        borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
      }}>
        <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--rd-muted-2)', marginBottom: 14 }}>Start a session</div>
        {row('Daily Session', 'Your evening ritual', 'daily')}
        {row('General Chat', 'An open-ended conversation', 'general')}
        <div style={{ fontSize: 12, color: 'var(--rd-dim)', textAlign: 'center', marginTop: 8 }}>Voice — coming soon</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `BottomNav.tsx`** — 4 tabs + center orb, wired to routes. The orb opens the chooser; picking navigates to the existing chat routes (`/hypnosis` daily, `/chat` general):

```tsx
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import ChooserSheet from './ChooserSheet';

const TABS = [
  { to: '/', label: 'Home', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
  { to: '/insights', label: 'Insights', icon: 'M4 19V10M10 19V5M16 19v-7M22 19H2' },
  { to: '/library', label: 'Library', icon: 'M4 5h16v14H4zM8 5v14' },
  { to: '/you', label: 'You', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0' },
];

export default function BottomNav() {
  const [chooser, setChooser] = useState(false);
  const navigate = useNavigate();
  const pick = (kind: 'daily' | 'general') => { setChooser(false); navigate(kind === 'daily' ? '/hypnosis' : '/chat'); };
  const half = (arr: typeof TABS) => arr;
  return (
    <>
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
        display: 'flex', justifyContent: 'center',
        paddingBottom: 'env(safe-area-inset-bottom)', pointerEvents: 'none',
      }}>
        <div style={{
          width: '100%', maxWidth: 440, margin: '0 auto 12px', pointerEvents: 'auto',
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', alignItems: 'center',
          background: 'var(--rd-bg-deep)', border: '1px solid var(--rd-border)',
          borderRadius: 24, padding: '8px 6px', boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
        }}>
          {[TABS[0], TABS[1]].map(t => <Tab key={t.to} {...t} />)}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button aria-label="Start a session" onClick={() => setChooser(true)} style={{
              width: 48, height: 48, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'radial-gradient(circle at 30% 30%, var(--rd-accent-bright), var(--rd-accent-deep))',
              boxShadow: '0 0 24px var(--rd-accent-glow)',
            }} />
          </div>
          {[TABS[2], TABS[3]].map(t => <Tab key={t.to} {...t} />)}
        </div>
      </nav>
      <ChooserSheet open={chooser} onClose={() => setChooser(false)} onPick={pick} />
    </>
  );
}

function Tab({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink to={to} end={to === '/'} style={({ isActive }) => ({
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      fontSize: 10, textDecoration: 'none',
      color: isActive ? 'var(--rd-ink)' : 'var(--rd-dim)',
    })}>
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
      <span>{label}</span>
    </NavLink>
  );
}
```

- [ ] **Step 3: Verify build** — `npm run build` green.
- [ ] **Step 4: Commit** — `git add src/components/rd && git commit -m "feat(rd): bottom nav + orb + start-session chooser sheet"`

### Task 5: AppShell replaces the sidebar

**Files:**
- Create: `src/components/rd/AppShell.tsx`
- Modify: `src/App.tsx` (swap `<Layout />` for `<AppShell />` in the authed route blocks)

**Interfaces:**
- Consumes: `Outlet` (react-router), `BottomNav`.
- Produces: `AppShell()` — renders `<Outlet/>` inside the calm background + `<BottomNav/>`.

- [ ] **Step 1: `AppShell.tsx`**:

```tsx
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

export default function AppShell() {
  return (
    <div style={{ background: 'var(--rd-bg)', minHeight: '100dvh' }}>
      <Outlet />
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 2: Swap the shell in `src/App.tsx`** — replace `<Route element={<Layout />}>` with `<Route element={<AppShell />}>` in BOTH authed route blocks (the two `<Routes>` that currently wrap routes in `<Layout/>`). Add `import AppShell from './components/rd/AppShell';` and remove the now-unused `Layout` import only if no longer referenced.

- [ ] **Step 3: Verify build** — `npm run build` green.
- [ ] **Step 4: Manual check** (desktop browser via `npm run dev`): every existing route still renders (inside the new shell), bottom nav shows, orb opens the chooser, picking Daily/General opens the chat. (Old screens look like their old selves — expected during transition.)
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(rd): AppShell (bottom-nav) replaces sidebar Layout"`

### Task 6: Home screen (data-wired)

**Files:**
- Create: `src/pages/rd/Home.tsx`
- Modify: `src/App.tsx` (mount `Home` at `/` in both authed blocks, replacing `Dashboard`)

**Interfaces:**
- Consumes: `Screen`, `Card`, `SectionLabel`, `StreakDots`, `greeting`, `weekDots`, `api` (`getStreak`, `getSessions`, `getProfile`), `useNavigate`.

- [ ] **Step 1: Confirm the client API methods exist** — check `src/services/api.ts` for `getStreak()`, `getSessions(limit)`, `getProfile()`. They exist (used elsewhere). If `getStreak` is absent, use `getProfile()` which returns `{ streak }`.

- [ ] **Step 2: Implement `Home.tsx`**:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import Screen from '../../components/rd/Screen';
import Card from '../../components/rd/Card';
import SectionLabel from '../../components/rd/SectionLabel';
import StreakDots from '../../components/rd/StreakDots';
import { greeting, weekDots } from './homeLogic';

export default function Home() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [streak, setStreak] = useState<any>(null);
  const [reflections, setReflections] = useState<any[]>([]);

  useEffect(() => {
    api.getProfile().then((d: any) => {
      setStreak(d.streak || null);
      setFirstName((d.profile?.first_name || d.firstName || '').trim());
    }).catch(() => {});
    api.getSessions(5).then((d: any) => setReflections(d.sessions || d || [])).catch(() => {});
  }, []);

  const now = new Date();
  const g = greeting(now);
  const dots = weekDots(streak, now);
  const streakN = streak?.current_streak || 0;
  const totalSessions = streak?.total_sessions || 0;

  return (
    <Screen>
      <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--rd-muted-2)' }}>
        {g.dateLabel}
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, lineHeight: 1.15, margin: '4px 0 24px' }}>
        Good {g.timeOfDay},<br /><em>{firstName || 'there'}</em>
      </h1>

      <Card>
        <SectionLabel>Tonight’s Session</SectionLabel>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 6 }}>Ready when you are.</div>
        <div style={{ fontSize: 14, color: 'var(--rd-muted)', marginBottom: 18 }}>
          A few minutes of honest conversation, then a guided session shaped around it.
        </div>
        <button onClick={() => navigate('/hypnosis')} style={{
          background: 'var(--rd-accent)', color: '#06121c', border: 'none', borderRadius: 999,
          padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>Begin →</button>
      </Card>

      <div style={{ marginTop: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <SectionLabel>Your Week</SectionLabel>
          <div style={{ fontSize: 12, color: 'var(--rd-muted)' }}>{streakN} day{streakN === 1 ? '' : 's'} in a row</div>
        </div>
        <StreakDots dots={dots} />
      </div>

      <div style={{ marginTop: 28 }}>
        <SectionLabel>Recent Reflections</SectionLabel>
        {reflections.length === 0 && (
          <div style={{ fontSize: 14, color: 'var(--rd-muted)' }}>Your reflections will appear here after a few sessions.</div>
        )}
        {reflections.map((r: any) => (
          <Card key={r.id} className="rd-reflection">
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ textAlign: 'center', minWidth: 34 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--rd-accent-bright)' }}>
                  {r.created_at ? new Date(r.created_at).getDate() : ''}
                </div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--rd-dim)' }}>
                  {r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short' }) : ''}
                </div>
              </div>
              <div style={{ fontSize: 14, color: 'var(--rd-ink-soft)' }}
                onClick={() => navigate(`/hypnosis?sessionId=${r.id}`)}>
                {r.chat_summary?.trim() || 'A coaching conversation.'}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {totalSessions > 0 && (
        <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', textAlign: 'center', color: 'var(--rd-muted-2)', marginTop: 32, fontSize: 14 }}>
          {totalSessions} session{totalSessions === 1 ? '' : 's'} · one conversation at a time
        </div>
      )}
    </Screen>
  );
}
```

(Reflection cards need spacing between them — add `.rd-reflection { margin-bottom: 12px; }` to `src/index.css`, or wrap each in a `div` with `marginBottom`. Use the inline wrapper if you prefer no CSS: wrap each `<Card>` in `<div style={{ marginBottom: 12 }}>`.)

- [ ] **Step 3: Mount Home at `/`** in `src/App.tsx` — replace `<Route path="/" element={<Dashboard />} />` with `<Route path="/" element={<Home />} />` in BOTH authed blocks; add `const Home = lazy(() => import('./pages/rd/Home'));`. Leave `Dashboard` import only if still referenced elsewhere; otherwise remove it.

- [ ] **Step 4: Verify build** — `npm run build` green.
- [ ] **Step 5: Manual check** (`npm run dev`): Home renders greeting, Tonight’s Session → Begin opens the chat, streak dots reflect data, recent reflections list from real sessions, tapping a reflection opens that thread.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(rd): Home screen wired to real streak/sessions data"`

### Task 7: Bottom-nav destination routes (Library / You)

**Files:**
- Modify: `src/App.tsx` (add `/library` and `/you` routes pointing at existing screens during transition)

- [ ] **Step 1: Add transition routes** in both authed blocks so the new tabs resolve to existing screens until those are redesigned:

```tsx
<Route path="/library" element={<Audios />} />
<Route path="/you" element={<Identity />} />
```

(`Audios` and `Identity` are already lazy-imported. `Insights` tab already maps to the existing `/insights` route.)

- [ ] **Step 2: Verify build** — `npm run build` green.
- [ ] **Step 3: Manual check** — all four tabs navigate correctly; active states highlight the right tab.
- [ ] **Step 4: Commit** — `git add src/App.tsx && git commit -m "feat(rd): map Library/You tabs to existing screens during transition"`

### Task 8: Verify, deploy, confirm

- [ ] **Step 1: Full checks** — `npm run test:web` (green), `npm run build` (green), `cd server && node --experimental-sqlite --test` (unchanged, green).
- [ ] **Step 2: Merge + push** — merge `feature/redesign-foundation-home` → `main`, push.
- [ ] **Step 3: Force deploy** — `vercel --prod --yes` (git auto-deploy is flaky). Confirm `vercel inspect heart.sovereignty.app` points to the new deployment.
- [ ] **Step 4: Verify live** — fetch the live main bundle and confirm a redesign string is present:
  `JS=$(curl -s https://heart.sovereignty.app/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1); curl -s "https://heart.sovereignty.app$JS" | grep -c "Ready when you are"` → ≥ 1.
- [ ] **Step 5: On-device** — Max opens the app on iPad: Home renders, bottom nav + orb work, chooser opens, Begin starts a session; other tabs load existing screens inside the new shell.

---

## Self-Review

**Spec coverage:** §4 tokens/fonts → Task 1; §5 shell/nav → Tasks 4–5,7; §6 primitives → Tasks 2–4; §7 Home → Task 6; §8 data mapping → Task 6 (getProfile/getStreak/getSessions); §9 transition (old screens in new shell) → Tasks 5,7; §10 testing/deploy → Tasks 2,8. Covered. Voice-disabled chooser → Task 4 ("Voice — coming soon"). Admin-not-in-tabs → unchanged `/admin` route (untouched).

**Placeholder scan:** No TBD/TODO. Exact type sizes are intentionally "faithful not pixel-perfect" per spec; all code steps contain real code. `getStreak` vs `getProfile().streak` handled with an explicit check step.

**Type consistency:** `greeting(date)→{dateLabel,timeOfDay}`, `weekDots(streak,today)→Array<{day,state}>`, `StreakDots({dots})` consumes that exact type, `Card({children,className?})`, `ChooserSheet({open,onClose,onPick})`, `onPick(kind:'daily'|'general')` — consistent across Tasks 2–6.

## Execution Handoff
(see below)
