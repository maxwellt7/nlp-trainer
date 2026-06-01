const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

export const env = {
  apiUrl: apiUrl && apiUrl.length > 0 ? apiUrl : '',
  clerkPublishableKey: clerkPublishableKey && clerkPublishableKey.length > 0 ? clerkPublishableKey : '',
};

export function requireClerkPublishableKey(): string {
  if (!env.clerkPublishableKey) {
    throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY');
  }
  return env.clerkPublishableKey;
}
