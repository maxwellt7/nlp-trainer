import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import ChooserSheet from './ChooserSheet';

const TABS = [
  { to: '/', label: 'Home', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
  { to: '/goals', label: 'Goals', icon: 'M6 21V3M6 4h11l-2.5 3.5L17 11H6' },
  { to: '/insights', label: 'Insights', icon: 'M4 19V10M10 19V5M16 19v-7M22 19H2' },
  { to: '/library', label: 'Library', icon: 'M4 5h16v14H4zM8 5v14' },
  { to: '/you', label: 'You', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0' },
];

export default function BottomNav() {
  const [chooser, setChooser] = useState(false);
  const navigate = useNavigate();
  const pick = (kind: 'daily' | 'general') => { setChooser(false); navigate(kind === 'daily' ? '/hypnosis' : '/chat'); };
  return (
    <>
      <nav style={{
        flexShrink: 0, display: 'flex', justifyContent: 'center',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <div style={{
          width: '100%', maxWidth: 440, margin: '0 auto 12px',
          display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', alignItems: 'center',
          background: 'var(--rd-bg-deep)', border: '1px solid var(--rd-border)',
          borderRadius: 24, padding: '8px 4px', boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
        }}>
          {[TABS[0], TABS[1]].map(t => <Tab key={t.to} {...t} />)}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button aria-label="Start a session" onClick={() => setChooser(true)} style={{
              width: 46, height: 46, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'radial-gradient(circle at 30% 30%, var(--rd-accent-bright), var(--rd-accent-deep))',
              boxShadow: '0 0 24px var(--rd-accent-glow)',
            }} />
          </div>
          {[TABS[2], TABS[3], TABS[4]].map(t => <Tab key={t.to} {...t} />)}
        </div>
      </nav>
      <ChooserSheet open={chooser} onClose={() => setChooser(false)} onPick={pick} />
    </>
  );
}

function Tab({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink to={to} end={to === '/'} style={({ isActive }) => ({
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      fontSize: 10, textDecoration: 'none',
      color: isActive ? 'var(--rd-ink)' : 'var(--rd-dim)',
    })}>
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
      <span>{label}</span>
    </NavLink>
  );
}
