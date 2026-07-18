import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (...segments) => fs.readFileSync(path.resolve(__dirname, '..', ...segments), 'utf8');

const bottomNavSource = read('src', 'components', 'rd', 'BottomNav.tsx');
const homeSource = read('src', 'pages', 'rd', 'Home.tsx');
const hypnosisSource = read('src', 'pages', 'Hypnosis.tsx');

// The regression: navigating to bare /hypnosis makes the bootstrap fall back to
// "load most recent conversation", which resurfaces a previous day's daily
// session instead of starting today's. Every "Daily Session" entry point must
// carry the explicit launch intent.
test('bottom-nav chooser launches the daily session with an explicit mode', () => {
  assert.match(
    bottomNavSource,
    /\/hypnosis\?mode=daily/,
    'The center-button chooser must navigate to /hypnosis?mode=daily so the bootstrap starts today\'s session instead of loading the most recent conversation'
  );
  assert.doesNotMatch(
    bottomNavSource,
    /navigate\(\s*['"]\/hypnosis['"]\s*\)/,
    'BottomNav must not navigate to bare /hypnosis'
  );
});

test('home "Begin" CTA launches the daily session with an explicit mode', () => {
  assert.match(
    homeSource,
    /\/hypnosis\?mode=daily/,
    'The Home CTA must navigate to /hypnosis?mode=daily'
  );
  assert.doesNotMatch(
    homeSource,
    /navigate\(\s*['"]\/hypnosis['"]\s*\)/,
    'Home must not navigate to bare /hypnosis'
  );
});

test('hypnosis workspace reacts to repeat in-app navigations, not just pathname changes', () => {
  // Re-picking "Daily Session" from the chooser while already on /hypnosis (for
  // example after opening an old reflection via ?sessionId=...) pushes a new
  // history entry with the same pathname. An effect keyed only on
  // location.pathname never fires for it, so the stale conversation stays on
  // screen. The route-intent effect must key on location.key.
  assert.match(
    hypnosisSource,
    /\[\s*location\.key/,
    'The route-change effect must depend on location.key so same-path navigations (e.g. /hypnosis?mode=daily while on /hypnosis) are handled'
  );
});
