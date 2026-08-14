import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (...p) => fs.readFileSync(path.resolve(__dirname, '..', ...p), 'utf8');

const coachPrompt = read('server', 'data', 'prompts', 'daily-coach.txt');
const hypnosisSrc = read('server', 'routes', 'hypnosis.js');

test('coaching prompt treats retrieved libraries as the move, not garnish', () => {
  assert.match(coachPrompt, /retrieved excerpts are not optional flavor/i);
  assert.match(coachPrompt, /Length follows the retrieved material/);
  assert.match(coachPrompt, /Never reuse them/);
  assert.match(coachPrompt, /This is source material for the reply/);
  assert.doesNotMatch(coachPrompt, /2-4 sentences MAX/);
  assert.doesNotMatch(coachPrompt, /lean into Coaching first/);
});

test('coaching route retrieves more of both libraries against recent turns', () => {
  assert.match(hypnosisSrc, /recentUserQuery\(/);
  assert.match(hypnosisSrc, /topKPerCategory:\s*isGenerationPhase \? 8 : 6/);
  assert.doesNotMatch(hypnosisSrc, /nlp\.slice\(0,\s*2\)/);
  assert.doesNotMatch(hypnosisSrc, /Keep "reply" to 2-4 sentences/);
  assert.match(hypnosisSrc, /max_tokens:\s*2048/);
  assert.match(hypnosisSrc, /grounded in the retrieved libraries/);
});
