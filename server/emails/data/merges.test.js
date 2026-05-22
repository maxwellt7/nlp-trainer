import test from 'node:test';
import assert from 'node:assert/strict';
import { PROGRAM_MERGES } from './program-merges.js';

const EXPECTED_SLUGS = ['over-preparer', 'self-censor', 'invisible-ceiling', 'loop'];

// Test 1: All 4 program slugs present in PROGRAM_MERGES
test('PROGRAM_MERGES contains all 4 program slugs', () => {
  for (const slug of EXPECTED_SLUGS) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(PROGRAM_MERGES, slug),
      `PROGRAM_MERGES should have slug "${slug}"`,
    );
  }
  assert.equal(
    Object.keys(PROGRAM_MERGES).length,
    4,
    'PROGRAM_MERGES should have exactly 4 entries',
  );
});

// Test 2: Each entry has non-empty program, program_line, fear_line
test('each PROGRAM_MERGES entry has non-empty required fields', () => {
  for (const slug of EXPECTED_SLUGS) {
    const entry = PROGRAM_MERGES[slug];
    assert.ok(typeof entry.program === 'string' && entry.program.length > 0, `${slug}.program should be non-empty`);
    assert.ok(typeof entry.program_line === 'string' && entry.program_line.length > 0, `${slug}.program_line should be non-empty`);
    assert.ok(typeof entry.fear_line === 'string' && entry.fear_line.length > 0, `${slug}.fear_line should be non-empty`);
  }
});

// Test 3: Verbatim copy regression guard
test('PROGRAM_MERGES verbatim copy matches spec §5.4', () => {
  assert.equal(PROGRAM_MERGES['over-preparer'].program, 'The Over-Preparer');
  assert.equal(
    PROGRAM_MERGES['over-preparer'].program_line,
    'the program that equates feeling safe with preparing more — so "ready" never arrives',
  );
  assert.equal(
    PROGRAM_MERGES['over-preparer'].fear_line,
    'another year of preparing harder and still freezing when it counts',
  );

  assert.equal(PROGRAM_MERGES['self-censor'].program, 'The Self-Censor');
  assert.equal(
    PROGRAM_MERGES['self-censor'].program_line,
    'the program that intercepts your words in the half-second before you say them',
  );
  assert.equal(
    PROGRAM_MERGES['self-censor'].fear_line,
    "another year of replaying conversations you wish you'd spoken up in",
  );

  assert.equal(PROGRAM_MERGES['invisible-ceiling'].program, 'The Invisible Ceiling');
  assert.equal(
    PROGRAM_MERGES['invisible-ceiling'].program_line,
    'the program holding the quiet rule that someone like you operates at this level',
  );
  assert.equal(
    PROGRAM_MERGES['invisible-ceiling'].fear_line,
    'another year stalled at the same ceiling, watching the gap stay exactly where it is',
  );

  assert.equal(PROGRAM_MERGES['loop'].program, 'The Loop');
  assert.equal(
    PROGRAM_MERGES['loop'].program_line,
    "the program faithfully re-running a template you didn't choose",
  );
  assert.equal(
    PROGRAM_MERGES['loop'].fear_line,
    'another year of the same pattern quietly repeating in new disguises',
  );
});
