import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import AccountButton from './AccountButton';

// Chat runs full-bleed (it manages its own internal scroll); other screens scroll.
const FULLSCREEN_ROUTES = ['/hypnosis', '/chat'];

export default function AppShell() {
  const { pathname } = useLocation();
  const fullscreen = FULLSCREEN_ROUTES.includes(pathname);

  // iOS standalone PWAs can pan the whole layout viewport (keyboard residue
  // from the chat composer, overscroll chaining) which leaves the app shell
  // floating above a dead band at the bottom of the screen until the user
  // drags it back. Lock document-level scrolling while the shell is mounted
  // (sign-in/legal pages are outside AppShell and keep their body scroll),
  // and snap the viewport back to 0 whenever the keyboard is not open.
  useEffect(() => {
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    const keyboardOpen = () => {
      const vv = window.visualViewport;
      return !!vv && window.innerHeight - vv.height > 50;
    };
    const pin = () => {
      if (!keyboardOpen() && (window.scrollY !== 0 || (window.visualViewport?.offsetTop || 0) !== 0)) {
        window.scrollTo(0, 0);
      }
    };
    const pinSoon = () => { setTimeout(pin, 250); };

    window.visualViewport?.addEventListener('resize', pinSoon);
    window.addEventListener('focusout', pinSoon);
    return () => {
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
      window.visualViewport?.removeEventListener('resize', pinSoon);
      window.removeEventListener('focusout', pinSoon);
    };
  }, []);

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
