// Periodic Dropbox → Pinecone sync.
//
// Polls every KB_SYNC_INTERVAL_MINUTES (default 30). Skips silently if
// Dropbox or Pinecone aren't configured, so a partially-set-up environment
// doesn't crash the boot.

import cron from 'node-cron';
import { isConfigured as dropboxConfigured, runSyncOnce } from './dropbox-sync.js';
import { isEnabled as kbEnabled } from './knowledge-base.js';

const DEFAULT_INTERVAL_MIN = 30;

function intervalToCron(minutes) {
  const m = Math.max(5, Math.min(720, Number(minutes) || DEFAULT_INTERVAL_MIN));
  // Run at the top of every Nth minute, chosen so the schedule actually
  // ticks rather than waiting on a divisible boundary that may not exist.
  if (m === 60) return '0 * * * *';
  if (m % 60 === 0) return `0 */${m / 60} * * *`;
  return `*/${m} * * * *`;
}

let started = false;

export function initKnowledgeBaseScheduler() {
  if (started) return;
  if (!dropboxConfigured() || !kbEnabled()) {
    console.log('[KB Scheduler] disabled — Dropbox or Pinecone not configured');
    return;
  }

  const expr = intervalToCron(process.env.KB_SYNC_INTERVAL_MINUTES);
  console.log(`[KB Scheduler] cron registered: ${expr}`);

  cron.schedule(expr, async () => {
    try {
      const summary = await runSyncOnce();
      console.log('[KB Scheduler] tick complete:', JSON.stringify(summary));
    } catch (err) {
      console.error('[KB Scheduler] tick failed:', err.message);
    }
  });

  // Also run once on startup so the index reflects current state.
  setImmediate(async () => {
    try {
      const summary = await runSyncOnce();
      console.log('[KB Scheduler] startup sync:', JSON.stringify(summary));
    } catch (err) {
      console.error('[KB Scheduler] startup sync failed:', err.message);
    }
  });

  started = true;
}
