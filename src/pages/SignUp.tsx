import { SignUp } from '@clerk/clerk-react';

const VALUE_PROPS = [
  {
    icon: '🧠',
    title: 'AI-Personalized Hypnosis',
    desc: 'Sessions built around your unique subconscious patterns, values, and blind spots.',
  },
  {
    icon: '🎯',
    title: 'Targeted Belief Reprogramming',
    desc: 'Address the exact misalignments your assessment revealed — not generic affirmations.',
  },
  {
    icon: '⚡',
    title: '10 Minutes a Day',
    desc: 'Clinically-informed sessions designed for real results in the time you actually have.',
  },
  {
    icon: '📊',
    title: 'Track Your Transformation',
    desc: 'Watch your alignment score rise as your subconscious patterns shift over time.',
  },
  {
    icon: '🔓',
    title: 'Unlock Your Full Protocol',
    desc: 'Personalized scripts, guided sessions, progress insights, and identity-level tools.',
  },
];

const TESTIMONIAL = {
  quote: "I've tried meditation apps, journaling, therapy — nothing stuck. This actually rewires the patterns I couldn't see.",
  author: 'Early Access Member',
};

export default function SignUpPage() {
  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0B0F19',
      overflowY: 'auto',
    }}>
      {/* Subtle top glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(212, 168, 83, 0.04) 0%, transparent 60%)',
      }} />

      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: 1100, margin: '0 auto', padding: '40px 20px 60px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', borderRadius: 999,
            background: 'rgba(212, 168, 83, 0.08)', border: '1px solid rgba(212, 168, 83, 0.15)',
            marginBottom: 16,
          }}>
            <span style={{ color: '#D4A853', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Free to Start — No Credit Card
            </span>
          </div>
          <h1 style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 'clamp(24px, 5vw, 36px)',
            fontWeight: 700,
            color: '#F1F5F9',
            lineHeight: 1.2,
            margin: '0 0 12px',
          }}>
            Your Alignment Protocol<br />
            <span style={{ color: '#D4A853' }}>Is Ready</span>
          </h1>
          <p style={{
            color: '#94A3B8', fontSize: 16, maxWidth: 500, margin: '0 auto', lineHeight: 1.6,
          }}>
            Based on your assessment, we've identified the exact subconscious patterns holding you back.
            Create your account to begin.
          </p>
        </div>

        {/* Two-column layout: value props + Clerk form */}
        <div style={{
          display: 'flex',
          gap: 40,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          {/* Left: Value Props */}
          <div style={{ flex: '1 1 380px', maxWidth: 480, minWidth: 300 }}>
            {/* Value prop cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {VALUE_PROPS.map((vp, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                  background: '#131B2E', border: '1px solid #243352', borderRadius: 12,
                  padding: '16px 18px',
                  transition: 'border-color 0.2s',
                }}>
                  <div style={{
                    fontSize: 24, lineHeight: 1, flexShrink: 0, marginTop: 2,
                  }}>
                    {vp.icon}
                  </div>
                  <div>
                    <div style={{
                      color: '#F1F5F9', fontSize: 15, fontWeight: 600, marginBottom: 4,
                    }}>
                      {vp.title}
                    </div>
                    <div style={{
                      color: '#94A3B8', fontSize: 13, lineHeight: 1.5,
                    }}>
                      {vp.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Testimonial */}
            <div style={{
              marginTop: 20,
              background: 'rgba(212, 168, 83, 0.04)',
              border: '1px solid rgba(212, 168, 83, 0.12)',
              borderRadius: 12,
              padding: '20px',
            }}>
              <div style={{ color: '#D4A853', fontSize: 24, marginBottom: 8, lineHeight: 1 }}>"</div>
              <p style={{
                color: '#CBD5E1', fontSize: 14, lineHeight: 1.7, fontStyle: 'italic', margin: '0 0 12px',
              }}>
                {TESTIMONIAL.quote}
              </p>
              <div style={{
                color: '#64748B', fontSize: 12, fontWeight: 500,
              }}>
                — {TESTIMONIAL.author}
              </div>
            </div>

            {/* Trust badges */}
            <div style={{
              display: 'flex', gap: 20, justifyContent: 'center', marginTop: 20,
              flexWrap: 'wrap',
            }}>
              {[
                { label: 'Free Trial', icon: '✓' },
                { label: 'Cancel Anytime', icon: '✓' },
                { label: 'No Credit Card', icon: '✓' },
              ].map((badge, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{
                    color: '#22C55E', fontSize: 14, fontWeight: 700,
                  }}>{badge.icon}</span>
                  <span style={{
                    color: '#64748B', fontSize: 12, fontWeight: 500,
                  }}>{badge.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Clerk Sign-Up Form */}
          <div style={{
            flex: '1 1 380px', maxWidth: 480, minWidth: 300,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            {/* Form header */}
            <div style={{
              textAlign: 'center', marginBottom: 16, width: '100%',
            }}>
              <h2 style={{
                color: '#F1F5F9', fontSize: 20, fontWeight: 600, margin: '0 0 6px',
                fontFamily: "'Inter', sans-serif",
              }}>
                Create Your Free Account
              </h2>
              <p style={{ color: '#64748B', fontSize: 13, margin: 0 }}>
                Takes less than 30 seconds
              </p>
            </div>

            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl="/sign-in"
              afterSignUpUrl="/"
              appearance={{
                variables: {
                  colorPrimary: '#D4A853',
                  colorBackground: '#131B2E',
                  colorText: '#e2e8f0',
                  colorInputBackground: '#0B0F19',
                  colorInputText: '#e2e8f0',
                  borderRadius: '10px',
                },
                elements: {
                  rootBox: {
                    width: '100%',
                    maxWidth: '100%',
                  },
                  cardBox: {
                    width: '100%',
                    maxWidth: '100%',
                    boxShadow: 'none',
                  },
                  card: {
                    borderRadius: '16px',
                    border: '1px solid #243352',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                    background: '#131B2E',
                  },
                  socialButtonsBlockButton: {
                    backgroundColor: '#ffffff',
                    color: '#1f1f1f',
                    border: '1px solid #dadce0',
                    fontWeight: 500,
                    borderRadius: '10px',
                    '&:hover': {
                      backgroundColor: '#f8f9fa',
                      borderColor: '#c4c7c5',
                    },
                  },
                  socialButtonsBlockButtonText: {
                    color: '#1f1f1f',
                    fontWeight: 500,
                  },
                  dividerLine: {
                    backgroundColor: '#243352',
                  },
                  dividerText: {
                    color: '#64748B',
                  },
                  formButtonPrimary: {
                    background: 'linear-gradient(135deg, #D4A853 0%, #E8C36A 100%)',
                    color: '#0B0F19',
                    fontWeight: 700,
                    '&:hover': {
                      background: 'linear-gradient(135deg, #C49A48 0%, #D4A853 100%)',
                    },
                  },
                  footerActionLink: {
                    color: '#D4A853',
                    '&:hover': {
                      color: '#E8C36A',
                    },
                  },
                  headerTitle: {
                    display: 'none',
                  },
                  headerSubtitle: {
                    display: 'none',
                  },
                },
              }}
            />

            {/* Below form reassurance */}
            <div style={{
              textAlign: 'center', marginTop: 16, padding: '0 8px',
            }}>
              <p style={{
                color: '#475569', fontSize: 12, lineHeight: 1.6, margin: 0,
              }}>
                By signing up, you agree to our Terms of Service.
                Your data is encrypted and never shared.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom section: What happens next */}
        <div style={{
          marginTop: 48, textAlign: 'center',
          background: '#131B2E', border: '1px solid #243352', borderRadius: 16,
          padding: '32px 24px', maxWidth: 700, marginLeft: 'auto', marginRight: 'auto',
        }}>
          <h3 style={{
            color: '#D4A853', fontSize: 14, fontWeight: 600,
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20,
          }}>
            What Happens After You Sign Up
          </h3>
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap',
          }}>
            {[
              { step: '1', title: 'Instant Access', desc: 'Your personalized dashboard loads immediately' },
              { step: '2', title: 'First Session', desc: 'Generate your first AI hypnosis session in under 2 minutes' },
              { step: '3', title: 'Daily Protocol', desc: '10 minutes a day to rewire your subconscious patterns' },
            ].map((s, i) => (
              <div key={i} style={{ flex: '1 1 160px', maxWidth: 200 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(212, 168, 83, 0.1)', border: '1px solid rgba(212, 168, 83, 0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 10px',
                  color: '#D4A853', fontWeight: 700, fontSize: 16,
                }}>
                  {s.step}
                </div>
                <div style={{ color: '#F1F5F9', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                  {s.title}
                </div>
                <div style={{ color: '#64748B', fontSize: 12, lineHeight: 1.5 }}>
                  {s.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
