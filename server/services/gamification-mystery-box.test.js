import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMysteryBox, openMysteryBox } from './gamification.js';

const TEST_USER_ID = `test-mystery-${Date.now()}`;

test('generateMysteryBox returns snake_case field names matching the DB shape', () => {
  // Regression: the function used to return rewardType/rewardTitle (camelCase),
  // while every consumer (MysteryBox.tsx, /mystery-boxes GET) reads snake_case.
  // On the Hypnosis post-session reward path, this leaked: the title vanished
  // and the renderer fell through to the JSON.stringify fallback.
  const box = generateMysteryBox(TEST_USER_ID);

  assert.equal(typeof box.id, 'string');
  assert.match(box.id, /^box-/);
  assert.ok(['common', 'uncommon', 'rare', 'legendary'].includes(box.rarity));
  assert.equal(typeof box.reward_type, 'string', 'expected snake_case reward_type');
  assert.equal(typeof box.reward_title, 'string', 'expected snake_case reward_title');
  assert.ok(box.reward_title.length > 0, 'reward_title must not be empty');

  // The generator must NOT expose unopened content, but the field names it
  // does expose must match what the UI reads.
  assert.equal(box.reward_content, undefined);
});

test('openMysteryBox returns the same snake_case shape with reward_content populated', () => {
  const box = generateMysteryBox(TEST_USER_ID);
  const opened = openMysteryBox(TEST_USER_ID, box.id);
  assert.ok(opened, 'opened box should exist');
  assert.equal(typeof opened.reward_type, 'string');
  assert.equal(typeof opened.reward_title, 'string');
  assert.equal(typeof opened.reward_content, 'string');
  assert.ok(opened.reward_content.length > 0);
});
