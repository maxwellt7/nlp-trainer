// Read paid-plan status from Clerk's public_metadata.
//
// Why this exists: start.sovereignty.app's checkout flow writes purchase
// status to Clerk public_metadata as its source of truth. heart.sovereignty.app's
// useAccessGate originally only checked our paid_users table via
// /api/provision-access/check, so customers who came through that funnel
// (De'Yona Moore was the first reported case) got paywall-looped even
// though Clerk knew they paid.
//
// public_metadata is read-only on the frontend — Clerk only lets the
// Backend API or Dashboard write to it — so trusting it client-side is
// safe.

const UNPAID_VALUES = new Set(['unpaid', 'free', 'none', 'trial']);

/**
 * @param {any} user — a Clerk user object (frontend SDK or backend JSON)
 * @returns {string | null} the plan name if the user has a paid plan,
 *   or null if no paid plan is set / the plan marks them as unpaid.
 */
export function derivePaidPlanFromClerk(user) {
  if (!user) return null;
  // Frontend SDK uses camelCase (publicMetadata); Backend API JSON uses
  // snake_case (public_metadata). Accept both so this helper works whether
  // the user object came from `useUser()` or a server JSON dump.
  const metadata = user.publicMetadata || user.public_metadata;
  if (!metadata || typeof metadata !== 'object') return null;

  const plan = metadata.plan;
  if (typeof plan !== 'string') return null;
  const normalized = plan.trim().toLowerCase();
  if (!normalized || UNPAID_VALUES.has(normalized)) return null;
  return plan;
}
