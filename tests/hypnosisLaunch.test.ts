import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveInitialHypnosisTarget } from '../src/pages/hypnosisLaunch.ts';

test('daily launch intent opens today\'s daily session instead of auto-loading an older conversation', () => {
  const result = resolveInitialHypnosisTarget('?mode=daily', [
    { id: 'older-daily', session_type: 'daily_hypnosis' },
    { id: 'older-chat', session_type: 'general_chat' },
  ]);

  assert.deepEqual(result, {
    action: 'start',
    sessionType: 'daily_hypnosis',
  });
});

test('generic workspace launch still auto-loads the most recent existing conversation', () => {
  const result = resolveInitialHypnosisTarget('', [
    { id: 'recent-session', session_type: 'general_chat' },
    { id: 'older-session', session_type: 'daily_hypnosis' },
  ]);

  assert.deepEqual(result, {
    action: 'load',
    sessionId: 'recent-session',
  });
});

test('generic workspace launch starts a new general chat when no prior conversations exist', () => {
  const result = resolveInitialHypnosisTarget('', []);

  assert.deepEqual(result, {
    action: 'start',
    sessionType: 'general_chat',
  });
});
