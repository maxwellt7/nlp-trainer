import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

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

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col md:flex-row">
      {/* Mobile header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <h1 className="text-lg font-bold text-white">Alignment Engine</h1>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          aria-label="Toggle menu"
        >
          {sidebarOpen ? '✕' : '☰'}
        </button>
      </header>

      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <nav className={`
        fixed inset-y-0 left-0 z-40 w-56 bg-gray-900 border-r border-gray-800 flex flex-col p-4 gap-1 shrink-0
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:z-auto
      `}>
        <h1 className="text-lg font-bold mb-2 px-3 text-white hidden md:block">Alignment Engine</h1>
        <p className="text-xs text-gray-500 mb-4 px-3 hidden md:block">Daily coaching & hypnosis</p>
        <div className="flex items-center justify-between mb-6 px-3 md:hidden">
          <span className="text-lg font-bold text-white">Alignment Engine</span>
          <button onClick={closeSidebar} className="text-gray-400 hover:text-white">{'✕'}</button>
        </div>

        {/* Primary nav */}
        <div className="text-xs text-gray-600 px-3 mb-1 uppercase tracking-wider">Daily</div>
        {navItems.slice(0, 6).map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={closeSidebar}
            className={({ isActive }) =>
              `px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            <span className="mr-2">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        {/* Secondary nav */}
        <div className="text-xs text-gray-600 px-3 mb-1 mt-4 uppercase tracking-wider">Learn</div>
        {navItems.slice(6).map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={closeSidebar}
            className={({ isActive }) =>
              `px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            <span className="mr-2">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-h-0">
        <Outlet />
      </main>
    </div>
  );
}
