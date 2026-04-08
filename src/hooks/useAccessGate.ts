/**
 * useAccessGate — checks if the current user has paid access
 * 
 * Admin users always get access.
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

// Admin emails that always have full access
const ADMIN_EMAILS = [
  'maxwellmayes@gmail.com',
  'maxwell@sovereignty.app',
];

// Admin email domains — any email on these domains gets admin access
const ADMIN_DOMAINS = [
  'sovereignty.app',
  'maxwellmayes.com',
];

function isAdminEmail(email: string): boolean {
  const lower = email.toLowerCase();
  if (ADMIN_EMAILS.some(e => e.toLowerCase() === lower)) return true;
  const domain = lower.split('@')[1];
  if (domain && ADMIN_DOMAINS.some(d => d === domain)) return true;
  return false;
}

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
    if (!userLoaded) {
      return; // Keep loading: true until Clerk loads
    }

    if (!user) {
      setState({
        hasAccess: false,
        loading: false,
        status: 'no-user',
        plan: null,
        purchaseUrl: 'https://start.sovereignty.app',
      });
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

    // Admin bypass — always grant access
    if (isAdminEmail(email)) {
      setState({
        hasAccess: true,
        loading: false,
        status: 'admin',
        plan: 'admin',
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
        // On error, default to allowing access (fail open)
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
