import { useEffect, useMemo, useRef, useState } from 'react';
import Screen from '../../components/rd/Screen';
import { api } from '../../services/api';
import type { Goal } from '../../services/api';
import { buildDecades, currentAge, spectrumData, GOAL_CATS, type GoalCard } from './goalsLogic';
import GoalEditor from './GoalEditor';
import GoalDetail from './GoalDetail';
import LifeSpectrum from './LifeSpectrum';

type Overlay =
  | { kind: 'editor'; id?: string; prefillYear?: number }
  | { kind: 'detail'; id: string }
  | null;

export default function Goals() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [yearInput, setYearInput] = useState('');
  const [savingYear, setSavingYear] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [flashD0, setFlashD0] = useState<number | null>(null);
  const decadeRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const didAutoScroll = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const thisYear = new Date().getFullYear();

  const load = async () => {
    try {
      const [profile, gs] = await Promise.all([api.getProfile(), api.listGoals()]);
      setBirthYear(typeof profile?.birthYear === 'number' ? profile.birthYear : null);
      setGoals(gs);
      setError(null);
    } catch {
      setError('We couldn’t load your goals. Pull to retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const reloadGoals = async () => {
    try { setGoals(await api.listGoals()); } catch { /* keep existing */ }
  };

  const goalsById = useMemo(() => Object.fromEntries(goals.map(g => [g.id, g])), [goals]);
  const decades = useMemo(
    () => (birthYear ? buildDecades(goals, birthYear, thisYear) : []),
    [goals, birthYear, thisYear],
  );
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

  // On first load with past decades above, bring "now" into view (the sticky
  // spectrum keeps the whole-life map visible above it).
  useEffect(() => {
    if (loading || birthYear == null || didAutoScroll.current) return;
    didAutoScroll.current = true;
    const now = decades.find(d => d.isNow);
    if (now && decades.some(d => d.lived)) {
      decadeRefs.current[now.d0]?.scrollIntoView({ block: 'start' });
    }
  }, [loading, birthYear, decades]);

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  // Close a detail overlay whose goal no longer exists (e.g. after delete).
  useEffect(() => {
    if (overlay?.kind === 'detail' && !goalsById[overlay.id]) setOverlay(null);
  }, [overlay, goalsById]);

  const submitYear = async () => {
    const y = parseInt(yearInput, 10);
    if (!Number.isInteger(y) || y < 1920 || y > 2015 || savingYear) return;
    setSavingYear(true);
    try {
      const res = await api.updateProfile({ birthYear: y });
      setBirthYear(typeof res?.birthYear === 'number' ? res.birthYear : y);
    } catch {
      setBirthYear(y); // optimistic; will re-sync on next load
    } finally {
      setSavingYear(false);
    }
  };

  if (loading) {
    return <Screen><div style={{ color: 'var(--rd-dim)', fontSize: 14, marginTop: 40 }}>Loading…</div></Screen>;
  }

  if (error) {
    return <Screen><div style={{ color: 'var(--rd-muted)', fontSize: 14, marginTop: 40 }}>{error}</div></Screen>;
  }

  // ── First-visit birth-year prompt ──
  if (birthYear == null) {
    const y = parseInt(yearInput, 10);
    const valid = Number.isInteger(y) && y >= 1920 && y <= 2015;
    return (
      <Screen>
        <div style={{ marginTop: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--rd-muted-2)', fontWeight: 600, marginBottom: 14 }}>
            Your 90 years
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 28, lineHeight: 1.2, margin: '0 0 10px 0' }}>
            What year were you born?
          </h1>
          <div style={{ fontSize: 14, color: '#93A6B8', lineHeight: 1.55, maxWidth: 300, margin: '0 auto 28px' }}>
            It anchors every goal to the life it belongs to.
          </div>
          <input
            type="number" inputMode="numeric" value={yearInput}
            onChange={e => setYearInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitYear(); }}
            placeholder="1992"
            style={{
              width: 160, textAlign: 'center', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: '15px 17px',
              color: 'var(--rd-ink)', fontSize: 22, fontFamily: 'var(--font-sans)', marginBottom: 24,
              boxSizing: 'border-box',
            }}
          />
          <div>
            <button onClick={submitYear} disabled={!valid || savingYear} style={{
              border: 'none', borderRadius: 999, padding: '14px 40px', fontSize: 15, fontWeight: 600,
              cursor: valid && !savingYear ? 'pointer' : 'default',
              background: valid ? 'linear-gradient(135deg, #7FB4D9, #5A93BD)' : 'rgba(255,255,255,0.06)',
              color: valid ? '#06121C' : 'var(--rd-dim)', opacity: savingYear ? 0.6 : 1,
            }}>Continue</button>
          </div>
        </div>
      </Screen>
    );
  }

  const curAge = currentAge(birthYear, thisYear);
  const goalsEmpty = goals.length === 0;

  return (
    <>
      <Screen>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 30, margin: '0 0 6px 0' }}>Your 90 years</h1>
            <div style={{ fontSize: 14, color: '#93A6B8', lineHeight: 1.55 }}>Every goal, pinned to the life it belongs to.</div>
          </div>
          <button onClick={() => setOverlay({ kind: 'editor' })} aria-label="New goal" style={{
            flexShrink: 0, width: 42, height: 42, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #7FB4D9, #5A93BD)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', boxShadow: '0 5px 20px rgba(90,147,189,0.3)', marginTop: 4,
          }}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#06121C" strokeWidth={2.4} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>

        {/* Life spectrum — sticky whole-life map. Bleeds over Screen's 20px side
            padding so the background covers edge-to-edge while chapters scroll under it. */}
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

        {goalsEmpty && (
          <div style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15, color: '#7E93A6', lineHeight: 1.6, margin: '-6px 0 26px 0' }}>
            Ninety years is longer than you think.<br />What belongs in yours?
          </div>
        )}

        {/* Chapters — all decades birth→80s; empty non-current decades collapse to one row */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {decades.map(dec => {
            const anchor = (el: HTMLDivElement | null) => { decadeRefs.current[dec.d0] = el; };
            const flashing = flashD0 === dec.d0;
            if (!dec.hasGoals && !dec.isNow) {
              return (
                <div key={dec.d0} ref={anchor} onClick={() => setOverlay({ kind: 'editor', prefillYear: dec.prefillYear })}
                  role="button" className={flashing ? 'rd-flash' : undefined}
                  style={{
                    display: 'flex', alignItems: 'baseline', gap: 10, padding: '11px 4px',
                    borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer',
                    scrollMarginTop: 150, borderRadius: 10,
                    animation: flashing ? 'rdFlash 0.9s ease' : undefined,
                  }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--rd-muted)' }}>{dec.label}</span>
                  <span style={{ fontSize: 11, color: '#5B7085' }}>{dec.years}{dec.lived ? ' · lived' : ''}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 16, color: '#6B8095' }}>+</span>
                </div>
              );
            }
            return (
              <div key={dec.d0} ref={anchor} className={flashing ? 'rd-flash' : undefined}
                style={{
                  display: 'flex', gap: 16, scrollMarginTop: 150, borderRadius: 12, marginTop: 8,
                  animation: flashing ? 'rdFlash 0.9s ease' : undefined,
                }}>
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
      </Screen>

      {/* Overlays */}
      {overlay?.kind === 'editor' && (
        <GoalEditor
          birthYear={birthYear}
          goal={overlay.id ? goalsById[overlay.id] : null}
          prefillYear={overlay.prefillYear}
          onClose={() => setOverlay(null)}
          onSaved={async (saved) => { await reloadGoals(); setOverlay({ kind: 'detail', id: saved.id }); }}
        />
      )}
      {overlay?.kind === 'detail' && goalsById[overlay.id] && (
        <GoalDetail
          goal={goalsById[overlay.id]}
          birthYear={birthYear}
          onClose={() => setOverlay(null)}
          onEdit={() => setOverlay({ kind: 'editor', id: overlay.id })}
          onChanged={reloadGoals}
          onDeleted={() => { reloadGoals(); setOverlay(null); }}
        />
      )}
    </>
  );
}

function GoalCardView({ card, onOpen }: { card: GoalCard; onOpen: () => void }) {
  return (
    <div onClick={onOpen} role="button" style={{
      position: 'relative', borderRadius: 24, overflow: 'hidden',
      border: `1px solid ${card.achieved ? 'rgba(169,198,179,0.35)' : 'rgba(255,255,255,0.08)'}`,
      background: 'rgba(255,255,255,0.035)', cursor: 'pointer',
    }}>
      {card.hasImage && (
        <>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${card.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,16,24,0.05) 0%, rgba(8,16,24,0.5) 50%, rgba(8,16,24,0.94) 100%)' }} />
          <div style={{ height: 104 }} />
        </>
      )}
      <div style={{ position: 'relative', padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: card.catColor, flexShrink: 0 }} />
          <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#93A6B8', fontWeight: 600 }}>{card.metaLine}</span>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, lineHeight: 1.25, color: 'var(--rd-ink)' }}>{card.title}</div>
        {card.rewardLine && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <div style={{ display: 'flex' }}>
              {card.thumbs.map((src, i) => (
                <div key={i} style={{ width: 26, height: 26, borderRadius: '50%', border: '2px solid #0C1622', backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center', marginLeft: i > 0 ? -9 : 0 }} />
              ))}
            </div>
            <span style={{ fontSize: 12, color: '#7E93A6' }}>{card.rewardLine}</span>
          </div>
        )}
        {card.showProgress && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: card.progressPct, background: '#A9C6B3', borderRadius: 999 }} />
            </div>
            <span style={{ fontSize: 11, color: '#A9C6B3' }}>{card.achieved ? 'achieved' : card.progressPct}</span>
          </div>
        )}
      </div>
    </div>
  );
}
