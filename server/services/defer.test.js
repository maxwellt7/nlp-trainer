import test from 'node:test';
import assert from 'node:assert/strict';
import { deferTask } from './defer.js';

test('deferTask runs the task and resolves', async () => {
  let ran = false;
  await deferTask(async () => { ran = true; }, 'unit');
  assert.equal(ran, true);
});

test('deferTask swallows a throwing task — never rejects into the caller', async () => {
  // A failing analysis pass must never bubble up and break the request that
  // already responded. deferTask resolves regardless.
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    await assert.doesNotReject(
      deferTask(async () => { throw new Error('boom'); }, 'unit-fail'),
    );
  } finally {
    console.warn = originalWarn;
  }
  assert.ok(warnings.some((w) => w.includes('unit-fail') && w.includes('boom')));
});
