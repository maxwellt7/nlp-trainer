import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routeSrc = fs.readFileSync(path.resolve(__dirname, '..', 'server', 'routes', 'hypnosis.js'), 'utf8');

// Regression: the model told the user "Click Create Hypnosis now" while
// returning readyToGenerate:false, so the button never rendered — and the
// user's follow-up turn demoted session_status back to 'active', locking the
// dead-end in. Readiness must consider the reply text and must ratchet.
test('chat readiness counts an explicit reply invite, not just the JSON flag', () => {
  assert.match(routeSrc, /replyInvitesHypnosisCta\(replyText\)/,
    'the /chat route must treat a "click Create Hypnosis" invite in the reply as readiness');
});

test('chat readiness ratchets — a later turn cannot demote ready_for_hypnosis', () => {
  assert.match(routeSrc, /session\.session_status === 'ready_for_hypnosis'/,
    'the /chat route must carry prior ready_for_hypnosis status forward');
});
