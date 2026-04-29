import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const apiFile = readFileSync(join(process.cwd(), 'src/services/api.ts'), 'utf8');
const hypnosisRoutes = readFileSync(join(process.cwd(), 'server/routes/hypnosis.js'), 'utf8');
const profileRoutes = readFileSync(join(process.cwd(), 'server/routes/profile.js'), 'utf8');
const profileService = readFileSync(join(process.cwd(), 'server/services/profile.js'), 'utf8');
const timezoneServicePath = join(process.cwd(), 'server/services/timezone.js');

assert(
  apiFile.includes('X-User-Timezone'),
  'Frontend API requests must send an X-User-Timezone header so the server can align sessions to the user\'s local day.'
);

assert(
  existsSync(timezoneServicePath),
  'A dedicated timezone service should exist so local-day calculations are centralized and testable.'
);

if (existsSync(timezoneServicePath)) {
  const { getDateKeyForTimezone, normalizeTimezone } = await import(`file://${timezoneServicePath}`);

  assert(
    normalizeTimezone('America/Los_Angeles') === 'America/Los_Angeles',
    'The timezone service must accept valid IANA timezone names.'
  );

  const sampleInstant = new Date('2026-04-28T01:30:00.000Z');
  assert(
    getDateKeyForTimezone('UTC', sampleInstant) === '2026-04-28',
    'UTC date-key derivation must preserve the UTC calendar day.'
  );
  assert(
    getDateKeyForTimezone('America/Los_Angeles', sampleInstant) === '2026-04-27',
    'Timezone-aware date-key derivation must shift to the user\'s local calendar day when appropriate.'
  );
}

assert(
  /getTodaySession\(userId,\s*effectiveTimezone\)/.test(hypnosisRoutes) ||
    /getTodaySession\(userId,\s*userTimezone\)/.test(hypnosisRoutes),
  'Daily-session init/chat routes must resolve today\'s session using the user\'s timezone, not the server default.'
);

assert(
  /updateStreak\(userId,\s*effectiveTimezone\)/.test(hypnosisRoutes) ||
    /updateStreak\(userId,\s*userTimezone\)/.test(hypnosisRoutes),
  'Streak updates must use the same user timezone as daily-session lookup.'
);

assert(
  /getTodaySession\(userId,\s*effectiveTimezone\)/.test(profileRoutes) ||
    /getTodaySession\(userId,\s*userTimezone\)/.test(profileRoutes),
  'Profile/dashboard state must compute today\'s session in the user\'s timezone.'
);

assert(
  profileService.includes('setUserTimezone') && profileService.includes('getUserTimezone'),
  'User timezone should be persisted server-side so daily-session alignment survives refreshes and future requests.'
);

console.log('Timezone alignment checks passed.');
