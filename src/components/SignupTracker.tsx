import { useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { trackCompleteRegistration, sendServerEvent } from '../utils/pixel';

const STORAGE_KEY = 'ae_signup_tracked';

/**
 * Fires Meta Pixel CompleteRegistration + CAPI event once
 * when a brand-new Clerk user first lands in the authenticated app.
 *
 * Detection: Clerk user.createdAt within last 2 minutes + not already tracked in localStorage.
 * This covers the signup → redirect → dashboard flow reliably.
 */
export default function SignupTracker() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || !user) return;

    // Already tracked this user on this device
    if (localStorage.getItem(STORAGE_KEY) === user.id) return;

    const createdAt = user.createdAt ? new Date(user.createdAt).getTime() : 0;
    const now = Date.now();
    const twoMinutes = 2 * 60 * 1000;

    if (now - createdAt < twoMinutes) {
      // New signup — fire events
      trackCompleteRegistration({
        content_name: 'Clerk Signup',
        status: 'complete',
        value: 0,
        currency: 'USD',
      });

      sendServerEvent('CompleteRegistration', {
        email: user.primaryEmailAddress?.emailAddress,
        sourceUrl: window.location.href,
      });

      console.log('[Pixel] CompleteRegistration fired for new signup:', user.id);
    }

    // Mark as tracked regardless (so returning users never re-fire)
    localStorage.setItem(STORAGE_KEY, user.id);
  }, [isLoaded, user]);

  return null;
}
