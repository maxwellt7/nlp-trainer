import { SignUp } from '@clerk/clerk-react';

export default function SignUpPage() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100dvh',
      background: '#0a0a1a',
      padding: 16,
    }}>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        afterSignUpUrl="/"
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
