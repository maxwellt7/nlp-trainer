import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const hypnosisPath = path.resolve('src/pages/Hypnosis.tsx');
const layoutPath = path.resolve('src/components/Layout.tsx');

const hypnosisSource = fs.readFileSync(hypnosisPath, 'utf8');
const layoutSource = fs.readFileSync(layoutPath, 'utf8');

assert.match(
  layoutSource,
  /height:\s*'100dvh'/,
  'The authenticated shell should own the viewport height for mobile pages.',
);

assert.doesNotMatch(
  hypnosisSource,
  /className="relative flex h-\[100dvh\] max-h-\[100dvh\] min-h-0 overflow-hidden lg:h-full lg:max-h-none"/,
  'Hypnosis.tsx must not claim its own mobile 100dvh shell inside the authenticated layout, or the composer can be clipped below the viewport.',
);

console.log('Mobile composer layout regression check passed.');
