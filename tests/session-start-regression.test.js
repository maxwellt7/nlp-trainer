import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const authProviderPath = path.resolve('/home/ubuntu/nlp-trainer/src/components/AuthProvider.tsx');
const authProviderSource = fs.readFileSync(authProviderPath, 'utf8');

const hypnosisPagePath = path.resolve('/home/ubuntu/nlp-trainer/src/pages/Hypnosis.tsx');
const hypnosisPageSource = fs.readFileSync(hypnosisPagePath, 'utf8');

test('auth token getter is registered before the hypnosis page mount effect can start a session', () => {
  assert.match(
    hypnosisPageSource,
    /useEffect\(\(\) => \{[\s\S]*?const data = await api\.hypnosisInit\(\)/,
    'Expected Hypnosis.tsx to start the session inside a mount-time useEffect'
  );

  assert.match(
    authProviderSource,
    /useLayoutEffect\(\(\) => \{[\s\S]*?setAuthTokenGetter\(getToken\)/,
    'AuthProvider must register the Clerk token getter in a layout effect so protected page mount effects do not fire unauthenticated requests on first render'
  );
});
