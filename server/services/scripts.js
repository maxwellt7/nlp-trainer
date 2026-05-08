// Script storage helpers, factored out so the hypnosis-generate background
// job can save the stitched script directly without going through HTTP.
//
// Scripts are persisted as one JSON file per script in the same directory
// audio.js uses. We keep that interface stable so /audio/scripts and
// /audio/generate-audio/:scriptId continue to work unchanged.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const storageRoot = existsSync('/app/storage')
  ? '/app/storage'
  : process.env.VERCEL
    ? '/tmp/alignment-engine'
    : join(__dirname, '..', 'data');
const scriptsDir = join(storageRoot, 'scripts');

const ensureDir = (p) => {
  try {
    if (!existsSync(p)) mkdirSync(p, { recursive: true });
  } catch (err) {
    console.warn('scripts.js: cannot create', p, '-', err.message);
  }
};
ensureDir(scriptsDir);

export function scriptPath(id) {
  return join(scriptsDir, `${id}.json`);
}

export function getScriptsDir() {
  return scriptsDir;
}

/**
 * Persist a script for a given user. Returns the saved record.
 * Caller controls the id; if omitted, generates `script-${Date.now()}`.
 */
export function saveScriptForUser({ userId, title, duration, estimatedMinutes, script, id = null }) {
  if (!userId) throw new Error('saveScriptForUser: userId is required');
  if (!title || typeof title !== 'string') throw new Error('saveScriptForUser: title is required and must be a string');
  if (!script || typeof script !== 'string') throw new Error('saveScriptForUser: script is required and must be a string');

  const scriptId = id || `script-${Date.now()}`;
  const data = {
    id: scriptId,
    userId,
    title,
    duration: duration || 'full',
    estimatedMinutes: estimatedMinutes || 20,
    script,
    audioFile: null,
    createdAt: new Date().toISOString(),
  };
  ensureDir(scriptsDir);
  writeFileSync(scriptPath(scriptId), JSON.stringify(data, null, 2));
  return data;
}

export function readScript(id) {
  if (!existsSync(scriptPath(id))) return null;
  try {
    return JSON.parse(readFileSync(scriptPath(id), 'utf-8'));
  } catch (err) {
    console.warn('readScript: failed to parse', id, '-', err.message);
    return null;
  }
}
