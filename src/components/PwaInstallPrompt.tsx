import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed as PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Detect iOS
    const ua = window.navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIos(isiOS);

    // Listen for the beforeinstallprompt event (Chrome/Edge/Android)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Only show if user hasn't dismissed recently
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed || Date.now() - parseInt(dismissed) > 7 * 24 * 60 * 60 * 1000) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // For iOS, show the banner after a delay if not already installed
    if (isiOS && !standalone) {
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed || Date.now() - parseInt(dismissed) > 7 * 24 * 60 * 60 * 1000) {
        setTimeout(() => setShowBanner(true), 3000);
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (isStandalone || !showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm animate-[float-up_0.4s_ease-out]">
      <div className="glass-card rounded-2xl p-4 shadow-2xl border"
        style={{
          background: 'linear-gradient(135deg, var(--color-brand-deep), var(--color-brand-charcoal))',
          borderColor: 'var(--color-accent-cyan-dim)',
          boxShadow: '0 0 30px rgba(34, 211, 238, 0.15)',
        }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--color-accent-cyan-glow)' }}>
            <span className="text-xl">◉</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white mb-0.5">Install Alignment Engine</h3>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {isIos
                ? 'Tap the share button, then "Add to Home Screen" for the full app experience.'
                : 'Add to your home screen for instant access and offline support.'}
            </p>
          </div>
          <button onClick={handleDismiss} className="text-sm p-1 opacity-50 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--color-text-muted)' }}>
            ✕
          </button>
        </div>
        {!isIos && deferredPrompt && (
          <div className="flex gap-2 mt-3">
            <button onClick={handleDismiss}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
              style={{ color: 'var(--color-text-muted)', background: 'rgba(255,255,255,0.05)' }}>
              Not now
            </button>
            <button onClick={handleInstall}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all"
              style={{
                background: 'linear-gradient(135deg, var(--color-accent-cyan), var(--color-accent-cyan-bright))',
                color: 'var(--color-brand-midnight)',
              }}>
              Install App
            </button>
          </div>
        )}
        {isIos && (
          <div className="flex items-center gap-2 mt-3 px-2 py-2 rounded-lg text-xs"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-secondary)' }}>
            <span>Tap</span>
            <span className="text-base">⎋</span>
            <span>then "Add to Home Screen"</span>
          </div>
        )}
      </div>
    </div>
  );
}
