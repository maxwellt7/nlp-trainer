/**
 * useAccessGate — checks if the current user has paid access
 * 
 * Calls GET /api/provision-access/check?email=... with the Clerk user's email.
 * Also links the Clerk user ID to the paid record on first check.
 * 
 * Returns:
 *  - hasAccess: boolean — whether the user has paid access
 *  - loading: boolean — whether the check is in progress
 *  - purchaseUrl: string — URL to purchase access (if unpaid)
 */

import { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://nlp-training-backend-production.up.railway.app';

interface AccessState {
  hasAccess: boolean;
  loading: boolean;
  status: string;
  plan: string | null;
  purchaseUrl: string;
}

export function useAccessGate(): AccessState {
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken } = useAuth();
  const [state, setState] = useState<AccessState>({
    hasAccess: false,
    loading: true,
    status: 'checking',
    plan: null,
    purchaseUrl: 'https://start.sovereignty.app',
  });

  useEffect(() => {
    if (!userLoaded || !user) {
      setState(prev => ({ ...prev, loading: !userLoaded }));
      return;
    }

    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) {
      setState({
        hasAccess: false,
        loading: false,
        status: 'no-email',
        plan: null,
        purchaseUrl: 'https://start.sovereignty.app',
      });
      return;
    }

    // Check local cache first (valid for 5 minutes)
    const cacheKey = `access-gate-${user.id}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          setState({ ...data, loading: false });
          return;
        }
      } catch {
        // Invalid cache, continue to API check
      }
    }

    const checkAccess = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/provision-access/check?email=${encodeURIComponent(email)}`
        );
        const data = await response.json();

        const accessState: AccessState = {
          hasAccess: data.hasAccess === true,
          loading: false,
          status: data.status || 'unknown',
          plan: data.plan || null,
          purchaseUrl: data.purchaseUrl || 'https://start.sovereignty.app',
        };

        setState(accessState);

        // Cache the result
        localStorage.setItem(cacheKey, JSON.stringify({
          data: accessState,
          timestamp: Date.now(),
        }));

        // If they have access, link their Clerk ID to the paid record
        if (data.hasAccess) {
          try {
            const token = await getToken();
            await fetch(`${API_BASE}/api/provision-access/link-clerk`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ email }),
            });
          } catch {
            // Non-critical — linking can happen later
          }
        }
      } catch (err) {
        console.error('[AccessGate] Check failed:', err);
        // On error, default to allowing access (fail open for now)
        // You can change this to fail closed by setting hasAccess: false
        setState({
          hasAccess: true,
          loading: false,
          status: 'error-fallback',
          plan: null,
          purchaseUrl: 'https://start.sovereignty.app',
        });
      }
    };

    checkAccess();
  }, [userLoaded, user, getToken]);

  return state;
}
