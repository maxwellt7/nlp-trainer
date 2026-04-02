import { NavLink, Outlet, useLocation } from 'react-router-dom';

const primaryNav = [
  { to: '/', label: 'Today', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { to: '/hypnosis', label: 'Session', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { to: '/audios', label: 'Audios', icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3' },
  { to: '/identity', label: 'Identity', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
];

const secondaryNav = [
  { to: '/sessions', label: 'History' },
  { to: '/learn', label: 'Learn' },
  { to: '/practice', label: 'Practice' },
  { to: '/reference', label: 'Reference' },
];

function NavIcon({ path }: { path: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

export default function Layout() {
  const location = useLocation();
  // Hide bottom nav on the chat page for full-screen experience on mobile
  const isSessionPage = location.pathname === '/hypnosis';

  return (
    <div className="h-[100dvh] flex flex-col md:flex-row bg-gray-950 text-gray-100">
      {/* Desktop sidebar — hidden on mobile */}
      <nav className="hidden md:flex flex-col w-56 bg-gray-900 border-r border-gray-800 p-4 gap-1 shrink-0">
        <h1 className="text-lg font-bold mb-1 px-3 text-white">Alignment Engine</h1>
        <p className="text-xs text-gray-500 mb-4 px-3">Daily coaching & hypnosis</p>

        <div className="text-[10px] text-gray-600 px-3 mb-1 uppercase tracking-wider">Daily</div>
        {primaryNav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            <NavIcon path={item.icon} />
            {item.label}
          </NavLink>
        ))}

        <div className="text-[10px] text-gray-600 px-3 mb-1 mt-4 uppercase tracking-wider">More</div>
        {secondaryNav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Main content area */}
      <main className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="flex-1 overflow-auto min-h-0">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom tab bar — hidden on session page for full-screen chat */}
      {!isSessionPage && (
        <nav className="md:hidden flex items-center justify-around border-t border-gray-800 bg-gray-900/95 backdrop-blur-sm shrink-0 pb-[env(safe-area-inset-bottom,0px)]">
          {primaryNav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 px-3 min-w-[60px] transition-colors ${
                  isActive ? 'text-indigo-400' : 'text-gray-500'
                }`
              }
            >
              <NavIcon path={item.icon} />
              <span className="text-[10px]">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
