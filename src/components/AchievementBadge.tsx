interface AchievementBadgeProps {
  achievement: {
    key: string;
    title: string;
    description: string;
    icon: string;
    unlocked: boolean;
    unlocked_at?: string | null;
  };
  compact?: boolean;
}

export default function AchievementBadge({ achievement, compact }: AchievementBadgeProps) {
  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
        achievement.unlocked ? '' : 'opacity-35 grayscale'
      }`}
        style={{
          background: achievement.unlocked ? 'var(--color-accent-gold-deep)' : 'var(--color-brand-surface)',
          border: `1px solid ${achievement.unlocked ? 'rgba(212,168,83,0.2)' : 'var(--color-brand-border)'}`,
        }}
        title={achievement.description}
      >
        <span className="text-base">{achievement.icon}</span>
        <span className="text-xs font-medium" style={{ color: achievement.unlocked ? 'var(--color-text-primary)' : 'var(--color-text-dim)' }}>
          {achievement.title}
        </span>
      </div>
    );
  }

  return (
    <div className={`brand-card p-4 transition-all ${
      achievement.unlocked ? 'glass-card-hover' : 'opacity-35 grayscale'
    }`}>
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-lg flex items-center justify-center text-xl"
          style={{
            background: achievement.unlocked ? 'var(--color-accent-gold-deep)' : 'var(--color-brand-surface)',
            border: `1px solid ${achievement.unlocked ? 'rgba(212,168,83,0.2)' : 'var(--color-brand-border)'}`,
          }}>
          {achievement.icon}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold" style={{ color: achievement.unlocked ? 'var(--color-text-primary)' : 'var(--color-text-dim)' }}>
            {achievement.title}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {achievement.description}
          </p>
          {achievement.unlocked && achievement.unlocked_at && (
            <p className="text-[10px] mt-1 font-mono-brand" style={{ color: 'var(--color-text-dim)' }}>
              {new Date(achievement.unlocked_at).toLocaleDateString()}
            </p>
          )}
        </div>
        {achievement.unlocked && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: 'var(--color-accent-gold)', color: 'var(--color-brand-midnight)' }}>
            &#10003;
          </span>
        )}
      </div>
    </div>
  );
}
