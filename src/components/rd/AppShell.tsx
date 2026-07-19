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
  // iOS standalone gets stuck in a WebKit state where the layout viewport
  // excludes the top safe area but takes it off the BOTTOM: on-device
  // diagnostics showed screen 874 / innerHeight 812 / dvh 812 / safeTop 62 —
  // innerHeight and dvh both report the shrunken value, which left a 62pt
  // dead band under the nav. Only the large-viewport unit (100lvh) still
  // reports the true span, so in standalone we size the shell to the largest
  // of innerHeight and lvh. In a normal browser tab lvh extends under the
  // browser chrome, so there we keep innerHeight.
  useEffect(() => {
    const root = document.documentElement;
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100lvh;visibility:hidden;pointer-events:none;';
    document.body.appendChild(probe);
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as { standalone?: boolean }).standalone === true;
    const setH = () => {
      const lvh = probe.getBoundingClientRect().height;
      const h = standalone ? Math.max(window.innerHeight, lvh) : window.innerHeight;
      root.style.setProperty('--app-height', `${h}px`);
    };
    setH();
    window.addEventListener('resize', setH);
    window.addEventListener('orientationchange', setH);
    return () => {
      probe.remove();
      window.removeEventListener('resize', setH);
      window.removeEventListener('orientationchange', setH);
      root.style.removeProperty('--app-height');
    };
  }, []);

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
    <div style={{ background: 'var(--rd-bg)', height: 'var(--app-height, 100dvh)', display: 'flex', flexDirection: 'column' }}>
      <AccountButton />
      <div style={{ flex: 1, minHeight: 0, overflowY: fullscreen ? 'hidden' : 'auto', overscrollBehavior: 'contain' }}>
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
