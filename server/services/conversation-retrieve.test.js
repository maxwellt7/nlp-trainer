import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenizeQuery,
  scoreText,
  sessionLabel,
  flattenSessionText,
  excerptAroundMatches,
  retrieveConversationChunks,
} from './conversation-retrieve.js';

test('tokenizeQuery drops stopwords and short tokens', () => {
  assert.deepEqual(tokenizeQuery('What did we talk about with my dad?'), ['dad']);
  assert.deepEqual(tokenizeQuery('clean influence from stage'), ['clean', 'influence', 'stage']);
});

test('scoreText is 0 on empty haystack or empty terms', () => {
  assert.equal(scoreText('', ['dad']), 0);
  assert.equal(scoreText('dad showed up', []), 0);
});

test('scoreText ranks a matching session above an unrelated one', () => {
  const terms = ['dad', 'permission'];
  const hit = scoreText('You: I keep waiting for permission from my dad.', terms);
  const miss = scoreText('You: I want to raise my prices this quarter.', terms);
  assert.ok(hit > 0.34);
  assert.ok(miss < hit);
});

test('sessionLabel prefers title, else kind and date', () => {
  assert.equal(sessionLabel({ title: 'Money resistance' }), 'Money resistance');
  assert.equal(
    sessionLabel({ session_type: 'daily_hypnosis', date_key: '2026-09-03' }),
    'Daily session · Sep 3',
  );
  assert.equal(
    sessionLabel({ session_type: 'general_chat', date_key: '2026-08-12' }),
    'Coaching · Aug 12',
  );
});

test('flattenSessionText recovers coach replies from persisted JSON blobs', () => {
  const text = flattenSessionText({
    title: 'Dad pattern',
    chat_summary: 'Named the permission loop.',
    key_themes: '["permission","dad"]',
    chat_messages: JSON.stringify([
      { role: 'user', content: 'I freeze when he calls.' },
      { role: 'assistant', content: '{"reply":"Stay with the freeze. What does it want?","readyToGenerate":false}' },
    ]),
  });
  assert.match(text, /Dad pattern/);
  assert.match(text, /permission loop/);
  assert.match(text, /You: I freeze when he calls/);
  assert.match(text, /Coach: Stay with the freeze/);
  assert.doesNotMatch(text, /readyToGenerate/);
});

test('excerptAroundMatches windows around the first hit', () => {
  const body = `${'a'.repeat(400)} permission ${'b'.repeat(400)}`;
  const out = excerptAroundMatches(body, ['permission'], 120);
  assert.match(out, /permission/);
  assert.ok(out.startsWith('…'));
  assert.ok(out.endsWith('…'));
});

const sessions = [
  {
    id: 's-dad',
    title: 'Permission from dad',
    session_type: 'general_chat',
    date_key: '2026-08-12',
    chat_summary: 'The presenting issue is the boss; the ocean floor is dad.',
    chat_messages: JSON.stringify([
      { role: 'user', content: 'My boss never gives me permission to ship.' },
      { role: 'assistant', content: 'This is not about your boss. This is about your dad.' },
    ]),
  },
  {
    id: 's-prices',
    title: 'Raise prices',
    session_type: 'daily_hypnosis',
    date_key: '2026-09-03',
    chat_summary: 'Pricing as a worthiness test.',
    chat_messages: JSON.stringify([
      { role: 'user', content: 'I want to raise my prices.' },
    ]),
  },
];

test('retrieveConversationChunks returns the matching session, not the unrelated one', () => {
  const out = retrieveConversationChunks('what did we land on about my dad and permission', sessions);
  assert.equal(out.length, 1);
  assert.equal(out[0].source, 'conversation:s-dad');
  assert.equal(out[0].filename, 'Permission from dad');
  assert.match(out[0].text, /dad/i);
});

test('retrieveConversationChunks falls back to recent sessions for a vague question', () => {
  const out = retrieveConversationChunks('what have we been talking about', sessions, { topK: 6 });
  assert.equal(out.length, 2);
  assert.equal(out[0].source, 'conversation:s-dad');
});

test('retrieveConversationChunks returns empty when there is nothing to search', () => {
  assert.deepEqual(retrieveConversationChunks('dad permission', []), []);
  assert.deepEqual(retrieveConversationChunks('dad permission', null), []);
});
