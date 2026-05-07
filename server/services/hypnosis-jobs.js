// Hypnosis generation job lifecycle.
//
// /hypnosis/generate is asynchronous: a 4-call chunked generation takes 60-90s,
// long enough that mobile backgrounding, network blips, or screen lock kill the
// HTTP request. The route now creates a job row, returns the jobId immediately,
// and runs the work in the background. The frontend polls
// /hypnosis/generate-status/:jobId until the job is in a terminal state.
//
// State machine:
//   queued -> running -> complete
//                     \-> failed
//
// Jobs older than STALE_AFTER_MS that are still in 'running' are considered
// dead (server probably restarted mid-job) and reported as failed on read.

import db from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

const STALE_AFTER_MS = 5 * 60 * 1000; // 5 minutes — generous for 4 sequential LLM calls

export function createJob(userId, sessionId) {
  const id = `job-${uuidv4()}`;
  db.prepare(
    'INSERT INTO hypnosis_jobs (id, user_id, session_id, status) VALUES (?, ?, ?, ?)'
  ).run(id, userId, sessionId, 'queued');
  return { id, user_id: userId, session_id: sessionId, status: 'queued' };
}

export function setJobRunning(jobId) {
  db.prepare(
    "UPDATE hypnosis_jobs SET status = 'running', updated_at = datetime('now') WHERE id = ?"
  ).run(jobId);
}

export function setJobComplete(jobId, result) {
  db.prepare(
    "UPDATE hypnosis_jobs SET status = 'complete', result_json = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(JSON.stringify(result), jobId);
}

export function setJobFailed(jobId, errorMessage) {
  db.prepare(
    "UPDATE hypnosis_jobs SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(String(errorMessage || 'unknown error').slice(0, 1000), jobId);
}

function isStale(row) {
  if (row.status !== 'running' && row.status !== 'queued') return false;
  const updated = new Date(row.updated_at + 'Z').getTime();
  if (!Number.isFinite(updated)) return false;
  return Date.now() - updated > STALE_AFTER_MS;
}

export function getJob(jobId, userId) {
  const row = db.prepare('SELECT * FROM hypnosis_jobs WHERE id = ? AND user_id = ?').get(jobId, userId);
  if (!row) return null;

  if (isStale(row)) {
    // Server probably crashed mid-job — promote to failed so the client stops polling.
    db.prepare(
      "UPDATE hypnosis_jobs SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?"
    ).run('Generation timed out; please try again.', row.id);
    row.status = 'failed';
    row.error_message = 'Generation timed out; please try again.';
  }

  let result = null;
  if (row.result_json) {
    try { result = JSON.parse(row.result_json); }
    catch (err) { console.warn('hypnosis-jobs: failed to parse result_json', err.message); }
  }

  return {
    id: row.id,
    sessionId: row.session_id,
    status: row.status,
    result,
    error: row.error_message || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Most recent non-terminal job for a user/session, if any. Used by the frontend
 * to recover polling after a refresh — "do I have a generation in flight?"
 */
export function getActiveJobForSession(userId, sessionId) {
  const row = db.prepare(
    "SELECT * FROM hypnosis_jobs WHERE user_id = ? AND session_id = ? AND status IN ('queued','running') ORDER BY created_at DESC LIMIT 1"
  ).get(userId, sessionId);
  if (!row) return null;
  return getJob(row.id, userId); // routes through stale-check
}
