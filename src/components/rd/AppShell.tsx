import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import AccountButton from './AccountButton';

// Chat runs full-bleed (it manages its own internal scroll); other screens scroll.
const FULLSCREEN_ROUTES = ['/hypnosis', '/chat'];

export default function AppShell() {
  const { pathname } = useLocation();
  const fullscreen = FULLSCREEN_ROUTES.includes(pathname);
  return (
    <div style={{ background: 'var(--rd-bg)', height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <AccountButton />
      <div style={{ flex: 1, minHeight: 0, overflowY: fullscreen ? 'hidden' : 'auto', overscrollBehavior: 'contain' }}>
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
