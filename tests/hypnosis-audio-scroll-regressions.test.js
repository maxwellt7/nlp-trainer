import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const hypnosisPagePath = path.resolve('/home/ubuntu/nlp-trainer/src/pages/Hypnosis.tsx');
const hypnosisPageSource = fs.readFileSync(hypnosisPagePath, 'utf8');

test('hypnosis audio generation keeps background music opt-in so scripted pauses are not masked by default', () => {
  assert.match(
    hypnosisPageSource,
    /<option value="">No music<\/option>/,
    'The hypnosis page should provide an explicit no-music choice so users can preserve clean spoken pacing when they do not want background ambience'
  );

  assert.doesNotMatch(
    hypnosisPageSource,
    /setSelectedMusic\(musicData\.tracks\[0\]\.filename\)/,
    'Background music should remain opt-in because automatically preselecting a track causes the mixer to fill scripted pause sections by default'
  );
});

test('hypnosis chat does not force-scroll the very first assistant bootstrap message out of view', () => {
  assert.doesNotMatch(
    hypnosisPageSource,
    /useEffect\(\(\) => \{\s*bottomRef\.current\?\.scrollIntoView\(\{ behavior: 'smooth' \}\);\s*\}, \[messages, loading\]\)/,
    'The chat view should not unconditionally scroll to the bottom on every initial message change, because that hides the top of the first assistant message on small screens when the input is focused'
  );
});
