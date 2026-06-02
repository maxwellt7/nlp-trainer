// Type declaration for the JS helper next to this file.
// Kept as .js (not .ts) so node --test can load it directly without a
// transpile step; the .d.ts satisfies tsc when imported from useAccessGate.ts.

export function derivePaidPlanFromClerk(user: unknown): string | null;
