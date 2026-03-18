import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '\u25C9' },
  { to: '/learn', label: 'Learn', icon: '\u25C8' },
  { to: '/practice', label: 'Practice', icon: '\u25C7' },
  { to: '/hypnosis', label: 'Hypnosis', icon: '\u2726' },
  { to: '/reference', label: 'Reference', icon: '\u25C6' },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex">
      <nav className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col p-4 gap-1 shrink-0">
        <h1 className="text-lg font-bold mb-6 px-3 text-white">NLP Trainer</h1>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
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
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
