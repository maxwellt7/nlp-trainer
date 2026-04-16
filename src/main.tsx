import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.tsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const PWA_RESET_VERSION = '2026-04-16-v1'
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
