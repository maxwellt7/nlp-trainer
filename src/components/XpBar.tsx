interface XpBarProps {
  level: number;
  title: string;
  totalXp: number;
  progressToNext: number;
  maxLevel?: boolean;
  compact?: boolean;
}

const titleColors: Record<string, string> = {
  Seeker: 'var(--color-accent-slate-light)',
  Initiate: 'var(--color-accent-blue-bright)',
  Architect: 'var(--color-accent-gold)',
  Sovereign: 'var(--color-accent-gold-bright)',
  Transcendent: 'var(--color-accent-gold-bright)',
};

export default function XpBar({ level, title, totalXp, progressToNext, maxLevel, compact }: XpBarProps) {
  const titleColor = titleColors[title] || 'var(--color-accent-gold)';
  const pct = maxLevel ? 100 : Math.round(progressToNext * 100);
  // Ensure at least 3% visible fill so the bar never looks completely empty
  const fillWidth = maxLevel ? 100 : Math.max(pct, totalXp > 0 ? 3 : 0);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono-brand font-bold"
          style={{ background: 'var(--color-accent-gold-deep)', color: 'var(--color-accent-gold)', border: '1px solid rgba(212,168,83,0.2)' }}>
          L{level}
        </div>
        <div className="flex-1 xp-bar-track">
          <div className="xp-bar-fill" style={{ width: `${fillWidth}%` }} />
        </div>
        <span className="font-mono-brand text-[10px]" style={{ color: 'var(--color-text-dim)' }}>{totalXp}xp</span>
      </div>
    );
  }

  return (
    <div className="brand-card p-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center font-mono-brand text-base font-bold"
            style={{
              background: 'linear-gradient(135deg, var(--color-accent-gold-deep), rgba(212,168,83,0.15))',
              color: 'var(--color-accent-gold)',
              border: '1px solid rgba(212,168,83,0.25)',
            }}>
            {level}
          </div>
          <div>
            <div className="text-sm font-bold" style={{ color: titleColor }}>{title}</div>
            <div className="font-mono-brand text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              {totalXp} XP {maxLevel ? '· MAX LEVEL' : ''}
            </div>
          </div>
        </div>
        <div className="font-mono-brand text-sm font-bold" style={{ color: 'var(--color-accent-gold)' }}>
          {maxLevel ? 'MAX' : `${pct}%`}
        </div>
      </div>

      <div className="xp-bar-track">
        <div className="xp-bar-fill" style={{ width: `${fillWidth}%` }} />
      </div>

      <div className="mt-2">
        <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-dim)' }}>
          {maxLevel
            ? 'Maximum level reached'
            : totalXp === 0
              ? 'Complete a session to earn XP'
              : `${pct}% to next level`}
        </span>
      </div>
    </div>
  );
}
