import type { SpectrumCluster, SpectrumData } from './goalsLogic';

// The whole-life map: lived fill, "now" needle, one dot-stack per goal year.
// Tapping anywhere jumps to that decade; clusters are real buttons for a11y.
export default function LifeSpectrum({ data, activeCategory, onJump }: {
  data: SpectrumData;
  activeCategory: string | null;
  onJump: (d0: number) => void;
}) {
  const jumpFromTrack = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(0.999, Math.max(0, (e.clientX - r.left) / r.width));
    onJump(Math.min(80, Math.floor((pct * 90) / 10) * 10));
  };
  return (
    <div>
      <div onClick={jumpFromTrack} style={{ position: 'relative', height: 56, cursor: 'pointer' }}>
        {/* track + lived fill */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 4, marginTop: -2, borderRadius: 999, background: 'rgba(255,255,255,0.07)' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${data.nowPct}%`, borderRadius: 999, background: 'linear-gradient(90deg, rgba(157,180,204,0.35), rgba(127,180,217,0.45))' }} />
        </div>
        {/* now needle */}
        <div style={{ position: 'absolute', left: `${data.nowPct}%`, top: 6, bottom: 6, width: 2, marginLeft: -1, borderRadius: 1, background: '#B3D6EC', boxShadow: '0 0 10px rgba(179,214,236,0.7)' }} />
        {/* goal clusters */}
        {data.clusters.map(c => <Cluster key={c.year} c={c} activeCategory={activeCategory} onJump={onJump} />)}
      </div>
      {/* decade ticks */}
      <div style={{ position: 'relative', height: 16 }}>
        {data.ticks.map(t => (
          <span key={t.d0} onClick={() => onJump(t.d0)} style={{
            position: 'absolute', left: `${t.pct}%`, transform: 'translateX(-4%)',
            fontSize: 10, color: 'var(--rd-dim)', cursor: 'pointer', letterSpacing: '0.04em',
          }}>{t.label}</span>
        ))}
      </div>
    </div>
  );
}

function Cluster({ c, activeCategory, onJump }: {
  c: SpectrumCluster; activeCategory: string | null; onJump: (d0: number) => void;
}) {
  const n = c.dots.length + c.extra;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onJump(c.d0); }}
      aria-label={`${n} goal${n === 1 ? '' : 's'} around ${c.year}`}
      style={{
        position: 'absolute', left: `${c.pct}%`, top: 0, bottom: 0, width: 22, marginLeft: -11,
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
      }}
    >
      {c.dots.map(d => {
        const dim = activeCategory != null && d.category !== activeCategory;
        return (
          <span key={d.goalId} style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: d.achieved ? 'var(--rd-sage)' : d.color,
            boxShadow: d.achieved ? '0 0 8px rgba(169,198,179,0.7)' : 'none',
            opacity: dim ? 0.15 : 1,
          }} />
        );
      })}
      {c.extra > 0 && <span style={{ fontSize: 9, color: 'var(--rd-muted-2)', lineHeight: 1 }}>+{c.extra}</span>}
    </button>
  );
}
