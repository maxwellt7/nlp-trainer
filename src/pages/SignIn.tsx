import { SignIn } from '@clerk/clerk-react';

export default function SignInPage() {
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
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100dvh',
        padding: '40px 20px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 28,
            fontWeight: 700,
            color: '#F1F5F9',
            lineHeight: 1.2,
            margin: '0 0 8px',
          }}>
            Welcome Back
          </h1>
          <p style={{
            color: '#64748B', fontSize: 14, margin: 0,
          }}>
            Continue your alignment protocol
          </p>
        </div>

        {/* Clerk Sign-In Form */}
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          afterSignInUrl="/"
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

        {/* Below form */}
        <div style={{
          textAlign: 'center', marginTop: 20,
        }}>
          <p style={{
            color: '#475569', fontSize: 12, lineHeight: 1.6, margin: 0,
          }}>
            Your data is encrypted and never shared.
          </p>
        </div>
      </div>
    </div>
  );
}
