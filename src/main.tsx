import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.tsx'
import { recoverFromStalePwa } from './lib/pwaRecovery'

// Vite fires `vite:preloadError` when a lazy-route chunk can't be fetched —
// typically a stale service worker serving a precache from before the latest
// deploy. Clear the SW + caches and hard-reload (loop-guarded) so the new
// assets load, instead of white-screening on the broken route.
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    void recoverFromStalePwa()
  })
}

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
// Bump this to force every client to run the one-time SW/cache reset again on
// next open (fixes clients stuck on a stale precache that white-screens a lazy
// route). 2026-07-31-v2: recover installed PWAs whose /ask chunk 404s.
const PWA_RESET_VERSION = '2026-07-31-v2'
const PWA_RESET_STORAGE_KEY = `alignment-engine:pwa-reset:${PWA_RESET_VERSION}`
const PWA_RESET_QUERY_PARAM = 'pwa-reset'

if (!PUBLISHABLE_KEY) {
  console.warn('Missing VITE_CLERK_PUBLISHABLE_KEY — auth will be disabled')
}

async function resetStaleClientCachesOnce() {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator) || !('caches' in window)) return

  try {
    if (window.localStorage.getItem(PWA_RESET_STORAGE_KEY) === 'done') {
      const currentUrl = new URL(window.location.href)
      if (currentUrl.searchParams.get(PWA_RESET_QUERY_PARAM) === PWA_RESET_VERSION) {
        currentUrl.searchParams.delete(PWA_RESET_QUERY_PARAM)
        window.history.replaceState({}, '', currentUrl.toString())
      }
      return
    }

    const registrations = await navigator.serviceWorker.getRegistrations()
    const cacheKeys = await window.caches.keys()

    if (!registrations.length && !cacheKeys.length) {
      window.localStorage.setItem(PWA_RESET_STORAGE_KEY, 'done')
      return
    }

    await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)))
    await Promise.all(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey).catch(() => false)))

    window.localStorage.setItem(PWA_RESET_STORAGE_KEY, 'done')

    const currentUrl = new URL(window.location.href)
    if (currentUrl.searchParams.get(PWA_RESET_QUERY_PARAM) !== PWA_RESET_VERSION) {
      currentUrl.searchParams.set(PWA_RESET_QUERY_PARAM, PWA_RESET_VERSION)
      window.location.replace(currentUrl.toString())
      return
    }

    currentUrl.searchParams.delete(PWA_RESET_QUERY_PARAM)
    window.history.replaceState({}, '', currentUrl.toString())
  } catch (error) {
    console.warn('Failed to reset stale PWA client caches', error)
  }
}

void resetStaleClientCachesOnce().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {PUBLISHABLE_KEY ? (
        <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
          <App />
        </ClerkProvider>
      ) : (
        <App />
      )}
    </StrictMode>,
  )
})
