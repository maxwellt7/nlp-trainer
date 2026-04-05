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
  Seeker: 'var(--color-accent-slate-light)',
  Initiate: 'var(--color-accent-blue-bright)',
  Architect: 'var(--color-accent-gold)',
  Sovereign: 'var(--color-accent-gold-bright)',
  Transcendent: 'var(--color-accent-gold-bright)',
};

export default function XpPopup({ xpEvents, levelUp, onDismiss }: XpPopupProps) {
  const [visible, setVisible] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);

  const totalXp = xpEvents.reduce((sum, e) => sum + e.xpAwarded, 0);

  useEffect(() => {
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
      {levelUp && showLevelUp && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={onDismiss} />
      )}

      {/* XP gain floating text */}
      <div className="absolute top-1/3 flex flex-col items-center gap-2">
        {xpEvents.map((event, i) => (
          <div key={i} className="animate-xp-pop text-center" style={{ animationDelay: `${i * 0.3}s` }}>
            <span className="font-mono-brand text-lg font-bold" style={{ color: 'var(--color-accent-gold)' }}>
              +{event.xpAwarded} XP
            </span>
            {event.multiplier > 1 && (
              <span className="font-mono-brand text-xs ml-1" style={{ color: 'var(--color-accent-gold-bright)' }}>
                ({event.multiplier}x)
              </span>
            )}
          </div>
        ))}

        {xpEvents.length > 1 && (
          <div className="animate-xp-pop text-center mt-2" style={{ animationDelay: `${xpEvents.length * 0.3}s` }}>
            <span className="font-mono-brand text-2xl font-bold" style={{ color: 'var(--color-accent-gold-bright)' }}>
              +{totalXp} XP
            </span>
          </div>
        )}
      </div>

      {/* Level Up celebration */}
      {levelUp && showLevelUp && (
        <div className="relative pointer-events-auto animate-float-up" onClick={onDismiss}>
          <div className="absolute inset-0 animate-level-up rounded-full"
            style={{ background: `radial-gradient(circle, ${titleColors[levelUp.newTitle] || 'var(--color-accent-gold)'}40, transparent)` }} />

          <div className="brand-card p-8 text-center relative z-10" style={{ minWidth: '280px', border: '1px solid rgba(212,168,83,0.3)' }}>
            <div className="text-uppercase-spaced mb-3" style={{ color: 'var(--color-accent-gold)' }}>
              Level Up
            </div>
            <div className="font-mono-brand text-4xl font-bold mb-1" style={{ color: titleColors[levelUp.newTitle] || 'var(--color-accent-gold)' }}>
              {levelUp.newLevel}
            </div>
            <div className="text-lg font-bold mb-3" style={{ color: titleColors[levelUp.newTitle] || 'var(--color-accent-gold)' }}>
              {levelUp.newTitle}
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Your discipline is building something real. Keep going.
            </p>
            <button className="mt-4 px-6 py-2 rounded-lg text-sm font-bold btn-primary">
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
