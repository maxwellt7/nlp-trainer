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
        }}
      />
    </div>
  );
}
