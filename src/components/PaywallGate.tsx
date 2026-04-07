/**
 * PaywallGate — wraps protected content and shows upgrade screen for unpaid users
 * 
 * Usage:
 *   <PaywallGate>
 *     <Dashboard />
 *   </PaywallGate>
 */

import { useAccessGate } from '../hooks/useAccessGate';

interface PaywallGateProps {
  children: React.ReactNode;
}

export default function PaywallGate({ children }: PaywallGateProps) {
  const { hasAccess, loading, purchaseUrl } = useAccessGate();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100dvh',
        background: '#0a0a0f',
        color: '#b8860b',
        fontFamily: "'Cinzel', serif",
      }}>
        <div style={{
          width: 48,
          height: 48,
          border: '3px solid rgba(184, 134, 11, 0.2)',
          borderTopColor: '#b8860b',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <p style={{ marginTop: 16, fontSize: 14, letterSpacing: 2 }}>VERIFYING ACCESS...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        background: 'linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%)',
        color: '#e8e0d0',
        fontFamily: "'Cinzel', serif",
        padding: '24px',
        textAlign: 'center',
      }}>
        {/* Gold compass icon */}
        <div style={{
          fontSize: 64,
          marginBottom: 24,
          filter: 'drop-shadow(0 0 20px rgba(184, 134, 11, 0.4))',
        }}>
          🧭
        </div>

        <h1 style={{
          fontSize: 'clamp(24px, 5vw, 36px)',
          fontWeight: 700,
          color: '#b8860b',
          marginBottom: 12,
          lineHeight: 1.2,
        }}>
          Unlock Your Full Protocol
        </h1>

        <p style={{
          fontSize: 'clamp(14px, 3vw, 18px)',
          color: '#a0a0b0',
          maxWidth: 480,
          lineHeight: 1.6,
          marginBottom: 32,
          fontFamily: "'Inter', sans-serif",
        }}>
          Your personalized alignment protocol is ready. Get full access to AI-powered hypnosis sessions, 
          belief reprogramming, and your complete transformation dashboard.
        </p>

        {/* Value props */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginBottom: 32,
          maxWidth: 400,
          width: '100%',
        }}>
          {[
            'Unlimited AI Hypnosis Sessions',
            'Personalized Belief Reprogramming',
            'Progress Tracking & Streaks',
            'Identity Alignment Dashboard',
            'New Sessions Generated Daily',
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 16px',
              background: 'rgba(184, 134, 11, 0.08)',
              borderRadius: 8,
              border: '1px solid rgba(184, 134, 11, 0.15)',
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
            }}>
              <span style={{ color: '#b8860b', fontSize: 16, flexShrink: 0 }}>✦</span>
              <span>{item}</span>
            </div>
          ))}
        </div>

        {/* Price + CTA */}
        <div style={{
          background: 'rgba(184, 134, 11, 0.1)',
          border: '1px solid rgba(184, 134, 11, 0.3)',
          borderRadius: 16,
          padding: '24px 32px',
          marginBottom: 24,
          maxWidth: 400,
          width: '100%',
        }}>
          <div style={{
            fontSize: 14,
            color: '#a0a0b0',
            marginBottom: 4,
            fontFamily: "'Inter', sans-serif",
          }}>
            One-time access
          </div>
          <div style={{
            fontSize: 48,
            fontWeight: 700,
            color: '#b8860b',
            marginBottom: 4,
          }}>
            $7
          </div>
          <div style={{
            fontSize: 13,
            color: '#808090',
            marginBottom: 20,
            fontFamily: "'Inter', sans-serif",
          }}>
            Lifetime access to your alignment protocol
          </div>

          <a
            href={purchaseUrl}
            style={{
              display: 'block',
              width: '100%',
              padding: '14px 24px',
              background: 'linear-gradient(135deg, #b8860b, #d4a017)',
              color: '#0a0a0f',
              fontWeight: 700,
              fontSize: 16,
              borderRadius: 10,
              textDecoration: 'none',
              textAlign: 'center',
              fontFamily: "'Cinzel', serif",
              letterSpacing: 1,
              boxShadow: '0 4px 20px rgba(184, 134, 11, 0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 30px rgba(184, 134, 11, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(184, 134, 11, 0.3)';
            }}
          >
            GET FULL ACCESS
          </a>
        </div>

        <p style={{
          fontSize: 12,
          color: '#606070',
          fontFamily: "'Inter', sans-serif",
        }}>
          Secure payment via Stripe · Instant access after purchase
        </p>
      </div>
    );
  }

  // User has access — render the protected content
  return <>{children}</>;
}
