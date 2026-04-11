import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const authProviderPath = path.resolve('/home/ubuntu/nlp-trainer/src/components/AuthProvider.tsx');
const authProviderSource = fs.readFileSync(authProviderPath, 'utf8');

const hypnosisRoutePath = path.resolve('/home/ubuntu/nlp-trainer/server/routes/hypnosis.js');
const hypnosisRouteSource = fs.readFileSync(hypnosisRoutePath, 'utf8');

test('auth token getter is registered before the hypnosis page mount effect can start a session', () => {
  assert.match(
    authProviderSource,
    /useLayoutEffect\(\(\) => \{[\s\S]*?setAuthTokenGetter\(getToken\)/,
    'AuthProvider must register the Clerk token getter in a layout effect so protected page mount effects do not fire unauthenticated requests on first render'
  );
});

test('hypnosis init reuses an existing same-day session even when it has no saved messages yet', () => {
  assert.doesNotMatch(
    hypnosisRouteSource,
    /if \(existing && existing\.chat_messages\)/,
    'The init route must not require chat_messages before reusing today\'s session, because an empty same-day session still represents the active session and creating another one can fail in production'
  );

  assert.match(
    hypnosisRouteSource,
    /const existing = getTodaySession\(userId\);[\s\S]*?if \(existing\) \{[\s\S]*?return res\.json\(\{/,
    'Expected the init route to short-circuit and return the existing same-day session before attempting to create a new session'
  );
});
