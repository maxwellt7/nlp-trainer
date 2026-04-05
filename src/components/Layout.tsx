import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { api } from '../services/api';

const navItems = [
  { to: '/', label: 'Command', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4', section: 'ops' },
  { to: '/hypnosis', label: 'Session', icon: 'M13 10V3L4 14h7v7l9-11h-7z', section: 'ops' },
  { to: '/sessions', label: 'History', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', section: 'ops' },
  { to: '/insights', label: 'Intel', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6 0h6m-6 0V9a2 2 0 012-2h2a2 2 0 012 2v10m6 0v-4a2 2 0 00-2-2h-2a2 2 0 00-2 2v4', section: 'ops' },
  { to: '/identity', label: 'Identity', icon: 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z', section: 'ops' },
  { to: '/audios', label: 'Audio', icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z', section: 'ops' },
  { to: '/learn', label: 'Learn', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', section: 'train' },
  { to: '/practice', label: 'Drill', icon: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', section: 'train' },
  { to: '/reference', label: 'Codex', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', section: 'train' },
];

function NavIcon({ path, size = 16 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

interface XpData {
  total_xp: number;
  level: number;
  title: string;
  progressToNext: number;
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [xp, setXp] = useState<XpData | null>(null);
  const [unopenedBoxes, setUnopenedBoxes] = useState(0);
  const closeSidebar = () => setSidebarOpen(false);

  useEffect(() => {
    async function loadGamification() {
      try {
        const data = await api.getProfile();
        if (data.xp) setXp(data.xp);
        if (data.unopenedBoxes) setUnopenedBoxes(data.unopenedBoxes);
      } catch { /* non-critical */ }
    }
    loadGamification();
  }, []);

  const opsItems = navItems.filter(i => i.section === 'ops');
  const trainItems = navItems.filter(i => i.section === 'train');

  return (
    <div className="flex flex-col md:flex-row"
      style={{ height: '100dvh', overflow: 'hidden', background: 'var(--color-brand-midnight)' }}>

      {/* ── Mobile Header ── */}
      <header className="md:hidden flex items-center justify-between px-4 py-2.5"
        style={{
          flexShrink: 0,
          background: 'var(--color-brand-deep)',
          borderBottom: '1px solid var(--color-brand-border)',
        }}>
        <div className="flex items-center gap-2.5">
          <img src="/brand/app-icon.png" alt="" className="w-7 h-7 compass-glow" style={{ borderRadius: 6 }} />
          <h1 className="text-sm font-bold text-white tracking-tight">Alignment Engine</h1>
        </div>
        <div className="flex items-center gap-2.5">
          {xp && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono-brand"
              style={{ background: 'var(--color-accent-gold-deep)', color: 'var(--color-accent-gold)', border: '1px solid rgba(212,168,83,0.2)' }}>
              <span className="font-bold">L{xp.level}</span>
              <span style={{ color: 'var(--color-text-dim)' }}>|</span>
              <span className="text-[10px]">{xp.total_xp}xp</span>
            </div>
          )}
          {unopenedBoxes > 0 && (
            <NavLink to="/" className="relative flex items-center justify-center w-7 h-7 rounded-md"
              style={{ background: 'var(--color-accent-gold-deep)', border: '1px solid rgba(212,168,83,0.2)' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                style={{ color: 'var(--color-accent-gold)' }}>
                <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[9px] font-bold flex items-center justify-center"
                style={{ background: 'var(--color-accent-gold)', color: 'var(--color-brand-midnight)' }}>
                {unopenedBoxes}
              </span>
            </NavLink>
          )}
          <UserButton afterSignOutUrl="/sign-in" appearance={{ elements: { avatarBox: { width: 26, height: 26 } } }} />
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: 'var(--color-text-muted)' }} aria-label="Toggle menu">
            {sidebarOpen ? (
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12"/></svg>
            ) : (
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            )}
          </button>
        </div>
      </header>

      {/* Backdrop */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/60 z-30 backdrop-blur-sm" onClick={closeSidebar} />
      )}

      {/* ── Sidebar ── */}
      <nav className={`
        fixed inset-y-0 left-0 z-40 w-56 flex flex-col py-4 px-3
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:z-auto
      `} style={{
        flexShrink: 0,
        background: 'var(--color-brand-deep)',
        borderRight: '1px solid var(--color-brand-border)',
      }}>
        {/* Logo */}
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="hidden md:flex items-center gap-2.5">
            <img src="/brand/app-icon.png" alt="" className="w-8 h-8 compass-glow" style={{ borderRadius: 6 }} />
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight leading-none">Alignment</h1>
              <p className="text-uppercase-spaced mt-0.5" style={{ color: 'var(--color-accent-gold)', fontSize: '0.55rem' }}>ENGINE</p>
            </div>
          </div>
          <div className="hidden md:block">
            <UserButton afterSignOutUrl="/sign-in" appearance={{ elements: { avatarBox: { width: 26, height: 26 } } }} />
          </div>
        </div>

        {/* XP Bar (desktop) */}
        {xp && (
          <div className="hidden md:block px-2 mb-4">
            <div className="p-2.5 rounded-lg" style={{ background: 'var(--color-brand-surface)', border: '1px solid var(--color-brand-border)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono-brand text-xs font-bold" style={{ color: 'var(--color-accent-gold)' }}>
                  LVL {xp.level}
                </span>
                <span className="text-[10px] font-mono-brand" style={{ color: 'var(--color-text-dim)' }}>
                  {xp.total_xp} XP
                </span>
              </div>
              <div className="xp-bar-track">
                <div className="xp-bar-fill" style={{ width: `${Math.round(xp.progressToNext * 100)}%` }} />
              </div>
              <p className="text-[10px] mt-1.5 font-medium" style={{ color: 'var(--color-text-muted)' }}>{xp.title}</p>
            </div>
          </div>
        )}

        {/* Mobile close */}
        <div className="flex items-center justify-between mb-4 px-2 md:hidden">
          <div className="flex items-center gap-2">
            <img src="/brand/app-icon.png" alt="" className="w-7 h-7 compass-glow" style={{ borderRadius: 6 }} />
            <span className="text-sm font-bold text-white">Alignment Engine</span>
          </div>
          <button onClick={closeSidebar} className="p-1" style={{ color: 'var(--color-text-muted)' }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Operations nav */}
        <div className="text-uppercase-spaced px-3 mb-2" style={{ color: 'var(--color-text-dim)' }}>Operations</div>
        {opsItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={closeSidebar}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all duration-200 ${isActive ? 'text-white font-semibold' : 'hover:text-white'}`
            }
            style={({ isActive }) => ({
              background: isActive ? 'linear-gradient(135deg, rgba(212,168,83,0.15), rgba(212,168,83,0.08))' : 'transparent',
              color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              borderLeft: isActive ? '2px solid var(--color-accent-gold)' : '2px solid transparent',
            })}>
            <NavIcon path={item.icon} />
            <span>{item.label}</span>
            {item.to === '/' && unopenedBoxes > 0 && (
              <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full font-mono-brand"
                style={{ background: 'var(--color-accent-gold)', color: 'var(--color-brand-midnight)' }}>
                {unopenedBoxes}
              </span>
            )}
          </NavLink>
        ))}

        {/* Training nav */}
        <div className="text-uppercase-spaced px-3 mb-2 mt-5" style={{ color: 'var(--color-text-dim)' }}>Training</div>
        {trainItems.map(item => (
          <NavLink key={item.to} to={item.to} onClick={closeSidebar}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all duration-200 ${isActive ? 'text-white font-semibold' : 'hover:text-white'}`
            }
            style={({ isActive }) => ({
              background: isActive ? 'linear-gradient(135deg, rgba(212,168,83,0.15), rgba(212,168,83,0.08))' : 'transparent',
              color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              borderLeft: isActive ? '2px solid var(--color-accent-gold)' : '2px solid transparent',
            })}>
            <NavIcon path={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}

        {/* Bottom section */}
        <div className="mt-auto px-2">
          <div className="gold-accent-line mb-3" />
          <p className="text-[10px] text-center" style={{ color: 'var(--color-text-dim)' }}>
            Sacred Heart Sovereignty
          </p>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}
