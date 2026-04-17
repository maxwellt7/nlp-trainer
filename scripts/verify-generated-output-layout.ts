import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const hypnosisPath = path.resolve('src/pages/Hypnosis.tsx');
const source = fs.readFileSync(hypnosisPath, 'utf8');

assert.match(
  source,
  /const hasGeneratedOutputReview = Boolean\(scriptResult\) && isSelectedLocked;/,
  'The page should explicitly detect the locked generated-session review mode so mobile layout can switch out of the live-chat shell only when needed.',
);

assert.match(
  source,
  /<div className=\{hasGeneratedOutputReview \? ['"]flex-1 min-h-0 overflow-y-auto['"] : ['"]contents['"]\}>/,
  'When a locked generated session is being reviewed, the transcript and output should share a unified scroll container instead of rendering as separate flex siblings.',
);

assert.match(
  source,
  /<div ref=\{messagesRef\} className=\{hasGeneratedOutputReview \? ['"]px-3 sm:px-5 py-3 sm:py-4 space-y-3['"] : ['"]flex-1 min-h-0 overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 space-y-3['"]\}>/,
  'The message list must stop claiming flex-1 scroll space during locked generated-session review mode, or the post-chat mobile view collapses into a clipped strip.',
);

console.log('Generated output layout regression check passed.');
