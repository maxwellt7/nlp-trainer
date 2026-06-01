import { Redirect } from 'expo-router';
import { SignedIn, SignedOut } from '@clerk/clerk-expo';
import { env } from '../src/config/env';

export default function IndexRoute() {
  if (!env.clerkPublishableKey) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return (
    <>
      <SignedIn>
        <Redirect href="/(tabs)/dashboard" />
      </SignedIn>
      <SignedOut>
        <Redirect href="/sign-in" />
      </SignedOut>
    </>
  );
}
