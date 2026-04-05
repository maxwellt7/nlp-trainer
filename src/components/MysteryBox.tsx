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

const rarityConfig: Record<string, { label: string; color: string; bg: string; glow: string; border: string }> = {
  common: {
    label: 'Common',
    color: 'var(--color-rarity-common)',
    bg: 'rgba(100, 116, 139, 0.08)',
    glow: 'rgba(100, 116, 139, 0.12)',
    border: 'rgba(100, 116, 139, 0.25)',
  },
  uncommon: {
    label: 'Uncommon',
    color: 'var(--color-rarity-uncommon)',
    bg: 'rgba(59, 130, 246, 0.08)',
    glow: 'rgba(59, 130, 246, 0.15)',
    border: 'rgba(59, 130, 246, 0.25)',
  },
  rare: {
    label: 'Rare',
    color: 'var(--color-rarity-rare)',
    bg: 'rgba(139, 92, 246, 0.08)',
    glow: 'rgba(139, 92, 246, 0.2)',
    border: 'rgba(139, 92, 246, 0.3)',
  },
  legendary: {
    label: 'Legendary',
    color: 'var(--color-rarity-legendary)',
    bg: 'rgba(212, 168, 83, 0.08)',
    glow: 'rgba(212, 168, 83, 0.25)',
    border: 'rgba(212, 168, 83, 0.35)',
  },
};

function parseRewardContent(content: string, _type: string) {
  try {
    return JSON.parse(content);
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
          border: `1px solid ${config.border}`,
          borderRadius: 'var(--radius-card)',
          padding: '14px 16px',
          boxShadow: `0 0 ${opening ? '25px' : '12px'} ${config.glow}`,
        }}
      >
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${opening ? 'animate-mystery-glow' : 'animate-breathe-subtle'}`}
            style={{ background: config.bg, border: `1px solid ${config.border}` }}>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
              style={{ color: config.color }}>
              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold" style={{ color: config.color }}>Sealed Intel</span>
              <span className="text-uppercase-spaced px-1.5 py-0.5 rounded"
                style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}`, fontSize: '0.55rem' }}>
                {config.label}
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
              {opening ? 'Decrypting...' : 'Tap to decrypt'}
            </p>
          </div>
          {!opening && (
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
              className="animate-breathe-subtle" style={{ color: config.color }}>
              <path d="M9 5l7 7-7 7" />
            </svg>
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
        border: `1px solid ${config.border}`,
        borderRadius: 'var(--radius-card)',
        padding: '16px',
        boxShadow: `0 0 20px ${config.glow}`,
      }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold" style={{ color: config.color }}>{box.reward_title}</span>
        <span className="text-uppercase-spaced px-1.5 py-0.5 rounded"
          style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}`, fontSize: '0.55rem' }}>
          {config.label}
        </span>
      </div>
      <div className="text-sm leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
        {renderRewardContent(rewardContent, box.reward_type)}
      </div>
    </div>
  );
}

function renderRewardContent(content: any, _type: string) {
  if (!content) return <p style={{ color: 'var(--color-text-muted)' }}>Content unavailable</p>;

  if (typeof content === 'string') {
    return <p className="italic" style={{ color: 'var(--color-text-secondary)' }}>{content}</p>;
  }

  if (content.text && content.author) {
    return (
      <div>
        <p className="italic mb-2" style={{ color: 'var(--color-text-secondary)' }}>"{content.text}"</p>
        <p className="text-xs text-right font-mono-brand" style={{ color: 'var(--color-text-dim)' }}>— {content.author}</p>
      </div>
    );
  }

  if (content.name && content.content) {
    return (
      <div>
        <p className="font-semibold mb-1" style={{ color: 'var(--color-accent-gold)' }}>{content.name}</p>
        <p style={{ color: 'var(--color-text-secondary)' }}>{content.content}</p>
        {content.duration && (
          <p className="text-xs mt-2 font-mono-brand" style={{ color: 'var(--color-text-dim)' }}>{content.duration}</p>
        )}
      </div>
    );
  }

  if (content.type === 'value_constellation') {
    return (
      <div>
        <p className="mb-2" style={{ color: 'var(--color-text-secondary)' }}>{content.description}</p>
        <div className="flex gap-2 flex-wrap">
          {content.values?.map((v: string, i: number) => (
            <span key={i} className="text-xs px-2 py-1 rounded font-medium"
              style={{ background: 'var(--color-accent-gold-deep)', color: 'var(--color-accent-gold)', border: '1px solid rgba(212,168,83,0.2)' }}>
              {v}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (content.type === 'masterclass') {
    return (
      <div>
        <p className="font-semibold mb-1" style={{ color: 'var(--color-accent-gold)' }}>{content.title}</p>
        <p style={{ color: 'var(--color-text-secondary)' }}>{content.content}</p>
        {content.duration && (
          <p className="text-xs mt-2 font-mono-brand" style={{ color: 'var(--color-text-dim)' }}>{content.duration}</p>
        )}
      </div>
    );
  }

  return <p style={{ color: 'var(--color-text-secondary)' }}>{JSON.stringify(content)}</p>;
}
