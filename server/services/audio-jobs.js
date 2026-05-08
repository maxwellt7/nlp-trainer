// Audio generation job lifecycle.
//
// /audio/generate-audio/:scriptId is asynchronous: rendering a 2500-word
// script through ElevenLabs (chunked TTS + silence files + ffmpeg concat +
// optional music mix) routinely takes 30-90 seconds, long enough that
// mobile backgrounding kills the synchronous HTTP fetch. Same pattern we
// use for hypnosis script generation.
//
// State machine:
//   queued -> running -> complete
//                     \-> failed
//
// Idempotent per (userId, scriptId): if a non-terminal job already exists
// for that pair we return the existing one rather than starting a duplicate
// ElevenLabs render (which would also overwrite each other's temp files).

import db from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

const STALE_AFTER_MS = 10 * 60 * 1000; // 10 minutes — generous for big scripts

function ensureTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audio_jobs (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      script_id       TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'queued',
      result_json     TEXT DEFAULT NULL,
      error_message   TEXT DEFAULT NULL,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audio_jobs_user_script ON audio_jobs(user_id, script_id);
  `);
}
ensureTable();

export function createJob(userId, scriptId) {
  const id = `audio-job-${uuidv4()}`;
  db.prepare(
    'INSERT INTO audio_jobs (id, user_id, script_id, status) VALUES (?, ?, ?, ?)'
  ).run(id, userId, scriptId, 'queued');
  return { id, user_id: userId, script_id: scriptId, status: 'queued' };
}

export function setJobRunning(jobId) {
  db.prepare(
    "UPDATE audio_jobs SET status = 'running', updated_at = datetime('now') WHERE id = ?"
  ).run(jobId);
}

export function setJobComplete(jobId, result) {
  db.prepare(
    "UPDATE audio_jobs SET status = 'complete', result_json = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(JSON.stringify(result), jobId);
}

export function setJobFailed(jobId, errorMessage) {
  db.prepare(
    "UPDATE audio_jobs SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(String(errorMessage || 'unknown error').slice(0, 1000), jobId);
}

function isStale(row) {
  if (row.status !== 'running' && row.status !== 'queued') return false;
  const updated = new Date(row.updated_at + 'Z').getTime();
  if (!Number.isFinite(updated)) return false;
  return Date.now() - updated > STALE_AFTER_MS;
}

export function getJob(jobId, userId) {
  const row = db.prepare('SELECT * FROM audio_jobs WHERE id = ? AND user_id = ?').get(jobId, userId);
  if (!row) return null;

  if (isStale(row)) {
    db.prepare(
      "UPDATE audio_jobs SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?"
    ).run('Audio generation timed out; please try again.', row.id);
    row.status = 'failed';
    row.error_message = 'Audio generation timed out; please try again.';
  }

  let result = null;
  if (row.result_json) {
    try { result = JSON.parse(row.result_json); }
    catch (err) { console.warn('audio-jobs: failed to parse result_json', err.message); }
  }

  return {
    id: row.id,
    scriptId: row.script_id,
    status: row.status,
    result,
    error: row.error_message || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getActiveJobForScript(userId, scriptId) {
  const row = db.prepare(
    "SELECT * FROM audio_jobs WHERE user_id = ? AND script_id = ? AND status IN ('queued','running') ORDER BY created_at DESC LIMIT 1"
  ).get(userId, scriptId);
  if (!row) return null;
  return getJob(row.id, userId);
}
