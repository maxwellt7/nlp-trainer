import { useState, useEffect } from 'react';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-xs font-medium"
      style={{
        background: 'linear-gradient(90deg, var(--color-accent-gold), #f59e0b)',
        color: 'var(--color-brand-midnight)',
      }}>
      You're offline — some features may be limited
    </div>
  );
}
