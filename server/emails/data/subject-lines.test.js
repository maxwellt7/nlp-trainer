import test from 'node:test';
import assert from 'node:assert/strict';
import { SUBJECT_LINES } from './subject-lines.js';

// Test 1: All 6 subject lines return the expected strings
test('SUBJECT_LINES has all 6 entries and returns expected strings', () => {
  const ctx = { first_name: 'Max', program: 'The Loop' };

  assert.equal(typeof SUBJECT_LINES[1], 'function', 'SUBJECT_LINES[1] should be a function');
  assert.equal(typeof SUBJECT_LINES[2], 'function', 'SUBJECT_LINES[2] should be a function');
  assert.equal(typeof SUBJECT_LINES[3], 'function', 'SUBJECT_LINES[3] should be a function');
  assert.equal(typeof SUBJECT_LINES[4], 'function', 'SUBJECT_LINES[4] should be a function');
  assert.equal(typeof SUBJECT_LINES[5], 'function', 'SUBJECT_LINES[5] should be a function');
  assert.equal(typeof SUBJECT_LINES[6], 'function', 'SUBJECT_LINES[6] should be a function');

  assert.equal(SUBJECT_LINES[2](ctx), 'Why willpower never reached this');
  assert.equal(SUBJECT_LINES[3](ctx), "The part most people don't believe at first");
  assert.equal(SUBJECT_LINES[4](ctx), 'A year from now');
  assert.equal(SUBJECT_LINES[5](ctx), 'The honest case for and against doing this');
  assert.equal(SUBJECT_LINES[6](ctx), 'Closing your diagnostic');
});

// Test 2: Subject line 1 interpolates first_name correctly
test('SUBJECT_LINES[1] interpolates first_name correctly', () => {
  assert.equal(
    SUBJECT_LINES[1]({ first_name: 'Sarah' }),
    "Sarah, here's what your diagnostic actually found",
  );
  assert.equal(
    SUBJECT_LINES[1]({ first_name: 'James' }),
    "James, here's what your diagnostic actually found",
  );
  assert.equal(
    SUBJECT_LINES[1]({ first_name: 'Max' }),
    "Max, here's what your diagnostic actually found",
  );
});
