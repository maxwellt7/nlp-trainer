import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (...p) => fs.readFileSync(path.resolve(__dirname, '..', 'src', ...p), 'utf8');

// Regression: after a deploy, an installed PWA's stale service worker can serve
// dynamic-import chunk hashes that no longer exist, white-screening the lazy
// route (e.g. /ask). Recovery must clear the SW + caches and reload, and it must
// be wired into both Vite's preload-error hook and the route error boundary.
test('recoverFromStalePwa unregisters the SW and clears caches before reloading', () => {
  const src = read('lib', 'pwaRecovery.ts');
  assert.match(src, /serviceWorker[\s\S]*getRegistrations[\s\S]*unregister/, 'must unregister service workers');
  assert.match(src, /caches\.keys\(\)[\s\S]*caches\.delete/, 'must clear all caches');
  assert.match(src, /window\.location\.reload\(\)/, 'must hard-reload');
  assert.match(src, /force/, 'must support a force flag for user-initiated retries (bypasses the loop guard)');
});

test('vite preload-error is handled at boot to self-heal a stale chunk', () => {
  const src = read('main.tsx');
  assert.match(src, /vite:preloadError/, 'must listen for Vite preload errors');
  assert.match(src, /recoverFromStalePwa/, 'must recover on preload error');
});

test('the route error boundary recovers stale chunks via the SW-clearing path', () => {
  const src = read('components', 'RouteErrorBoundary.tsx');
  assert.match(src, /recoverFromStalePwa/, 'chunk errors must clear the SW, not just reload');
});

test('the one-time PWA reset version was bumped to unstick already-broken clients', () => {
  const src = read('main.tsx');
  const m = src.match(/PWA_RESET_VERSION = '([^']+)'/);
  assert.ok(m, 'PWA_RESET_VERSION must be defined');
  assert.notEqual(m[1], '2026-04-16-v1', 'must be bumped past the old version so clients re-run the reset');
});
