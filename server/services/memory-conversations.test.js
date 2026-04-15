import test from 'node:test';
import assert from 'node:assert/strict';

import db from '../db/index.js';
import {
  createConversationSession,
  createSession,
  getSession,
  getSidebarSessions,
  markHypnosisGenerated,
} from './memory.js';

function cleanupUser(userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

test('general conversations remain unlocked while storing user-specific sidebar metadata', () => {
  const userId = `test-user-general-${Date.now()}`;
  cleanupUser(userId);

  const created = createConversationSession(userId, {
    sessionType: 'general_chat',
    title: 'Money resistance breakthrough',
  });

  const session = getSession(created.id);
  assert.equal(session.user_id, userId);
  assert.equal(session.session_type, 'general_chat');
  assert.equal(session.session_status, 'active');
  assert.equal(session.title, 'Money resistance breakthrough');
  assert.equal(session.locked_at, null);

  const sidebar = getSidebarSessions(userId, 10, 0);
  assert.equal(sidebar.length, 1);
  assert.equal(sidebar[0].session_type, 'general_chat');
  assert.equal(sidebar[0].session_status, 'active');
  assert.equal(sidebar[0].title, 'Money resistance breakthrough');
  assert.ok(sidebar[0].last_message_at);

  cleanupUser(userId);
});

test('daily hypnosis sessions can still be created through the existing helper', () => {
  const userId = `test-user-daily-${Date.now()}`;
  cleanupUser(userId);

  const created = createSession(userId, 7);
  const session = getSession(created.id);

  assert.equal(session.user_id, userId);
  assert.equal(session.session_type, 'daily_hypnosis');
  assert.equal(session.session_status, 'active');
  assert.equal(session.mood_before, 7);

  cleanupUser(userId);
});

test('hypnosis generation locks only daily hypnosis sessions', () => {
  const userId = `test-user-locking-${Date.now()}`;
  cleanupUser(userId);

  const general = createConversationSession(userId, {
    sessionType: 'general_chat',
    title: 'Confidence chat',
  });
  const daily = createSession(userId, 5);

  markHypnosisGenerated(general.id, { scriptId: 'script-general-1' });
  markHypnosisGenerated(daily.id, { scriptId: 'script-daily-1' });

  const generalSession = getSession(general.id);
  const dailySession = getSession(daily.id);

  assert.ok(generalSession.hypnosis_generated_at);
  assert.equal(generalSession.session_status, 'hypnosis_generated');
  assert.equal(generalSession.locked_at, null);
  assert.equal(generalSession.script_id, 'script-general-1');

  assert.ok(dailySession.hypnosis_generated_at);
  assert.equal(dailySession.session_status, 'locked');
  assert.ok(dailySession.locked_at);
  assert.equal(dailySession.script_id, 'script-daily-1');

  cleanupUser(userId);
});
