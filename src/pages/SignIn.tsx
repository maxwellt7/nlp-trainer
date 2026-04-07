import { SignIn } from '@clerk/clerk-react';

export default function SignInPage() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100dvh',
      background: '#0a0a1a',
      padding: 16,
    }}>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        afterSignInUrl="/"
        appearance={{
          variables: {
            colorPrimary: '#7c3aed',
            colorBackground: '#1e1b2e',
            colorText: '#e2e8f0',
            colorInputBackground: '#16132a',
            colorInputText: '#e2e8f0',
          },
          elements: {
            socialButtonsBlockButton: {
              backgroundColor: '#ffffff',
              color: '#1f1f1f',
              border: '1px solid #dadce0',
              fontWeight: 500,
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
              backgroundColor: '#3b3655',
            },
            dividerText: {
              color: '#94a3b8',
            },
            formButtonPrimary: {
              background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #6d28d9 0%, #9333ea 100%)',
              },
            },
            footerActionLink: {
              color: '#a78bfa',
              '&:hover': {
                color: '#c4b5fd',
              },
            },
            card: {
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            },
          },
        }}
      />
    </div>
  );
}
