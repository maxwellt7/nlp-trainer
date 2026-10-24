import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import ChooserSheet from './ChooserSheet';

const TABS = [
  { to: '/', label: 'Home', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
  { to: '/goals', label: 'Goals', icon: 'M6 21V3M6 4h11l-2.5 3.5L17 11H6' },
  { to: '/ask', label: 'Ask', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM12 8v3M12 14h.01' },
  { to: '/insights', label: 'Insights', icon: 'M4 19V10M10 19V5M16 19v-7M22 19H2' },
  { to: '/learn', label: 'Learn', icon: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z' },
  { to: '/you', label: 'You', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0' },
];

export default function BottomNav() {
  const [chooser, setChooser] = useState(false);
  const navigate = useNavigate();
  // Explicit mode params: bare /hypnosis falls back to "load most recent
  // conversation", which resurfaces a previous day's session.
  const pick = (kind: 'daily' | 'general' | 'voice') => {
    setChooser(false);
    if (kind === 'daily') navigate('/hypnosis?mode=daily');
    else if (kind === 'voice') navigate('/chat?mode=general&voice=1');
    else navigate('/chat?mode=general');
  };
  return (
    <>
      <nav style={{
        flexShrink: 0, display: 'flex', justifyContent: 'center',
        // Single bottom clearance: the pill sits flush against the safe area.
        // Stacking the inset with an extra margin left a large dead band on
        // notched phones in standalone mode.
        paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
      }}>
        <div style={{
          width: '100%', maxWidth: 440, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', alignItems: 'center',
          background: 'var(--rd-bg-deep)', border: '1px solid var(--rd-border)',
          borderRadius: 24, padding: '8px 4px', boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
        }}>
          {[TABS[0], TABS[1], TABS[2]].map(t => <Tab key={t.to} {...t} />)}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button aria-label="Start a session" onClick={() => setChooser(true)} style={{
              width: 46, height: 46, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'radial-gradient(circle at 30% 30%, var(--rd-accent-bright), var(--rd-accent-deep))',
              boxShadow: '0 0 24px var(--rd-accent-glow)',
            }} />
          </div>
          {[TABS[3], TABS[4], TABS[5]].map(t => <Tab key={t.to} {...t} />)}
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
