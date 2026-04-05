import { useEffect, useState } from 'react';

interface XpEvent {
  xpAwarded: number;
  eventType: string;
  multiplier: number;
}

interface LevelUp {
  newLevel: number;
  newTitle: string;
  previousLevel: number;
}

interface XpPopupProps {
  xpEvents: XpEvent[];
  levelUp: LevelUp | null;
  onDismiss: () => void;
}

const titleColors: Record<string, string> = {
  Seeker: 'var(--color-rarity-common)',
  Initiate: 'var(--color-accent-cyan)',
  Architect: 'var(--color-accent-violet)',
  Sovereign: 'var(--color-accent-gold)',
  Transcendent: 'var(--color-accent-gold)',
};

export default function XpPopup({ xpEvents, levelUp, onDismiss }: XpPopupProps) {
  const [visible, setVisible] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);

  const totalXp = xpEvents.reduce((sum, e) => sum + e.xpAwarded, 0);

  useEffect(() => {
    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate([30, 20, 50]);
    
    setVisible(true);
    
    if (levelUp) {
      setTimeout(() => setShowLevelUp(true), 1000);
    }

    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 500);
    }, levelUp ? 5000 : 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {/* Backdrop */}
      {levelUp && showLevelUp && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={onDismiss} />
      )}

      {/* XP gain floating text */}
      <div className="absolute top-1/3 flex flex-col items-center gap-2">
        {xpEvents.map((event, i) => (
          <div
            key={i}
            className="animate-xp-pop text-center"
            style={{ animationDelay: `${i * 0.3}s` }}
          >
            <span className="text-lg font-bold" style={{ color: 'var(--color-accent-cyan)' }}>
              +{event.xpAwarded} XP
            </span>
            {event.multiplier > 1 && (
              <span className="text-xs ml-1" style={{ color: 'var(--color-accent-gold)' }}>
                ({event.multiplier}x)
              </span>
            )}
          </div>
        ))}

        {/* Total */}
        {xpEvents.length > 1 && (
          <div className="animate-xp-pop text-center mt-2" style={{ animationDelay: `${xpEvents.length * 0.3}s` }}>
            <span className="text-2xl font-bold" style={{ color: 'var(--color-accent-gold)' }}>
              +{totalXp} XP Total
            </span>
          </div>
        )}
      </div>

      {/* Level Up celebration */}
      {levelUp && showLevelUp && (
        <div className="relative pointer-events-auto animate-float-up" onClick={onDismiss}>
          {/* Burst effect */}
          <div className="absolute inset-0 animate-level-up rounded-full"
            style={{ background: `radial-gradient(circle, ${titleColors[levelUp.newTitle] || 'var(--color-accent-cyan)'}40, transparent)` }} />

          <div className="glass-card p-8 text-center relative z-10" style={{ minWidth: '280px' }}>
            <div className="text-4xl mb-3">🎉</div>
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>
              Level Up!
            </div>
            <div className="text-3xl font-bold mb-1" style={{ color: titleColors[levelUp.newTitle] || 'var(--color-accent-cyan)' }}>
              Level {levelUp.newLevel}
            </div>
            <div className="text-lg font-semibold mb-3" style={{ color: titleColors[levelUp.newTitle] || 'var(--color-accent-cyan)' }}>
              {levelUp.newTitle}
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Your commitment to growth is paying off. Keep going.
            </p>
            <button className="mt-4 px-6 py-2 rounded-xl text-sm font-medium btn-primary">
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
