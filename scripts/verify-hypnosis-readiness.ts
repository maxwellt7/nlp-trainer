import assert from 'node:assert/strict';
import {
  canShowCreateHypnosisCTA,
  endsWithQuestion,
  isSessionMarkedReady,
} from '../src/pages/hypnosisReadiness.ts';

const baseGuard = {
  initializing: false,
  loading: false,
  generating: false,
  isSelectedLocked: false,
};

assert.equal(endsWithQuestion('What are you actually feeling right now?'), true);
assert.equal(endsWithQuestion('What are you actually feeling right now?"  '), true);
assert.equal(endsWithQuestion('That shift matters. Stay with it.'), false);

assert.equal(isSessionMarkedReady('ready_for_hypnosis'), true);
assert.equal(isSessionMarkedReady('active'), false);

const readyConversation = [
  { role: 'assistant', content: 'What is really alive for you today?' },
  { role: 'user', content: 'I feel scattered and behind.' },
  { role: 'assistant', content: 'Where do you feel that pressure in your body?' },
  { role: 'user', content: 'In my chest. It feels tight.' },
  { role: 'assistant', content: 'What are you trying so hard to prove?' },
  { role: 'user', content: 'That I am still enough even when I slow down.' },
  { role: 'assistant', content: 'There it is. You are chasing safety through performance. Click Create Hypnosis now and let me reinforce the part of you that can stay grounded without earning worth.' },
] as const;

assert.equal(canShowCreateHypnosisCTA({
  ...baseGuard,
  readyToGenerate: true,
  messages: readyConversation,
  minimumUserMessages: 3,
}), true);

assert.equal(canShowCreateHypnosisCTA({
  ...baseGuard,
  readyToGenerate: true,
  messages: [...readyConversation.slice(0, -1), { role: 'assistant', content: 'What are you trying so hard to prove?' }],
  minimumUserMessages: 3,
}), false);

assert.equal(canShowCreateHypnosisCTA({
  ...baseGuard,
  readyToGenerate: true,
  messages: readyConversation.slice(0, 5),
  minimumUserMessages: 3,
}), false);

assert.equal(canShowCreateHypnosisCTA({
  ...baseGuard,
  readyToGenerate: true,
  messages: [...readyConversation.slice(0, 6)],
  minimumUserMessages: 3,
}), false);

assert.equal(canShowCreateHypnosisCTA({
  ...baseGuard,
  readyToGenerate: false,
  messages: readyConversation,
  minimumUserMessages: 3,
}), false);

console.log('Hypnosis readiness checks passed.');
