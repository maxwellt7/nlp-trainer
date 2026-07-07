import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setUserBirthYear, getUserBirthYear } from './profile.js';

// Unique id per run: tests write to the shared on-disk dev DB, so a fixed id
// would fail the initial-null assertion on the second run.
const U = `by-user-${Date.now()}`;

test('birthYear set/get round-trips and validates', () => {
  assert.equal(getUserBirthYear(U), null);
  assert.equal(setUserBirthYear(U, 1992), 1992);
  assert.equal(getUserBirthYear(U), 1992);
  assert.equal(setUserBirthYear(U, 1800), 1992); // out of range -> unchanged
  assert.equal(getUserBirthYear(U), 1992);
});
