import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

export default function AppShell() {
  return (
    <div style={{ background: 'var(--rd-bg)', minHeight: '100dvh' }}>
      <Outlet />
      <BottomNav />
    </div>
  );
}
