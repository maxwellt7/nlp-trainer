const RELOAD_KEY = 'alignment-engine:pwa-recover-ts';
const COOLDOWN_MS = 30_000;

// Clear the service worker + all caches, then hard-reload — at most once per
// cooldown (loop-guarded). Recovers from a stale PWA precache that serves
// dynamic-import chunk hashes which no longer exist after a deploy; without
// this, tapping the affected lazy route white-screens on the installed app.
export async function recoverFromStalePwa({ force = false } = {}): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  // Automatic recovery is loop-guarded; a user-initiated retry (force) is not.
  if (!force) {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < COOLDOWN_MS) return false;
  }
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
    }
  } catch {
    // Best effort — reload regardless so the browser refetches from network.
  }
  window.location.reload();
  return true;
}
