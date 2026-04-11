import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const appPath = path.resolve('/home/ubuntu/nlp-trainer/src/App.tsx');
const appSource = fs.readFileSync(appPath, 'utf8');

test('signed-in users reach the authenticated app without a top-level paywall wrapper', () => {
  assert.ok(
    appSource.includes('<SignedIn>'),
    'Expected SignedIn route block to exist in App.tsx'
  );

  assert.ok(
    !appSource.includes('<PaywallGate>'),
    'Signed-in users should not be routed through a top-level paywall gate immediately after signup'
  );

  assert.match(
    appSource,
    /<SignedIn>[\s\S]*?<AuthProvider>[\s\S]*?<ProtectedRoutes \/>/,
    'Expected SignedIn users to reach AuthProvider and ProtectedRoutes directly'
  );
});

test('top-level app shell does not disable vertical scrolling', () => {
  assert.ok(
    !appSource.includes("overflow: 'hidden'"),
    'The main App shell should not lock vertical scrolling with overflow hidden'
  );
});
