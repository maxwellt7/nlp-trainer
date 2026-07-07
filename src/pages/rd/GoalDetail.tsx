import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { Goal } from '../../services/api';
import { catColor } from './goalsLogic';

const LABEL_UPPER: React.CSSProperties = {
  fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase',
  color: 'var(--rd-muted-2)', fontWeight: 600,
};

export default function GoalDetail({
  goal: initialGoal, birthYear, onClose, onEdit, onChanged, onDeleted,
}: {
  goal: Goal;
  birthYear: number;
  onClose: () => void;
  onEdit: () => void;
  onChanged: (g: Goal) => void;
  onDeleted: () => void;
}) {
  const [goal, setGoal] = useState<Goal>(initialGoal);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  // Re-sync from the parent when it hands us a refreshed goal (e.g. after an
  // edit round-trip), so the detail never shows stale pre-edit content.
  useEffect(() => { setGoal(initialGoal); }, [initialGoal]);

  const heroImg = (goal.rewards.find(r => r.image) || { image: '' }).image;
  const hasHero = !!heroImg;
  const year = parseInt((goal.targetDate || '').slice(0, 4)) || new Date().getFullYear();
  const age = year - birthYear;
  const total = goal.milestones.length;
  const done = goal.milestones.filter(m => m.done).length;
  const prog = goal.completed ? 100 : (total ? Math.round((done / total) * 100) : 0);

  const commit = async (patch: Parameters<typeof api.updateGoal>[1], optimistic: Goal) => {
    setGoal(optimistic);
    try {
      const saved = await api.updateGoal(goal.id, patch);
      setGoal(saved);
      onChanged(saved);
    } catch {
      setGoal(goal); // revert
    }
  };

  const toggleMilestone = (i: number) => {
    const milestones = goal.milestones.map((m, j) => (j === i ? { ...m, done: !m.done } : m));
    commit({ milestones }, { ...goal, milestones });
  };

  const toggleAchieved = () => {
    const completed = !goal.completed;
    commit({ completed }, { ...goal, completed });
  };

  const onDelete = async () => {
    if (!deleteArmed) { setDeleteArmed(true); return; }
    if (busy) return;
    setBusy(true);
    try {
      await api.deleteGoal(goal.id);
      onDeleted();
    } catch {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60, background: 'var(--rd-bg)', color: 'var(--rd-ink)',
      fontFamily: 'var(--font-sans)', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      maxWidth: 440, margin: '0 auto',
    }}>
      <div style={{ position: 'relative' }}>
        {hasHero ? (
          <>
            <div style={{
              height: 300, backgroundImage: `url(${heroImg})`, backgroundSize: 'cover', backgroundPosition: 'center',
              position: 'relative',
            }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,16,24,0.3) 0%, rgba(8,16,24,0) 35%, rgba(8,16,24,0.45) 70%, #06121c 100%)' }} />
            </div>
            {/* Controls overlaid on the hero */}
            <div style={{
              position: 'absolute', top: 'max(env(safe-area-inset-top), 18px)', left: 18, right: 18,
              display: 'flex', justifyContent: 'space-between', zIndex: 2,
            }}>
              <button onClick={onClose} aria-label="Back" style={ctrlBtn}><BackIcon /></button>
              <button onClick={onEdit} aria-label="Edit goal" style={ctrlBtn}><EditIcon /></button>
            </div>
          </>
        ) : (
          /* No hero: controls in normal flow so they never overlap the title */
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            padding: 'calc(max(env(safe-area-inset-top), 18px) + 6px) 18px 8px 18px',
          }}>
            <button onClick={onClose} aria-label="Back" style={ctrlBtn}><BackIcon /></button>
            <button onClick={onEdit} aria-label="Edit goal" style={ctrlBtn}><EditIcon /></button>
          </div>
        )}

        {/* Content */}
        <div style={{
          position: 'relative',
          padding: '0 24px calc(env(safe-area-inset-bottom) + 40px) 24px',
          marginTop: hasHero ? -76 : 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: catColor(goal.category) }} />
            <span style={{ fontSize: 11.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#93A6B8', fontWeight: 600 }}>
              {year} · age {age} · {goal.category}
            </span>
            {goal.completed && (
              <span style={{ fontSize: 11, color: '#A9C6B3', background: 'rgba(169,198,179,0.12)', padding: '3px 10px', borderRadius: 999 }}>achieved</span>
            )}
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 30, lineHeight: 1.15, margin: '0 0 12px 0' }}>{goal.title}</h1>

          {goal.description && (
            <div style={{ fontSize: 14.5, color: '#93A6B8', lineHeight: 1.6, marginBottom: 24 }}>{goal.description}</div>
          )}

          {total > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 22, padding: 20, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <span style={LABEL_UPPER}>Progress</span>
                <span style={{ fontSize: 12.5, color: '#A9C6B3' }}>{done} of {total}</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ height: '100%', width: `${prog}%`, background: 'linear-gradient(90deg, #A9C6B3, #7FB4D9)', borderRadius: 999, transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {goal.milestones.map((m, i) => (
                  <div key={i} onClick={() => toggleMilestone(i)} role="button" aria-pressed={m.done}
                    style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '10px 4px', cursor: 'pointer' }}>
                    <div style={m.done
                      ? { width: 22, height: 22, borderRadius: '50%', background: '#A9C6B3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
                      : { width: 22, height: 22, borderRadius: '50%', border: '1.5px solid rgba(157,180,204,0.4)', flexShrink: 0 }}>
                      {m.done && (
                        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#06121C" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                      )}
                    </div>
                    <span style={{ fontSize: 14, lineHeight: 1.4, color: m.done ? '#5B7085' : '#D3DEE8' }}>{m.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {goal.rewards.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <div style={{ ...LABEL_UPPER, marginBottom: 12 }}>Waiting for you</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {goal.rewards.map((r, i) => {
                  const isMaterial = r.type === 'material';
                  const name = (r.name && r.name.trim()) || (isMaterial ? 'Something material' : 'An experience');
                  return (
                    <div key={i} style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
                      <div style={r.image
                        ? { height: 128, backgroundImage: `url(${r.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                        : { height: 128, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(145deg, rgba(127,180,217,0.1), rgba(62,106,140,0.06))' }}>
                        {!r.image && isMaterial && (
                          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#7FB4D9" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v9" /></svg>
                        )}
                        {!r.image && !isMaterial && (
                          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#A9C6B3" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 4.5-4.5 2 2-4.5z" /></svg>
                        )}
                      </div>
                      <div style={{ padding: '12px 14px 13px 14px' }}>
                        <div style={{ fontSize: 14, color: 'var(--rd-ink)', lineHeight: 1.35, marginBottom: 4 }}>{name}</div>
                        <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, color: isMaterial ? '#7FB4D9' : '#A9C6B3' }}>
                          {isMaterial ? 'Material' : 'Experience'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button onClick={toggleAchieved} style={goal.completed
            ? { width: '100%', border: '1px solid rgba(169,198,179,0.5)', background: 'none', color: '#A9C6B3', borderRadius: 999, padding: '15px', fontSize: 15, fontWeight: 500, cursor: 'pointer' }
            : { width: '100%', border: 'none', background: 'linear-gradient(135deg, #A9C6B3, #7FA98B)', color: '#06121C', borderRadius: 999, padding: '15px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            {goal.completed ? 'Achieved — tap to undo' : 'Mark as achieved'}
          </button>

          <div onClick={onDelete} role="button"
            style={{ textAlign: 'center', marginTop: 22, fontSize: 13, cursor: 'pointer', color: deleteArmed ? '#C98A8A' : '#7E93A6' }}>
            {deleteArmed ? 'Tap again to delete forever' : 'Delete this goal'}
          </div>
        </div>
      </div>
    </div>
  );
}

function BackIcon() {
  return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#EAF0F4" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>;
}
function EditIcon() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#EAF0F4" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>;
}

const ctrlBtn: React.CSSProperties = {
  width: 36, height: 36, borderRadius: '50%', background: 'rgba(8,16,24,0.55)',
  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};
