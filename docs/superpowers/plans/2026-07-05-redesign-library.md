# Library Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Audios ("Library") screen as a calm recording list (*"Your recordings"*) with an immersive full-screen player, keeping play / generate / delete but tucking them away.

**Architecture:** A pure, unit-tested logic module (`libraryLogic.ts`) formats the meta line + player clock; a self-contained `Player.tsx` overlay owns the `<audio>` lifecycle; `Library.tsx` lists recordings, handles Prepare (generate+poll) and Remove (delete), and opens the Player; the `/library` + `/audios` routes are repointed and the old Audios screen deleted.

**Tech Stack:** React 19, Vite, TypeScript, Vitest. No new dependencies. Frontend-only — no backend/API changes.

## Global Constraints

- All new code under `src/pages/rd/`, reusing existing `src/components/rd/` primitives (`Screen`, `Card`). No new deps.
- Use only `--rd-*` tokens + `var(--font-display)`/`var(--font-sans)`; do NOT use or touch old `--color-brand-*`/gold tokens or Tailwind color classes. The one allowed literal is `#06121c` (= `--rd-bg`) as on-accent button/glyph foreground, matching the shipped Home/Insights/You pattern.
- No fabricated data; honest empty state; keep essentials (play, generate=`Prepare recording`, delete behind a `⋯` reveal). Dropped: voice-picker, script-text view, "loved" heart.
- Generation uses the default voice: call `audioGenerateStart(id)` with NO `voiceId`.
- `npm run build` (`tsc -b && vite build`) and `npm run test:web` (`vitest run`) must stay green.
- Data (verified): `api.listScripts()` → `{ scripts: SavedScript[] }` sorted `createdAt` DESC. `SavedScript = { id, title, duration, estimatedMinutes, script, audioFile: string|null, voiceId?, voiceLabel?, createdAt }`. `api.getAudioUrl(audioFile)` → playback URL. `api.deleteScript(id)`. `api.audioGenerateStart(id)` → `{ jobId }`; poll `api.audioGenerateStatus(jobId)` → `{ status: 'queued'|'running'|'complete'|'failed', error? }`.

---

### Task 1: `libraryLogic` — recordingMeta + formatTime

**Files:**
- Create: `src/pages/rd/libraryLogic.ts`
- Test: `src/pages/rd/libraryLogic.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `recordingMeta(createdAt: string, estimatedMinutes: number, now: Date): string` — `"<day> · <N> min"`; day = "Today" (same calendar day as `now`), "Yesterday" (prev day), else short date `"Mon D"`. Omits the `· N min` clause when `estimatedMinutes` is falsy/non-finite/≤0.
  - `formatTime(seconds: number): string` — `M:SS`; clamps NaN/negative to `"0:00"`; floors fractional seconds.

- [ ] **Step 1: Write the failing tests**

Create `src/pages/rd/libraryLogic.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { recordingMeta, formatTime } from './libraryLogic';

const NOW = new Date('2026-07-05T20:00:00');

describe('recordingMeta', () => {
  it('labels same-day as Today', () => {
    expect(recordingMeta('2026-07-05T09:00:00', 18, NOW)).toBe('Today · 18 min');
  });
  it('labels previous day as Yesterday', () => {
    expect(recordingMeta('2026-07-04T22:00:00', 16, NOW)).toBe('Yesterday · 16 min');
  });
  it('uses a short date for older recordings', () => {
    expect(recordingMeta('2026-06-30T10:00:00', 21, NOW)).toBe('Jun 30 · 21 min');
  });
  it('omits the minutes clause when estimatedMinutes is falsy', () => {
    expect(recordingMeta('2026-07-05T09:00:00', 0, NOW)).toBe('Today');
    expect(recordingMeta('2026-07-05T09:00:00', NaN, NOW)).toBe('Today');
  });
  it('rounds fractional minutes', () => {
    expect(recordingMeta('2026-07-05T09:00:00', 17.6, NOW)).toBe('Today · 18 min');
  });
});

describe('formatTime', () => {
  it('formats zero and sub-10-second values with a leading zero', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(5)).toBe('0:05');
  });
  it('formats minutes and seconds', () => {
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(600)).toBe('10:00');
  });
  it('floors fractional seconds', () => {
    expect(formatTime(65.9)).toBe('1:05');
  });
  it('clamps NaN and negatives to 0:00', () => {
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(-5)).toBe('0:00');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/nlp-trainer && npx vitest run src/pages/rd/libraryLogic.test.ts`
Expected: FAIL — `Failed to resolve import './libraryLogic'`.

- [ ] **Step 3: Write the implementation**

Create `src/pages/rd/libraryLogic.ts`:

```ts
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayLabel(createdAt: string, now: Date): string {
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return '';
  if (sameDay(d, now)) return 'Today';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function recordingMeta(createdAt: string, estimatedMinutes: number, now: Date): string {
  const day = dayLabel(createdAt, now);
  const mins = Number(estimatedMinutes);
  if (!Number.isFinite(mins) || mins <= 0) return day;
  const clause = `${Math.round(mins)} min`;
  return day ? `${day} · ${clause}` : clause;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/nlp-trainer && npx vitest run src/pages/rd/libraryLogic.test.ts`
Expected: PASS (all Task 1 cases).

- [ ] **Step 5: Commit**

```bash
cd ~/nlp-trainer && git add src/pages/rd/libraryLogic.ts src/pages/rd/libraryLogic.test.ts
git commit -m "feat: libraryLogic recordingMeta + formatTime"
```

---

### Task 2: `Player.tsx` immersive player + `orbBreathe` keyframe

**Files:**
- Create: `src/pages/rd/Player.tsx`
- Modify: `src/index.css` (append one keyframe)

**Interfaces:**
- Consumes: `formatTime` from `./libraryLogic`; `api.getAudioUrl` from `../../services/api`.
- Produces: `default` component `Player({ recording, onClose })` where `recording = { id: string; title: string; audioFile: string | null }` and `onClose: () => void`. Used by `Library.tsx` (Task 3).

- [ ] **Step 1: Add the `orbBreathe` keyframe**

Append to `src/index.css` (additive — do not modify existing keyframes; the existing `breathe` bakes in gold and must not be reused here):

```css
@keyframes orbBreathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}
```

- [ ] **Step 2: Write the Player component**

Create `src/pages/rd/Player.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { formatTime } from './libraryLogic';

type Recording = { id: string; title: string; audioFile: string | null };

export default function Player({ recording, onClose }: { recording: Recording; onClose: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = new Audio(recording.audioFile ? api.getAudioUrl(recording.audioFile) : '');
    audioRef.current = audio;
    const onTime = () => setElapsed(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || 0);
    const onEnd = () => { setPlaying(false); setElapsed(0); audio.currentTime = 0; };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnd);
      audio.removeAttribute('src');
      audioRef.current = null;
    };
  }, [recording.audioFile]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
  };

  const rewind15 = () => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = Math.max(0, audio.currentTime - 15);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
    setElapsed(audio.currentTime);
  };

  const progressPct = duration ? (elapsed / duration) * 100 : 0;
  const reduceMotion = typeof window !== 'undefined'
    && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50, background: 'var(--rd-bg)', color: 'var(--rd-ink)',
      fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'calc(env(safe-area-inset-top) + 20px) 24px calc(env(safe-area-inset-bottom) + 32px)',
    }}>
      <button onClick={onClose} aria-label="Close player" style={{
        alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--rd-muted)',
        fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: 8,
      }}>⌄</button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, width: '100%', maxWidth: 360 }}>
        <div style={{
          width: 180, height: 180, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, var(--rd-accent-bright), var(--rd-accent) 60%, var(--rd-accent-deep) 100%)',
          boxShadow: '0 0 60px var(--rd-accent-glow)',
          animation: playing && !reduceMotion ? 'orbBreathe 7s ease-in-out infinite' : 'none',
        }} />

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 8, maxWidth: 300 }}>{recording.title}</div>
          <div style={{ fontSize: 13, color: 'var(--rd-dim)' }}>{playing ? 'Breathe with the circle' : "Press play when you're settled"}</div>
        </div>

        <div style={{ width: '100%' }}>
          <div onClick={seek} style={{ height: 6, borderRadius: 999, background: 'var(--rd-border)', cursor: 'pointer', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--rd-accent-bright)', borderRadius: 999 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--rd-muted-2)' }}>
            <span>{formatTime(elapsed)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <button onClick={rewind15} aria-label="Rewind 15 seconds" style={{ background: 'none', border: 'none', color: 'var(--rd-muted)', fontSize: 14, cursor: 'pointer' }}>↺ 15</button>
          <button onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} style={{
            width: 68, height: 68, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'var(--rd-accent)', color: '#06121c', fontSize: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{playing ? '❚❚' : '▶'}</button>
          <span style={{ width: 40 }} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check + build**

Run: `cd ~/nlp-trainer && npm run build`
Expected: PASS — `tsc -b` clean, `vite build` completes. (Not yet used by any screen; this proves it compiles.)

- [ ] **Step 4: Commit**

```bash
cd ~/nlp-trainer && git add src/pages/rd/Player.tsx src/index.css
git commit -m "feat: immersive rd Player + orbBreathe keyframe"
```

---

### Task 3: `Library.tsx` recording list

**Files:**
- Create: `src/pages/rd/Library.tsx`

**Interfaces:**
- Consumes: `recordingMeta` from `./libraryLogic`; `Player` from `./Player`; `Screen`, `Card` from `../../components/rd/*`; `api.listScripts`, `api.deleteScript`, `api.audioGenerateStart`, `api.audioGenerateStatus` from `../../services/api`.
- Produces: `default` component mounted at `/library` + `/audios` in Task 4.

- [ ] **Step 1: Write the component**

Create `src/pages/rd/Library.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import Screen from '../../components/rd/Screen';
import Card from '../../components/rd/Card';
import Player from './Player';
import { recordingMeta } from './libraryLogic';

export default function Library() {
  const [scripts, setScripts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<any | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const data = await api.listScripts();
      setScripts(data?.scripts || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load your recordings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    setScripts(prev => prev.filter(s => s.id !== id));
    setMenuId(null);
    try { await api.deleteScript(id); } catch { /* already removed from view; best-effort */ }
  };

  const prepare = async (id: string) => {
    setPreparingId(id);
    setRowError(prev => { const n = { ...prev }; delete n[id]; return n; });
    let jobId: string;
    try {
      const r = await api.audioGenerateStart(id);
      jobId = r.jobId;
    } catch {
      setRowError(prev => ({ ...prev, [id]: 'Could not start. Try again.' }));
      setPreparingId(null);
      return;
    }
    let inFlight = false;
    let terminal = false;
    const tick = async (): Promise<void> => {
      if (inFlight || terminal) return;
      inFlight = true;
      try {
        const r = await api.audioGenerateStatus(jobId);
        if (terminal) return;
        if (r.status === 'complete') { terminal = true; await load(); setPreparingId(null); return; }
        if (r.status === 'failed') {
          terminal = true;
          setRowError(prev => ({ ...prev, [id]: 'Preparing failed. Try again.' }));
          setPreparingId(null);
          return;
        }
        setTimeout(tick, 4000);
      } catch {
        if (!terminal) setTimeout(tick, 7000);
      } finally {
        inFlight = false;
      }
    };
    tick();
  };

  if (loading) {
    return <Screen><div style={{ color: 'var(--rd-muted)', fontSize: 14, marginTop: 40 }}>Gathering your recordings…</div></Screen>;
  }

  if (error) {
    return (
      <Screen>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 400, margin: '0 0 8px' }}>Your recordings</h1>
        <div style={{ color: 'var(--rd-muted)', fontSize: 14, marginBottom: 18 }}>We couldn't reach your recordings just now.</div>
        <button onClick={() => window.location.reload()} style={{
          background: 'var(--rd-accent)', color: '#06121c', border: 'none', borderRadius: 999,
          padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>Try again</button>
      </Screen>
    );
  }

  const now = new Date();

  return (
    <>
      <Screen>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 400, margin: '0 0 6px' }}>Your recordings</h1>
        <div style={{ fontSize: 14, color: 'var(--rd-muted)', lineHeight: 1.55, marginBottom: 26 }}>
          Every session is yours to return to, any time.
        </div>

        {scripts.length === 0 && (
          <div style={{ fontSize: 14, color: 'var(--rd-muted)', lineHeight: 1.55 }}>
            Your sessions will appear here once you've had one.
          </div>
        )}

        {scripts.map(s => (
          <div key={s.id} style={{ marginBottom: 12 }}>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {s.audioFile ? (
                  <button onClick={() => setActive(s)} aria-label={`Play ${s.title}`} style={{
                    width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
                    background: 'radial-gradient(circle at 35% 30%, var(--rd-accent-bright), var(--rd-accent) 60%, var(--rd-accent-deep) 100%)',
                    color: '#06121c', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>▶</button>
                ) : (
                  <button onClick={() => prepare(s.id)} disabled={preparingId === s.id} style={{
                    fontSize: 12, color: 'var(--rd-muted)', background: 'var(--rd-surface)', border: '1px solid var(--rd-border)',
                    borderRadius: 999, padding: '8px 12px', cursor: preparingId === s.id ? 'default' : 'pointer', flexShrink: 0,
                  }}>{preparingId === s.id ? 'Preparing…' : 'Prepare recording'}</button>
                )}

                <div style={{ flex: 1, minWidth: 0, cursor: s.audioFile ? 'pointer' : 'default' }} onClick={() => s.audioFile && setActive(s)}>
                  <div style={{ fontSize: 15, color: 'var(--rd-ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--rd-muted-2)', marginTop: 2 }}>{recordingMeta(s.createdAt, s.estimatedMinutes, now)}</div>
                  {rowError[s.id] && <div style={{ fontSize: 12, color: 'var(--rd-danger)', marginTop: 4 }}>{rowError[s.id]}</div>}
                </div>

                <button onClick={() => setMenuId(menuId === s.id ? null : s.id)} aria-label="More options" style={{
                  background: 'none', border: 'none', color: 'var(--rd-muted-2)', fontSize: 20, cursor: 'pointer', flexShrink: 0, padding: 4,
                }}>⋯</button>
              </div>

              {menuId === s.id && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--rd-border)', textAlign: 'right' }}>
                  <button onClick={() => remove(s.id)} style={{ background: 'none', border: 'none', color: 'var(--rd-danger)', fontSize: 13, cursor: 'pointer' }}>Remove</button>
                </div>
              )}
            </Card>
          </div>
        ))}
      </Screen>

      {active && <Player recording={active} onClose={() => setActive(null)} />}
    </>
  );
}
```

- [ ] **Step 2: Type-check + build**

Run: `cd ~/nlp-trainer && npm run build`
Expected: PASS — `tsc -b` clean, `vite build` completes. (Not yet routed; this proves it compiles.)

- [ ] **Step 3: Commit**

```bash
cd ~/nlp-trainer && git add src/pages/rd/Library.tsx
git commit -m "feat: redesigned Library screen (rd)"
```

---

### Task 4: Route swap, delete old Audios screen, verify

**Files:**
- Modify: `src/App.tsx:20`
- Delete: `src/pages/Audios.tsx`

**Interfaces:**
- Consumes: `src/pages/rd/Library.tsx` (Task 3).
- Produces: `/library` and `/audios` (both route trees) render the redesigned screen; old Audios screen gone.

- [ ] **Step 1: Repoint the lazy import**

In `src/App.tsx`, change line 20 from:

```tsx
const Audios = lazy(() => import('./pages/Audios'));
```

to:

```tsx
const Audios = lazy(() => import('./pages/rd/Library'));
```

(All four routes — `/library` and `/audios` in both the authenticated and unauthenticated trees, lines ~59/60/94/95 — reference this one binding, so no other edits. Binding name `Audios` stays; only its target changes. The separate `Sessions` binding / `/sessions` route is unrelated — do not touch it.)

- [ ] **Step 2: Delete the old screen**

```bash
cd ~/nlp-trainer && git rm src/pages/Audios.tsx
```

- [ ] **Step 3: Verify no dangling references**

Run: `cd ~/nlp-trainer && grep -rn "pages/Audios" src/`
Expected: NO output.

- [ ] **Step 4: Full build + web tests**

Run: `cd ~/nlp-trainer && npm run build && npm run test:web`
Expected: both PASS — no dangling import to the deleted file; all Vitest suites (`libraryLogic`, `youLogic`, `insightsLogic`, `homeLogic`) green.

- [ ] **Step 5: Commit**

```bash
cd ~/nlp-trainer && git add src/App.tsx
git commit -m "feat: route /library + /audios to redesigned screen, remove old Audios"
```

---

## Post-plan verification (human-in-the-loop, after all tasks)

Not a task step — the operator runs these before deploy:
- Whole-branch review (requesting-code-review) → fix findings.
- Deploy: merge to `main`, then **force** `vercel --prod --yes` (git auto-deploy is flaky — see [[project-nlp-voice-feature]]). Verify the live `/assets/*.js` bundle contains `Your recordings` and that `heart.sovereignty.app` aliases the new deployment.
- On-device (iPad PWA): header + recording rows + meta lines; open player, play/pause/seek/rewind; Prepare flow on an un-generated script; Remove via `⋯`; empty/error states; Library nav highlight.

## Self-Review notes

- **Spec coverage:** spec §4 header/rows/prepare/remove/empty → Task 3 (+ `recordingMeta` Task 1); §5 immersive player → Task 2 (+ `formatTime` Task 1); §6 logic module → Task 1 with tests; §7 routing/cleanup → Task 4; §8 states → Task 3 loading/error/empty + row prepare/error + Task 2 audio cleanup; §9 testing/deploy → Task 4 + post-plan block. All covered.
- **No fabricated data:** empty state honest; meta/time derive from real fields; loved/voice/script-view intentionally dropped.
- **Type consistency:** `recordingMeta(createdAt, estimatedMinutes, now)` and `formatTime(seconds)` defined in Task 1 and consumed unchanged in Tasks 2–3; `Player({ recording, onClose })` prop shape defined in Task 2 and passed as `<Player recording={active} onClose={…}/>` in Task 3; `orbBreathe` keyframe added in Task 2 and referenced only there.
- **Token discipline:** only `--rd-*` + `#06121c` on-accent literal (per Global Constraints, matches shipped screens); the new `orbBreathe` keyframe is pure-transform (no color), so it introduces no gold.
