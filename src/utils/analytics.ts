/**
 * Frontend analytics tracking — sends events and page views to the backend
 * for the admin dashboard.
 */

const BASE = (import.meta.env.VITE_API_URL || '') + '/api';

export async function trackEvent(eventType: string, metadata?: Record<string, any>) {
  try {
    await fetch(`${BASE}/analytics/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType,
        userId: metadata?.userId,
        email: metadata?.email,
        metadata,
      }),
    });
  } catch {
    // Silent fail
  }
}

export async function trackPageView(path?: string) {
  try {
    await fetch(`${BASE}/analytics/pageview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: path || window.location.pathname,
        referrer: document.referrer || undefined,
        userAgent: navigator.userAgent,
      }),
    });
  } catch {
    // Silent fail
  }
}
