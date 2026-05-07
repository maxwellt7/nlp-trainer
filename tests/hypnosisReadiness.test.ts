import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canShowCreateHypnosisCTA,
  endsWithQuestion,
  isSessionMarkedReady,
} from '../src/pages/hypnosisReadiness.ts';

const baseInput = {
  initializing: false,
  loading: false,
  generating: false,
  isSelectedLocked: false,
};

test('endsWithQuestion still detects trailing questions (helper retained for other callers)', () => {
  assert.equal(endsWithQuestion('What now?'), true);
  assert.equal(endsWithQuestion('What now? "'), true);
  assert.equal(endsWithQuestion('What now.'), false);
});

test('isSessionMarkedReady returns true only for ready_for_hypnosis status', () => {
  assert.equal(isSessionMarkedReady('ready_for_hypnosis'), true);
  assert.equal(isSessionMarkedReady('active'), false);
  assert.equal(isSessionMarkedReady(undefined), false);
});

test('canShowCreateHypnosisCTA returns true when backend says ready and last assistant message is a statement', () => {
  const result = canShowCreateHypnosisCTA({
    ...baseInput,
    readyToGenerate: true,
    messages: [
      { role: 'user', content: 'I keep replaying everything.' },
      { role: 'assistant', content: 'What is the courtroom protecting you from?' },
      { role: 'user', content: 'From being humiliated.' },
      { role: 'assistant', content: 'You have been on guard duty for thirty years.' },
      { role: 'user', content: 'Yes. I want to rest.' },
      { role: 'assistant', content: "I've got a clear picture. Click Create Hypnosis now and I'll build your session." },
    ],
  });
  assert.equal(result, true);
});

test('canShowCreateHypnosisCTA returns true even if backend-ready reply ends with a question (trust backend signal)', () => {
  // Model is unreliable about its own "no question marks when ready" rule —
  // when backend says ready, we surface the button anyway so the user is not
  // stuck repeating a closing exchange they already finished.
  const result = canShowCreateHypnosisCTA({
    ...baseInput,
    readyToGenerate: true,
    messages: [
      { role: 'user', content: 'I keep replaying everything.' },
      { role: 'assistant', content: 'What is the courtroom protecting you from?' },
      { role: 'user', content: 'From being humiliated.' },
      { role: 'assistant', content: 'You have been on guard duty for thirty years.' },
      { role: 'user', content: 'Yes. I want to rest.' },
      { role: 'assistant', content: "That's a brave step. How does that feel to name?" },
    ],
  });
  assert.equal(result, true);
});

test('canShowCreateHypnosisCTA returns false when backend says NOT ready', () => {
  const result = canShowCreateHypnosisCTA({
    ...baseInput,
    readyToGenerate: false,
    messages: [
      { role: 'user', content: 'I keep replaying everything.' },
      { role: 'assistant', content: 'What is the courtroom protecting you from?' },
      { role: 'user', content: 'From being humiliated.' },
      { role: 'assistant', content: "Stay with that. I've got what I need." },
    ],
  });
  assert.equal(result, false);
});

test('canShowCreateHypnosisCTA returns false until at least 3 user messages even with backend-ready signal', () => {
  const result = canShowCreateHypnosisCTA({
    ...baseInput,
    readyToGenerate: true,
    messages: [
      { role: 'user', content: 'Hi.' },
      { role: 'assistant', content: 'I have what I need. Click Create Hypnosis.' },
    ],
  });
  assert.equal(result, false);
});

test('canShowCreateHypnosisCTA returns false if last substantive message is from the user (waiting on assistant)', () => {
  const result = canShowCreateHypnosisCTA({
    ...baseInput,
    readyToGenerate: true,
    messages: [
      { role: 'user', content: 'I keep replaying everything.' },
      { role: 'assistant', content: 'What is the courtroom protecting you from?' },
      { role: 'user', content: 'From being humiliated.' },
      { role: 'assistant', content: 'Yes — guard duty for thirty years.' },
      { role: 'user', content: 'Mhm.' },
    ],
  });
  assert.equal(result, false);
});

test('canShowCreateHypnosisCTA returns false during loading/generating/locked states', () => {
  const ready = {
    readyToGenerate: true,
    messages: [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
      { role: 'assistant', content: 'd' },
      { role: 'user', content: 'e' },
      { role: 'assistant', content: "Click Create Hypnosis." },
    ],
  };
  assert.equal(canShowCreateHypnosisCTA({ ...baseInput, ...ready, initializing: true }), false);
  assert.equal(canShowCreateHypnosisCTA({ ...baseInput, ...ready, loading: true }), false);
  assert.equal(canShowCreateHypnosisCTA({ ...baseInput, ...ready, generating: true }), false);
  assert.equal(canShowCreateHypnosisCTA({ ...baseInput, ...ready, isSelectedLocked: true }), false);
});
