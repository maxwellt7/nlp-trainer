interface XpBarProps {
  level: number;
  title: string;
  totalXp: number;
  progressToNext: number;
  maxLevel?: boolean;
  compact?: boolean;
}

const titleColors: Record<string, string> = {
  Seeker: 'var(--color-rarity-common)',
  Initiate: 'var(--color-accent-cyan)',
  Architect: 'var(--color-accent-violet)',
  Sovereign: 'var(--color-accent-gold)',
  Transcendent: 'var(--color-accent-gold)',
};

export default function XpBar({ level, title, totalXp, progressToNext, maxLevel, compact }: XpBarProps) {
  const titleColor = titleColors[title] || 'var(--color-accent-cyan)';

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold"
          style={{ background: `${titleColor}20`, color: titleColor }}>
          Lv{level}
        </div>
        <div className="flex-1 xp-bar-track">
          <div className="xp-bar-fill" style={{ width: `${Math.round(progressToNext * 100)}%` }} />
        </div>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{totalXp} XP</span>
      </div>
    );
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
            style={{ background: `${titleColor}15`, color: titleColor, border: `1px solid ${titleColor}40` }}>
            {level}
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: titleColor }}>{title}</div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Level {level}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold" style={{ color: 'var(--color-accent-cyan)' }}>{totalXp}</div>
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total XP</div>
        </div>
      </div>

      <div className="xp-bar-track" style={{ height: '8px' }}>
        <div className="xp-bar-fill" style={{ width: `${maxLevel ? 100 : Math.round(progressToNext * 100)}%` }} />
      </div>

      <div className="flex items-center justify-between mt-1">
        <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
          {maxLevel ? 'Max Level' : `${Math.round(progressToNext * 100)}% to next level`}
        </span>
        {!maxLevel && (
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {Math.round((1 - progressToNext) * 100)}% remaining
          </span>
        )}
      </div>
    </div>
  );
}
