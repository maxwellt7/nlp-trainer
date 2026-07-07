import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGoal, listGoals, updateGoal, deleteGoal } from './goals.js';

const U = 'test-user-goals';

test('createGoal round-trips shape and parses JSON', () => {
  const g = createGoal(U, {
    title: 'Buy the lake house', description: 'family retreat', category: 'Wealth',
    targetDate: '2035-06-01',
    milestones: [{ text: 'Save deposit', done: false }],
    rewards: [{ type: 'material', name: 'Boat', image: '' }, { type: 'experience', name: '', image: '' }],
  });
  assert.equal(g.title, 'Buy the lake house');
  assert.equal(g.targetDate, '2035-06-01');
  assert.equal(g.completed, false);
  assert.equal(g.milestones[0].done, false);
  // reward with neither name nor image is dropped
  assert.equal(g.rewards.length, 1);
  assert.equal(g.rewards[0].name, 'Boat');
});

test("listGoals returns only the user's goals", () => {
  createGoal('other-user', { title: 'Not mine', targetDate: '2040-01-01' });
  const mine = listGoals(U);
  assert.ok(mine.every(g => g.title !== 'Not mine'));
  assert.ok(mine.length >= 1);
});

test('updateGoal patches and enforces ownership', () => {
  const g = createGoal(U, { title: 'Editable', targetDate: '2038-01-01' });
  const upd = updateGoal(U, g.id, { completed: true, title: 'Edited' });
  assert.equal(upd.completed, true);
  assert.equal(upd.title, 'Edited');
  assert.equal(updateGoal('intruder', g.id, { title: 'hax' }), null);
});

test('deleteGoal enforces ownership', () => {
  const g = createGoal(U, { title: 'Deletable', targetDate: '2039-01-01' });
  assert.equal(deleteGoal('intruder', g.id), false);
  assert.equal(deleteGoal(U, g.id), true);
  assert.ok(!listGoals(U).some(x => x.id === g.id));
});
