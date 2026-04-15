import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const apiSource = fs.readFileSync(new URL('../src/services/api.ts', import.meta.url), 'utf8');
const pageSource = fs.readFileSync(new URL('../src/pages/Hypnosis.tsx', import.meta.url), 'utf8');

test('api client supports typed hypnosis session init and chat payloads', () => {
  assert.match(apiSource, /hypnosisInit:\s*\(options\?:\s*\{[\s\S]*?\}\)\s*=>/);
 assert.match(apiSource, /body:\s*JSON\.stringify\(options\s*\?\?\s*{}\)/);
  assert.match(apiSource, /hypnosisChat:\s*\(messages:\s*any\[\],\s*sessionId\?:\s*string,\s*moodBefore\?:\s*number,\s*sessionType\?:\s*string,\s*title\?:\s*string\)/);
  assert.match(apiSource, /JSON\.stringify\(\{\s*messages,\s*sessionId,\s*moodBefore,\s*sessionType,\s*title\s*\}\)/);
});

test('hypnosis workspace tracks a unified conversation list and selected conversation metadata', () => {
  assert.match(pageSource, /const \[conversations, setConversations\] = useState/);
  assert.match(pageSource, /const \[selectedConversationId, setSelectedConversationId\] = useState/);
  assert.match(pageSource, /api\.getSessions\(/);
  assert.match(pageSource, /api\.getSession\(/);
  assert.match(pageSource, /New Chat/);
  assert.match(pageSource, /Daily Session/);
});

test('hypnosis workspace renders hypnosis milestones in-thread and only locks daily sessions', () => {
  assert.match(pageSource, /eventType === 'hypnosis_generated'/);
  assert.match(pageSource, /Hypnosis Generated/);
  assert.match(pageSource, /selectedSession\?\.session_type === 'daily_hypnosis'/);
  assert.match(pageSource, /selectedSession\?\.is_locked/);
  assert.doesNotMatch(pageSource, /Today's Session is Done/);
});

test('composer remains button-submitted and does not auto-submit with Enter shortcuts', () => {
  assert.match(pageSource, /<button type="submit"/);
  assert.doesNotMatch(pageSource, /onKeyDown=.*Enter/);
});
