import { useMemo } from 'react';

interface LivingAvatarProps {
  congruence: Record<string, number>;
  level: number;
  size?: number;
}

function getLevelVisuals(level: number) {
  if (level >= 10) return { petals: 12, rings: 4, innerGlow: '#D4A853', outerGlow: 'rgba(212, 168, 83, 0.3)' };
  if (level >= 7) return { petals: 10, rings: 3, innerGlow: '#E8C36A', outerGlow: 'rgba(232, 195, 106, 0.25)' };
  if (level >= 4) return { petals: 8, rings: 3, innerGlow: '#3B82F6', outerGlow: 'rgba(59, 130, 246, 0.2)' };
  return { petals: 6, rings: 2, innerGlow: '#94A3B8', outerGlow: 'rgba(148, 163, 184, 0.15)' };
}

export default function LivingAvatar({ congruence, level, size = 200 }: LivingAvatarProps) {
  const visuals = getLevelVisuals(level);
  const center = size / 2;
  const maxRadius = size / 2 - 10;

  const domains = Object.entries(congruence);
  const avgCongruence = domains.length > 0
    ? domains.reduce((sum, [, v]) => sum + Number(v), 0) / domains.length
    : 5;
  const symmetryScore = avgCongruence / 10;

  const paths = useMemo(() => {
    const result: string[] = [];
    for (let ring = 0; ring < visuals.rings; ring++) {
      const ringRadius = maxRadius * ((ring + 1) / visuals.rings) * 0.9;
      const petalCount = visuals.petals;
      for (let i = 0; i < petalCount; i++) {
        const angle = (i / petalCount) * Math.PI * 2 - Math.PI / 2;
        const nextAngle = ((i + 1) / petalCount) * Math.PI * 2 - Math.PI / 2;
        const midAngle = (angle + nextAngle) / 2;
        const domainIndex = i % domains.length;
        const domainValue = domains[domainIndex] ? Number(domains[domainIndex][1]) : 5;
        const petalScale = 0.3 + (domainValue / 10) * 0.7;
        const innerR = ringRadius * 0.3;
        const outerR = ringRadius * petalScale;
        const x1 = center + Math.cos(angle) * innerR;
        const y1 = center + Math.sin(angle) * innerR;
        const x2 = center + Math.cos(midAngle) * outerR;
        const y2 = center + Math.sin(midAngle) * outerR;
        const x3 = center + Math.cos(nextAngle) * innerR;
        const y3 = center + Math.sin(nextAngle) * innerR;
        const cp1x = center + Math.cos(angle + (nextAngle - angle) * 0.25) * outerR * 0.8;
        const cp1y = center + Math.sin(angle + (nextAngle - angle) * 0.25) * outerR * 0.8;
        const cp2x = center + Math.cos(angle + (nextAngle - angle) * 0.75) * outerR * 0.8;
        const cp2y = center + Math.sin(angle + (nextAngle - angle) * 0.75) * outerR * 0.8;
        result.push(`M${x1},${y1} Q${cp1x},${cp1y} ${x2},${y2} Q${cp2x},${cp2y} ${x3},${y3} Z`);
      }
    }
    return result;
  }, [congruence, level, size]);

  const radarPoints = useMemo(() => {
    if (domains.length === 0) return '';
    return domains.map(([, value], i) => {
      const angle = (i / domains.length) * Math.PI * 2 - Math.PI / 2;
      const r = maxRadius * 0.4 * (Number(value) / 10);
      return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
    }).join(' ');
  }, [congruence, size]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        className="animate-avatar-rotate"
        style={{ animationDuration: `${60 - symmetryScore * 30}s` }}
      >
        <defs>
          <radialGradient id="avatarGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={visuals.innerGlow} stopOpacity="0.3" />
            <stop offset="70%" stopColor={visuals.innerGlow} stopOpacity="0.1" />
            <stop offset="100%" stopColor={visuals.innerGlow} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={visuals.innerGlow} stopOpacity="0.8" />
            <stop offset="100%" stopColor={visuals.innerGlow} stopOpacity="0.2" />
          </radialGradient>
        </defs>

        <circle cx={center} cy={center} r={maxRadius} fill="url(#avatarGlow)" />

        {paths.map((d, i) => (
          <path
            key={i} d={d}
            fill={visuals.innerGlow}
            fillOpacity={0.05 + (i % 3) * 0.03}
            stroke={visuals.innerGlow}
            strokeOpacity={0.2 + symmetryScore * 0.3}
            strokeWidth={0.5}
            className="animate-avatar-pulse"
            style={{ animationDelay: `${(i * 0.2) % 4}s` }}
          />
        ))}

        {radarPoints && (
          <polygon
            points={radarPoints}
            fill={visuals.innerGlow}
            fillOpacity={0.1}
            stroke={visuals.innerGlow}
            strokeOpacity={0.5}
            strokeWidth={1}
          />
        )}

        <circle cx={center} cy={center} r={8 + symmetryScore * 6} fill="url(#centerGlow)" className="animate-breathe-subtle" />

        <circle cx={center} cy={center} r={maxRadius * 0.95}
          fill="none" stroke={visuals.innerGlow} strokeOpacity={0.15} strokeWidth={0.5} strokeDasharray="4 4" />
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center px-3 py-2 rounded-xl" style={{
          background: 'rgba(11, 15, 25, 0.75)',
          backdropFilter: 'blur(4px)',
        }}>
          <div className="font-mono-brand text-2xl font-bold" style={{ color: visuals.innerGlow, textShadow: `0 0 12px ${visuals.outerGlow}` }}>
            {avgCongruence.toFixed(1)}
          </div>
          <div className="text-uppercase-spaced" style={{ color: 'var(--color-text-muted)', fontSize: '0.6rem' }}>
            Congruence
          </div>
        </div>
      </div>
    </div>
  );
}
