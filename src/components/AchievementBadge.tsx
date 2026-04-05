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
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
        achievement.unlocked ? '' : 'opacity-40 grayscale'
      }`}
        style={{
          background: achievement.unlocked ? 'var(--color-accent-cyan-glow)' : 'var(--color-brand-surface)',
          border: `1px solid ${achievement.unlocked ? 'var(--color-accent-cyan)' : 'var(--color-brand-border)'}`,
        }}
        title={achievement.description}
      >
        <span className="text-lg">{achievement.icon}</span>
        <span className="text-xs font-medium" style={{ color: achievement.unlocked ? 'var(--color-text-primary)' : 'var(--color-text-dim)' }}>
          {achievement.title}
        </span>
      </div>
    );
  }

  return (
    <div className={`glass-card p-4 transition-all ${
      achievement.unlocked ? 'glass-card-hover' : 'opacity-40 grayscale'
    }`}>
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{
            background: achievement.unlocked ? 'var(--color-accent-cyan-glow)' : 'var(--color-brand-surface)',
            border: `1px solid ${achievement.unlocked ? 'var(--color-accent-cyan)' : 'var(--color-brand-border)'}`,
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
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-dim)' }}>
              Unlocked {new Date(achievement.unlocked_at).toLocaleDateString()}
            </p>
          )}
        </div>
        {achievement.unlocked && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: 'var(--color-status-success)', color: 'var(--color-brand-midnight)' }}>
            ✓
          </span>
        )}
      </div>
    </div>
  );
}
