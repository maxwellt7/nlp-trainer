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

test('AppShell drives its height from window.innerHeight, not a trusted 100dvh', () => {
  // iOS standalone can get stuck reporting a shrunken 100dvh — the shell then
  // honestly ends ~80pt above the physical bottom (the dead band Max saw even
  // after the scroll-pin fix). innerHeight reports the true span.
  assert.match(src, /window\.innerHeight/, 'must measure the real viewport');
  assert.match(src, /--app-height/, 'must publish it as the --app-height CSS var');
  assert.match(src, /var\(--app-height, 100dvh\)/, 'shell height must consume the var with a dvh fallback');
});

test('AppShell snaps the panned viewport back to 0 when the keyboard is closed', () => {
  assert.match(src, /window\.scrollTo\(0, 0\)/, 'must scroll the window back to origin');
  assert.match(src, /visualViewport/, 'must watch visualViewport to avoid fighting the open keyboard');
  assert.match(src, /focusout/, 'must re-pin after inputs blur');
});
