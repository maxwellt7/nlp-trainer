import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { api } from '../services/api';

const navItems = [
  { to: '/', label: 'Today', icon: '◉' },
  { to: '/hypnosis', label: 'Session', icon: '✦' },
  { to: '/sessions', label: 'History', icon: '◈' },
  { to: '/insights', label: 'Insights', icon: '◇' },
  { to: '/identity', label: 'Identity', icon: '⬡' },
  { to: '/audios', label: 'Audios', icon: '♫' },
  { to: '/learn', label: 'Learn', icon: '◈' },
  { to: '/practice', label: 'Practice', icon: '◇' },
  { to: '/reference', label: 'Reference', icon: '◆' },
];

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

  return (
    <div className="text-text-primary flex flex-col md:flex-row"
      style={{ height: '100dvh', overflow: 'hidden', background: 'var(--color-brand-midnight)' }}>
      {/* Mobile header */}
      <header className="md:hidden flex items-center justify-between px-4 py-2 border-b"
        style={{ flexShrink: 0, background: 'var(--color-brand-deep)', borderColor: 'var(--color-brand-border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-base font-bold" style={{ color: 'var(--color-accent-cyan)' }}>◉</span>
          <h1 className="text-sm font-bold text-white">Alignment Engine</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* XP Badge (mobile) */}
          {xp && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
              style={{ background: 'var(--color-accent-cyan-glow)', color: 'var(--color-accent-cyan)' }}>
              <span className="font-bold">Lv{xp.level}</span>
              <span className="text-text-muted">·</span>
              <span>{xp.title}</span>
            </div>
          )}
          {/* Unopened boxes indicator */}
          {unopenedBoxes > 0 && (
            <NavLink to="/" className="relative">
              <span className="text-lg">🎁</span>
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{ background: 'var(--color-accent-gold)', color: 'var(--color-brand-midnight)' }}>
                {unopenedBoxes}
              </span>
            </NavLink>
          )}
          <UserButton
            afterSignOutUrl="/sign-in"
            appearance={{
              elements: {
                avatarBox: { width: 28, height: 28 },
              },
            }}
          />
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Toggle menu"
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {/* Backdrop */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/60 z-30 backdrop-blur-sm" onClick={closeSidebar} />
      )}

      {/* Sidebar */}
      <nav className={`
        fixed inset-y-0 left-0 z-40 w-56 flex flex-col p-4 gap-1
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:z-auto
      `} style={{ flexShrink: 0, background: 'var(--color-brand-deep)', borderRight: '1px solid var(--color-brand-border)' }}>
        <div className="flex items-center justify-between mb-2 px-3">
          <div className="hidden md:flex items-center gap-2">
            <span className="text-lg" style={{ color: 'var(--color-accent-cyan)' }}>◉</span>
            <h1 className="text-base font-bold text-white">Alignment Engine</h1>
          </div>
          <div className="hidden md:block">
            <UserButton
              afterSignOutUrl="/sign-in"
              appearance={{
                elements: {
                  avatarBox: { width: 28, height: 28 },
                },
              }}
            />
          </div>
        </div>

        {/* XP Bar in sidebar (desktop) */}
        {xp && (
          <div className="hidden md:block px-3 mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold" style={{ color: 'var(--color-accent-cyan)' }}>
                {xp.title} · Lv{xp.level}
              </span>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {xp.total_xp} XP
              </span>
            </div>
            <div className="xp-bar-track">
              <div className="xp-bar-fill" style={{ width: `${Math.round(xp.progressToNext * 100)}%` }} />
            </div>
          </div>
        )}

        <p className="text-xs mb-3 px-3 hidden md:block" style={{ color: 'var(--color-text-dim)' }}>Daily coaching & hypnosis</p>
        <div className="flex items-center justify-between mb-6 px-3 md:hidden">
          <span className="text-lg font-bold text-white">Alignment Engine</span>
          <button onClick={closeSidebar} style={{ color: 'var(--color-text-muted)' }}>{'✕'}</button>
        </div>

        {/* Primary nav */}
        <div className="text-xs px-3 mb-1 uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>Daily</div>
        {navItems.slice(0, 6).map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={closeSidebar}
            className={({ isActive }) =>
              `px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                isActive ? 'text-white font-medium' : 'hover:text-white'
              }`
            }
            style={({ isActive }) => ({
              background: isActive ? 'linear-gradient(135deg, var(--color-accent-cyan-dim), rgba(34, 211, 238, 0.3))' : 'transparent',
              color: isActive ? 'white' : 'var(--color-text-secondary)',
            })}>
            <span className="mr-2">{item.icon}</span>{item.label}
            {item.to === '/' && unopenedBoxes > 0 && (
              <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--color-accent-gold)', color: 'var(--color-brand-midnight)' }}>
                {unopenedBoxes}
              </span>
            )}
          </NavLink>
        ))}

        {/* Secondary nav */}
        <div className="text-xs px-3 mb-1 mt-4 uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>Learn</div>
        {navItems.slice(6).map(item => (
          <NavLink key={item.to} to={item.to} onClick={closeSidebar}
            className={({ isActive }) =>
              `px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                isActive ? 'text-white font-medium' : 'hover:text-white'
              }`
            }
            style={({ isActive }) => ({
              background: isActive ? 'linear-gradient(135deg, var(--color-accent-cyan-dim), rgba(34, 211, 238, 0.3))' : 'transparent',
              color: isActive ? 'white' : 'var(--color-text-secondary)',
            })}>
            <span className="mr-2">{item.icon}</span>{item.label}
          </NavLink>
        ))}
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}
