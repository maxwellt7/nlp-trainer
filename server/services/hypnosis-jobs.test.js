import test from 'node:test';
import assert from 'node:assert/strict';

import db from '../db/index.js';
import {
  createJob,
  getJob,
  setJobRunning,
  setJobComplete,
  setJobFailed,
  getActiveJobForSession,
} from './hypnosis-jobs.js';

function cleanupUser(userId) {
  db.prepare('DELETE FROM hypnosis_jobs WHERE user_id = ?').run(userId);
}

test('createJob returns a queued job and getJob hydrates ownership-checked', () => {
  const userId = `test-user-jobs-${Date.now()}`;
  cleanupUser(userId);

  const j = createJob(userId, 'session-A');
  assert.match(j.id, /^job-/);
  assert.equal(j.status, 'queued');

  const fetched = getJob(j.id, userId);
  assert.equal(fetched.status, 'queued');
  assert.equal(fetched.sessionId, 'session-A');
  assert.equal(fetched.result, null);
  assert.equal(fetched.error, null);
});

test('getJob returns null for jobs not owned by the requesting user', () => {
  const ownerId = `test-user-owner-${Date.now()}`;
  const intruderId = `test-user-intruder-${Date.now()}`;
  cleanupUser(ownerId);
  cleanupUser(intruderId);

  const j = createJob(ownerId, 'session-X');
  assert.equal(getJob(j.id, intruderId), null);
  assert.equal(getJob(j.id, ownerId).id, j.id);
});

test('setJobRunning and setJobComplete progress the state machine + persist result', () => {
  const userId = `test-user-progress-${Date.now()}`;
  cleanupUser(userId);

  const j = createJob(userId, 'session-Y');
  setJobRunning(j.id);
  assert.equal(getJob(j.id, userId).status, 'running');

  const result = { script: 'hello', title: 'T', estimatedMinutes: 20 };
  setJobComplete(j.id, result);
  const final = getJob(j.id, userId);
  assert.equal(final.status, 'complete');
  assert.deepEqual(final.result, result);
});

test('setJobFailed records the error message', () => {
  const userId = `test-user-fail-${Date.now()}`;
  cleanupUser(userId);

  const j = createJob(userId, 'session-Z');
  setJobFailed(j.id, 'LLM timed out');
  const final = getJob(j.id, userId);
  assert.equal(final.status, 'failed');
  assert.equal(final.error, 'LLM timed out');
});

test('getActiveJobForSession returns the latest non-terminal job for that session', () => {
  const userId = `test-user-active-${Date.now()}`;
  cleanupUser(userId);

  const oldDone = createJob(userId, 'session-Q');
  setJobComplete(oldDone.id, { script: 'old' });

  const active = createJob(userId, 'session-Q');
  setJobRunning(active.id);

  const found = getActiveJobForSession(userId, 'session-Q');
  assert.equal(found.id, active.id);
  assert.equal(found.status, 'running');

  // Different session should not find it
  assert.equal(getActiveJobForSession(userId, 'other-session'), null);
});

test('getActiveJobForSession returns null when no active job', () => {
  const userId = `test-user-noactive-${Date.now()}`;
  cleanupUser(userId);

  const j = createJob(userId, 'session-R');
  setJobComplete(j.id, { script: 'done' });

  assert.equal(getActiveJobForSession(userId, 'session-R'), null);
});

test('stale running jobs (>5 min since update) are auto-promoted to failed on read', () => {
  const userId = `test-user-stale-${Date.now()}`;
  cleanupUser(userId);

  const j = createJob(userId, 'session-S');
  setJobRunning(j.id);

  // Manually backdate updated_at to 6 minutes ago
  db.prepare("UPDATE hypnosis_jobs SET updated_at = datetime('now', '-6 minutes') WHERE id = ?").run(j.id);

  const result = getJob(j.id, userId);
  assert.equal(result.status, 'failed');
  assert.match(result.error || '', /timed out/i);
});
