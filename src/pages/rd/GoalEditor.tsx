import { useState } from 'react';
import { api } from '../../services/api';
import type { Goal, GoalDraft, GoalReward, GoalMilestone } from '../../services/api';
import { GOAL_CATS, draftValid, ageAtLine } from './goalsLogic';

type Draft = {
  title: string;
  description: string;
  category: string;
  targetDate: string;
  milestones: GoalMilestone[];
  rewards: GoalReward[];
};

function seed(goal: Goal | null | undefined, prefillYear?: number): Draft {
  if (goal) {
    return {
      title: goal.title, description: goal.description, category: goal.category,
      targetDate: goal.targetDate, milestones: [...goal.milestones], rewards: [...goal.rewards],
    };
  }
  return {
    title: '', description: '', category: 'Health',
    targetDate: prefillYear ? `${prefillYear}-01-01` : '',
    milestones: [], rewards: [],
  };
}

// Downscale a picked image to max 900px and re-encode as JPEG 0.78 before storing
// it as a data-URL (ported from the prototype's pickRewardImage).
function pickImage(onPicked: (dataUrl: string) => void) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.onchange = () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 900 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
        onPicked(c.toDataURL('image/jpeg', 0.78));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(f);
  };
  inp.click();
}

const LABEL: React.CSSProperties = {
  fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase',
  color: 'var(--rd-muted-2)', fontWeight: 600, marginBottom: 10,
};
const FIELD: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 16, padding: '15px 17px', color: 'var(--rd-ink)', fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
};

export default function GoalEditor({
  birthYear, goal, prefillYear, onClose, onSaved,
}: {
  birthYear: number;
  goal?: Goal | null;
  prefillYear?: number;
  onClose: () => void;
  onSaved: (saved: Goal, isNew: boolean) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => seed(goal, prefillYear));
  const [msInput, setMsInput] = useState('');
  const [saving, setSaving] = useState(false);
  const isNew = !goal;
  const valid = draftValid(draft);

  const patch = (p: Partial<Draft>) => setDraft(d => ({ ...d, ...p }));
  const updateReward = (i: number, p: Partial<GoalReward>) =>
    setDraft(d => ({ ...d, rewards: d.rewards.map((r, j) => (j === i ? { ...r, ...p } : r)) }));
  const removeReward = (i: number) =>
    setDraft(d => ({ ...d, rewards: d.rewards.filter((_, j) => j !== i) }));
  const addReward = (type: 'material' | 'experience') =>
    setDraft(d => ({ ...d, rewards: [...d.rewards, { type, name: '', image: '' }] }));
  const removeMilestone = (i: number) =>
    setDraft(d => ({ ...d, milestones: d.milestones.filter((_, j) => j !== i) }));
  const addMilestone = () => {
    const t = msInput.trim();
    if (!t) return;
    setDraft(d => ({ ...d, milestones: [...d.milestones, { text: t, done: false }] }));
    setMsInput('');
  };

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const cleanDraft: GoalDraft = {
      title: draft.title.trim(),
      description: draft.description,
      category: draft.category,
      targetDate: draft.targetDate,
      milestones: draft.milestones,
      rewards: draft.rewards.filter(r => (r.name && r.name.trim()) || r.image),
    };
    try {
      const saved = goal
        ? await api.updateGoal(goal.id, cleanDraft)
        : await api.createGoal(cleanDraft);
      onSaved(saved, isNew);
    } catch {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60, background: 'var(--rd-bg)', color: 'var(--rd-ink)',
      fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column',
      maxWidth: 440, margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'calc(max(env(safe-area-inset-top), 20px)) 22px 16px 22px',
      }}>
        <button onClick={onClose} aria-label="Close" style={{
          width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
          border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#93A6B8" strokeWidth={2} strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{isNew ? 'New goal' : 'Edit goal'}</div>
        <button onClick={save} disabled={!valid || saving} style={{
          border: 'none', borderRadius: 999, padding: '9px 20px', fontSize: 14, fontWeight: 600,
          cursor: valid && !saving ? 'pointer' : 'default',
          background: valid ? 'linear-gradient(135deg, #7FB4D9, #5A93BD)' : 'rgba(255,255,255,0.06)',
          color: valid ? '#06121C' : 'var(--rd-dim)',
          opacity: saving ? 0.6 : 1,
        }}>Save</button>
      </div>

      {/* Fields */}
      <div style={{
        flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        padding: '6px 22px calc(max(env(safe-area-inset-bottom), 20px) + 24px) 22px',
        display: 'flex', flexDirection: 'column', gap: 26,
      }}>
        <div>
          <div style={LABEL}>The goal</div>
          <input value={draft.title} onChange={e => patch({ title: e.target.value })}
            placeholder="What do you want to be true?" style={{ ...FIELD, fontSize: 16 }} />
        </div>

        <div>
          <div style={LABEL}>Why it matters</div>
          <textarea value={draft.description} onChange={e => patch({ description: e.target.value })} rows={3}
            placeholder="What will be different about your life when this is done?"
            style={{ ...FIELD, fontSize: 14.5, lineHeight: 1.55, resize: 'none' }} />
        </div>

        <div>
          <div style={LABEL}>When</div>
          <input type="date" value={draft.targetDate} onChange={e => patch({ targetDate: e.target.value })}
            style={{ ...FIELD, fontSize: 15, colorScheme: 'dark' }} />
          {ageAtLine(birthYear, draft.targetDate) && (
            <div style={{ fontSize: 12.5, color: 'var(--rd-accent-bright)', marginTop: 9 }}>
              {ageAtLine(birthYear, draft.targetDate)}
            </div>
          )}
        </div>

        <div>
          <div style={LABEL}>Life area</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {GOAL_CATS.map(c => {
              const sel = draft.category === c.name;
              return (
                <button key={c.name} onClick={() => patch({ category: c.name })} style={{
                  fontSize: 13, padding: '9px 16px', borderRadius: 999, cursor: 'pointer',
                  background: sel ? `${c.color}22` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${sel ? `${c.color}77` : 'rgba(255,255,255,0.09)'}`,
                  color: sel ? c.color : '#93A6B8', fontWeight: sel ? 600 : 400,
                }}>{c.name}</button>
              );
            })}
          </div>
        </div>

        <div>
          <div style={LABEL}>Milestones</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {draft.milestones.map((m, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '12px 16px',
              }}>
                <span style={{ flex: 1, fontSize: 14, color: 'var(--rd-ink-soft)' }}>{m.text}</span>
                <span onClick={() => removeMilestone(i)} role="button" aria-label="Remove milestone"
                  style={{ color: 'var(--rd-dim)', cursor: 'pointer', fontSize: 17, lineHeight: 1, padding: '2px 6px' }}>×</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={msInput} onChange={e => setMsInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMilestone(); } }}
                placeholder="A step along the way"
                style={{ ...FIELD, flex: 1, fontSize: 14, borderRadius: 14, padding: '12px 16px', minWidth: 0 }} />
              <button onClick={addMilestone} aria-label="Add milestone" style={{
                width: 44, height: 44, borderRadius: 14, background: 'rgba(127,180,217,0.12)',
                border: '1px solid rgba(127,180,217,0.25)', color: 'var(--rd-accent-bright)',
                fontSize: 20, cursor: 'pointer', flexShrink: 0,
              }}>+</button>
            </div>
          </div>
        </div>

        <div>
          <div style={{ ...LABEL, marginBottom: 6 }}>Rewards</div>
          <div style={{ fontSize: 12.5, color: '#7E93A6', marginBottom: 12, lineHeight: 1.5 }}>
            What you'll give yourself when this is real. Add a photo — make it vivid.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {draft.rewards.map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 13, background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 12,
              }}>
                <div onClick={() => pickImage(url => updateReward(i, { image: url }))}
                  role="button" aria-label="Add reward photo"
                  style={{
                    width: 54, height: 54, borderRadius: 14, flexShrink: 0, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    ...(r.image
                      ? { backgroundImage: `url(${r.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                      : { border: '1.5px dashed rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.03)' }),
                  }}>
                  {!r.image && (
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#7E93A6" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></svg>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input value={r.name} onChange={e => updateReward(i, { name: e.target.value })}
                    placeholder={r.type === 'material' ? "e.g. the watch you've been eyeing" : 'e.g. two weeks in Japan'}
                    style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--rd-ink)', fontSize: 14.5, fontFamily: 'var(--font-sans)', padding: '0 0 4px 0', boxSizing: 'border-box' }} />
                  <div style={{ fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, color: r.type === 'material' ? '#7FB4D9' : '#A9C6B3' }}>
                    {r.type === 'material' ? 'Material' : 'Experience'}
                  </div>
                </div>
                <span onClick={() => removeReward(i)} role="button" aria-label="Remove reward"
                  style={{ color: 'var(--rd-dim)', cursor: 'pointer', fontSize: 17, padding: '2px 6px', flexShrink: 0 }}>×</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => addReward('material')} style={{
                flex: 1, border: '1.5px dashed rgba(127,180,217,0.3)', background: 'none', borderRadius: 16,
                padding: 13, fontSize: 13, color: '#7FB4D9', cursor: 'pointer',
              }}>+ Material reward</button>
              <button onClick={() => addReward('experience')} style={{
                flex: 1, border: '1.5px dashed rgba(169,198,179,0.3)', background: 'none', borderRadius: 16,
                padding: 13, fontSize: 13, color: '#A9C6B3', cursor: 'pointer',
              }}>+ Experience</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
