import test from 'node:test';
import assert from 'node:assert/strict';
import { createThread, appendTurns, listThreads, getThread, deleteThread } from './ask-threads.js';

test('create -> get returns the thread with its title and empty messages', () => {
  const { id, title } = createThread('u1', 'What is clean influence?');
  assert.equal(title, 'What is clean influence?');
  const t = getThread(id, 'u1');
  assert.equal(t.id, id);
  assert.deepEqual(t.messages, []);
});

test('title is trimmed to 80 chars', () => {
  const { title } = createThread('u1', 'x'.repeat(200));
  assert.equal(title.length, 80);
});

test('appendTurns stores turns and getThread returns them', () => {
  const { id } = createThread('u1', 'q');
  appendTurns(id, 'u1', [
    { role: 'user', content: 'q' },
    { role: 'assistant', content: 'a', sources: [{ filename: 'f.txt', score: 0.4 }] },
  ]);
  const t = getThread(id, 'u1');
  assert.equal(t.messages.length, 2);
  assert.equal(t.messages[1].sources[0].filename, 'f.txt');
});

test('listThreads returns newest updated first', () => {
  const a = createThread('u2', 'first');
  createThread('u2', 'second');
  appendTurns(a.id, 'u2', [{ role: 'user', content: 'later' }]); // bumps a.updated_at
  const list = listThreads('u2');
  assert.equal(list[0].id, a.id);
  assert.ok(list.every((t) => 'title' in t && 'updatedAt' in t));
});

test('ownership: another user cannot read, append to, or delete a thread', () => {
  const { id } = createThread('owner', 'secret');
  assert.equal(getThread(id, 'intruder'), null);
  appendTurns(id, 'intruder', [{ role: 'user', content: 'x' }]); // no-op
  assert.equal(getThread(id, 'owner').messages.length, 0);
  deleteThread(id, 'intruder'); // no-op
  assert.ok(getThread(id, 'owner'));
  deleteThread(id, 'owner');
  assert.equal(getThread(id, 'owner'), null);
});
