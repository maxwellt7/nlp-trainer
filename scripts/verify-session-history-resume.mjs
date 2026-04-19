import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const sessionsPage = readFileSync(join(process.cwd(), 'src/pages/Sessions.tsx'), 'utf8');
const launchHelper = readFileSync(join(process.cwd(), 'src/pages/hypnosisLaunch.ts'), 'utf8');

assert(
  sessionsPage.includes("to={`/hypnosis?sessionId=${s.id}`}") ||
    sessionsPage.includes("navigate(`/hypnosis?sessionId=${s.id}`)") ||
    sessionsPage.includes("navigate('/hypnosis?sessionId=' + s.id)"),
  'Session history cards must provide an explicit resume path to /hypnosis?sessionId=<id>.'
);

assert(
  /params\.get\('sessionId'\)|params\.get\("sessionId"\)/.test(launchHelper),
  'Hypnosis launch resolution must read sessionId from the query string.'
);

assert(
  /action:\s*'load'[\s\S]*sessionId:\s*requestedSessionId/.test(launchHelper) ||
    /const requestedSessionId = params\.get\('sessionId'\)[\s\S]*action:\s*'load'[\s\S]*sessionId:\s*requestedSessionId/.test(launchHelper) ||
    /const requestedSessionId = params\.get\("sessionId"\)[\s\S]*action:\s*'load'[\s\S]*sessionId:\s*requestedSessionId/.test(launchHelper),
  'When sessionId is present, the launch helper must load that specific conversation instead of defaulting to the most recent one.'
);

console.log('Session history resume checks passed.');
