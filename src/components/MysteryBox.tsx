import { useState } from 'react';
import { api } from '../services/api';

interface MysteryBoxProps {
  box: {
    id: string;
    rarity: string;
    reward_type: string;
    reward_title: string;
    reward_content?: string | null;
    opened?: number;
    created_at: string;
  };
  onOpened?: (box: any) => void;
}

const rarityConfig: Record<string, { label: string; color: string; bg: string; glow: string; icon: string }> = {
  common: {
    label: 'Common',
    color: 'var(--color-rarity-common)',
    bg: 'rgba(148, 163, 184, 0.1)',
    glow: 'rgba(148, 163, 184, 0.15)',
    icon: '✧',
  },
  uncommon: {
    label: 'Uncommon',
    color: 'var(--color-rarity-uncommon)',
    bg: 'rgba(34, 211, 238, 0.1)',
    glow: 'rgba(34, 211, 238, 0.2)',
    icon: '✦',
  },
  rare: {
    label: 'Rare',
    color: 'var(--color-rarity-rare)',
    bg: 'rgba(167, 139, 250, 0.1)',
    glow: 'rgba(167, 139, 250, 0.25)',
    icon: '◆',
  },
  legendary: {
    label: 'Legendary',
    color: 'var(--color-rarity-legendary)',
    bg: 'rgba(251, 191, 36, 0.1)',
    glow: 'rgba(251, 191, 36, 0.3)',
    icon: '★',
  },
};

function parseRewardContent(content: string, type: string) {
  try {
    const parsed = JSON.parse(content);
    return parsed;
  } catch {
    return content;
  }
}

export default function MysteryBox({ box, onOpened }: MysteryBoxProps) {
  const [opening, setOpening] = useState(false);
  const [revealed, setRevealed] = useState(!!box.opened);
  const [rewardContent, setRewardContent] = useState<any>(box.reward_content ? parseRewardContent(box.reward_content, box.reward_type) : null);

  const config = rarityConfig[box.rarity] || rarityConfig.common;

  const handleOpen = async () => {
    if (opening || revealed) return;
    setOpening(true);

    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(50);

    try {
      const result = await api.openMysteryBox(box.id);
      setTimeout(() => {
        setRevealed(true);
        setRewardContent(parseRewardContent(result.reward_content, result.reward_type));
        if (navigator.vibrate) navigator.vibrate([30, 50, 100]);
        onOpened?.(result);
      }, 800);
    } catch {
      setOpening(false);
    }
  };

  // Sealed state
  if (!revealed) {
    return (
      <button
        onClick={handleOpen}
        disabled={opening}
        className={`w-full text-left transition-all duration-300 haptic-tap ${opening ? 'animate-mystery-glow' : ''}`}
        style={{
          background: config.bg,
          border: `1px solid ${config.color}`,
          borderRadius: 'var(--radius-card)',
          padding: '16px',
          boxShadow: `0 0 ${opening ? '30px' : '15px'} ${config.glow}`,
        }}
      >
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${opening ? 'animate-mystery-glow' : 'animate-breathe-subtle'}`}
            style={{ background: config.bg, border: `1px solid ${config.color}` }}>
            {opening ? '✨' : '🔮'}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold" style={{ color: config.color }}>
                Sealed Insight
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: config.bg, color: config.color, border: `1px solid ${config.color}` }}>
                {config.icon} {config.label}
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {opening ? 'Revealing your insight...' : 'Tap to reveal your reward'}
            </p>
          </div>
          {!opening && (
            <span className="text-2xl animate-breathe-subtle">🎁</span>
          )}
        </div>
      </button>
    );
  }

  // Revealed state
  return (
    <div className="animate-float-up"
      style={{
        background: config.bg,
        border: `1px solid ${config.color}`,
        borderRadius: 'var(--radius-card)',
        padding: '16px',
        boxShadow: `0 0 20px ${config.glow}`,
      }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{config.icon}</span>
        <span className="text-sm font-semibold" style={{ color: config.color }}>
          {box.reward_title}
        </span>
        <span className="text-xs px-1.5 py-0.5 rounded-full"
          style={{ background: config.bg, color: config.color, border: `1px solid ${config.color}` }}>
          {config.label}
        </span>
      </div>

      <div className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
        {renderRewardContent(rewardContent, box.reward_type)}
      </div>
    </div>
  );
}

function renderRewardContent(content: any, type: string) {
  if (!content) return <p style={{ color: 'var(--color-text-muted)' }}>Content unavailable</p>;

  // String content (affirmation, reflection, deep_pattern, breakthrough)
  if (typeof content === 'string') {
    return <p className="italic">{content}</p>;
  }

  // Quote object
  if (content.text && content.author) {
    return (
      <div>
        <p className="italic mb-2">"{content.text}"</p>
        <p className="text-xs text-right" style={{ color: 'var(--color-text-muted)' }}>— {content.author}</p>
      </div>
    );
  }

  // Micro-framework
  if (content.name && content.content) {
    return (
      <div>
        <p className="font-semibold mb-1" style={{ color: 'var(--color-accent-cyan)' }}>{content.name}</p>
        <p>{content.content}</p>
        {content.duration && (
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>{content.duration}</p>
        )}
      </div>
    );
  }

  // Value constellation
  if (content.type === 'value_constellation') {
    return (
      <div>
        <p className="mb-2">{content.description}</p>
        <div className="flex gap-2 flex-wrap">
          {content.values?.map((v: string, i: number) => (
            <span key={i} className="text-xs px-2 py-1 rounded-full"
              style={{ background: 'var(--color-accent-violet-glow)', color: 'var(--color-accent-violet)' }}>
              {v}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // Masterclass
  if (content.type === 'masterclass') {
    return (
      <div>
        <p className="font-semibold mb-1" style={{ color: 'var(--color-accent-gold)' }}>{content.title}</p>
        <p>{content.content}</p>
        {content.duration && (
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>{content.duration}</p>
        )}
      </div>
    );
  }

  // Fallback
  return <p>{JSON.stringify(content)}</p>;
}
