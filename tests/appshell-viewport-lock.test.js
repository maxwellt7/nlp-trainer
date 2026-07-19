import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'components', 'rd', 'AppShell.tsx'),
  'utf8'
);

// Regression: on Max's installed iOS PWA the whole layout viewport panned up
// (keyboard residue / overscroll), leaving the bottom nav floating above a
// dead black band at the bottom of the phone. AppShell must lock document
// scrolling while mounted and snap the viewport back when the keyboard closes.
test('AppShell locks document-level scrolling while mounted', () => {
  assert.match(src, /document\.documentElement/, 'must reach the html element');
  assert.match(src, /overflow = 'hidden'/, 'must set overflow hidden on html/body');
  assert.match(src, /prevHtml|prev/, 'must restore previous overflow on unmount (sign-in/legal pages scroll normally)');
});

test('AppShell sizes standalone from the large viewport (100lvh), not innerHeight/dvh', () => {
  // Confirmed on-device 2026-07-19: screen 874, innerHeight 812, dvh 812,
  // safeTop 62 — the stuck standalone layout viewport excludes the top safe
  // area but takes it off the bottom. Only 100lvh still reported 874, so the
  // shell must size to max(innerHeight, lvh) when standalone.
  assert.match(src, /100lvh/, 'must probe the large viewport height');
  assert.match(src, /Math\.max\(window\.innerHeight, lvh\)/, 'standalone height must be the larger of innerHeight and lvh');
  assert.match(src, /display-mode: standalone/, 'lvh sizing must be standalone-only (browser tabs have real chrome)');
  assert.match(src, /--app-height/, 'must publish the result as the --app-height CSS var');
  assert.match(src, /var\(--app-height, 100dvh\)/, 'shell height must consume the var with a dvh fallback');
});

test('full-screen overlays follow --app-height instead of inset:0', () => {
  // In the stuck state, position:fixed inset:0 sizes to the short layout
  // viewport, so every overlay would leave the same dead band.
  for (const file of ['components/rd/ChooserSheet.tsx', 'pages/rd/VoiceSession.tsx', 'pages/rd/Player.tsx', 'pages/rd/GoalDetail.tsx', 'pages/rd/GoalEditor.tsx']) {
    const overlaySrc = fs.readFileSync(path.resolve(__dirname, '..', 'src', file), 'utf8');
    assert.match(overlaySrc, /var\(--app-height, 100dvh\)/, `${file} must size its overlay from --app-height`);
  }
});

test('AppShell snaps the panned viewport back to 0 when the keyboard is closed', () => {
  assert.match(src, /window\.scrollTo\(0, 0\)/, 'must scroll the window back to origin');
  assert.match(src, /visualViewport/, 'must watch visualViewport to avoid fighting the open keyboard');
  assert.match(src, /focusout/, 'must re-pin after inputs blur');
});

test('the full-bleed chat header clears the status bar', () => {
  // The chat page is the one full-bleed view without Screen.tsx's safe-area
  // padding — its History button and title collided with the iOS clock.
  const hypnosisSrc = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'pages', 'Hypnosis.tsx'), 'utf8');
  const matches = hypnosisSrc.match(/safe-area-inset-top/g) || [];
  assert.ok(matches.length >= 2, 'both the chat header and the mobile history drawer header must pad for env(safe-area-inset-top)');
});
