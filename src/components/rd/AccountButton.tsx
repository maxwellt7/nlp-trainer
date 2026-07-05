import { UserButton } from '@clerk/clerk-react';

const HAS_CLERK = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function AccountButton() {
  if (!HAS_CLERK) return null;
  return (
    <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top) + 10px)', right: 14, zIndex: 45 }}>
      <UserButton afterSignOutUrl="/sign-in" />
    </div>
  );
}
