import { weekDots } from '../../pages/rd/homeLogic';

type Dots = ReturnType<typeof weekDots>;

export default function StreakDots({ dots }: { dots: Dots }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      {dots.map((d, i) => (
        <div key={i} style={{ textAlign: 'center', flex: 1 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', margin: '0 auto 6px',
            background: d.state === 'filled' ? 'var(--rd-sage)' : 'transparent',
            border: d.state === 'today' ? '1px solid var(--rd-accent-bright)'
                   : d.state === 'filled' ? 'none' : '1px solid var(--rd-dim)',
          }} />
          <div style={{ fontSize: 11, color: d.state === 'today' ? 'var(--rd-ink)' : 'var(--rd-dim)' }}>{d.day}</div>
        </div>
      ))}
    </div>
  );
}
