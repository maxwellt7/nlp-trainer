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
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    const ua = window.navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIos(isiOS);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed || Date.now() - parseInt(dismissed) > 7 * 24 * 60 * 60 * 1000) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

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
      if (outcome === 'accepted') setShowBanner(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (isStandalone || !showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm animate-float-up">
      <div className="brand-card p-4 shadow-2xl"
        style={{
          borderColor: 'rgba(212,168,83,0.25)',
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(212, 168, 83, 0.08)',
        }}>
        <div className="flex items-start gap-3">
          <img src="/brand/app-icon.png" alt="" className="w-10 h-10 compass-glow flex-shrink-0" style={{ borderRadius: 8 }} />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white mb-0.5">Install Alignment Engine</h3>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {isIos
                ? 'Tap the share button, then "Add to Home Screen" for the full experience.'
                : 'Add to your home screen for instant access and offline support.'}
            </p>
          </div>
          <button onClick={handleDismiss} className="p-1 opacity-50 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--color-text-muted)' }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {!isIos && deferredPrompt && (
          <div className="flex gap-2 mt-3">
            <button onClick={handleDismiss}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium btn-ghost">
              Not now
            </button>
            <button onClick={handleInstall}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-bold btn-primary">
              Install App
            </button>
          </div>
        )}
        {isIos && (
          <div className="flex items-center gap-2 mt-3 px-2 py-2 rounded-lg text-xs"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-brand-border)' }}>
            <span>Tap</span>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--color-accent-gold)' }}>
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
            </svg>
            <span>then "Add to Home Screen"</span>
          </div>
        )}
      </div>
    </div>
  );
}
