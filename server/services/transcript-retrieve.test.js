// Tests for transcript-retrieve.js
// These tests use fixtures from __fixtures__/transcripts/ to avoid polluting production data

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { tokenizeQuery, scoreText, excerptAroundMatches } from '../services/conversation-retrieve.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '__fixtures__', 'transcripts');

// Load fixture data for testing
function loadFixtures() {
  const content = readFileSync(join(FIXTURES_DIR, '2026-10-15.json'), 'utf-8');
  const meetings = JSON.parse(content);
  return meetings.map(m => ({ ...m, date: '2026-10-15' }));
}

// Replicate the core retrieval logic for testing
function retrieveFromFixtures(query, meetings, { topK = 4, minScore = 0.30 } = {}) {
  const terms = tokenizeQuery(query);
  if (terms.length === 0) return [];
  
  const scored = [];
  for (const meeting of meetings) {
    const text = [
      meeting.program && `Program: ${meeting.program}`,
      meeting.title && `Title: ${meeting.title}`,
      meeting.summary,
      meeting.transcript_text,
    ].filter(Boolean).join('\n');
    
    const score = scoreText(text, terms);
    if (score < minScore) continue;
    
    scored.push({
      source: `transcript:${meeting.meeting_id}`,
      filename: `${meeting.program} — ${meeting.title}`,
      text: excerptAroundMatches(text, terms, 1200),
      score,
    });
  }
  
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

describe('Transcript Retrieval (Fixtures)', () => {
  const fixtures = loadFixtures();
  
  it('should load fixture transcripts', () => {
    assert.ok(Array.isArray(fixtures), 'Fixtures should be an array');
    assert.ok(fixtures.length > 0, 'Should have at least one fixture');
    
    const first = fixtures[0];
    assert.ok(first.meeting_id, 'Should have meeting_id');
    assert.ok(first.title, 'Should have title');
    assert.ok(first.program, 'Should have program');
    assert.ok(first.transcript_text, 'Should have transcript_text');
  });

  it('should retrieve relevant chunks for identity-related query', () => {
    const chunks = retrieveFromFixtures('identity beliefs limiting self-fulfilling', fixtures, { topK: 4 });
    
    assert.ok(Array.isArray(chunks), 'Should return an array');
    assert.ok(chunks.length > 0, 'Should find matches for identity query');
    
    const chunk = chunks[0];
    assert.ok(chunk.source, 'Chunk should have source');
    assert.ok(chunk.filename, 'Chunk should have filename');
    assert.ok(chunk.text, 'Chunk should have text');
    assert.ok(typeof chunk.score === 'number', 'Chunk should have numeric score');
    assert.ok(chunk.source.startsWith('transcript:'), 'Source should be prefixed with transcript:');
  });

  it('should retrieve chunks for parts work query', () => {
    const chunks = retrieveFromFixtures('parts conflict inner self protective strategy', fixtures, { topK: 4 });
    
    assert.ok(Array.isArray(chunks), 'Should return an array');
    assert.ok(chunks.length > 0, 'Should find matches for parts work query');
    
    // Should find the Inner World Mastery meeting about parts work
    const partsChunk = chunks.find(c => c.text.toLowerCase().includes('parts'));
    assert.ok(partsChunk, 'Should find parts work content');
    assert.ok(partsChunk.filename.includes('Inner World Mastery'), 'Should identify program in filename');
    assert.ok(partsChunk.text.length <= 1300, 'Should limit excerpt length');
  });

  it('should return empty array for non-matching query', () => {
    const chunks = retrieveFromFixtures('quantum physics thermodynamics entropy', fixtures, { topK: 4 });
    assert.ok(Array.isArray(chunks), 'Should return an array');
    assert.equal(chunks.length, 0, 'Should return no matches for unrelated query');
  });

  it('should respect topK limit', () => {
    const chunks = retrieveFromFixtures('identity beliefs parts work', fixtures, { topK: 1 });
    assert.ok(chunks.length <= 1, 'Should respect topK=1 limit');
  });

  it('should respect minScore threshold', () => {
    const chunks = retrieveFromFixtures('identity', fixtures, { minScore: 0.40 });
    
    for (const chunk of chunks) {
      assert.ok(chunk.score >= 0.40, `Score ${chunk.score} should be >= 0.40`);
    }
  });

  it('should handle empty query gracefully', () => {
    const chunks = retrieveFromFixtures('', fixtures, { topK: 4 });
    assert.ok(Array.isArray(chunks), 'Should return an array');
    assert.equal(chunks.length, 0, 'Should return empty array for empty query');
  });

  it('should validate fixture schema', () => {
    const validPrograms = ['We Level Up', 'Inner World Mastery', 'Mastering Influence', 'Legacy Leaders'];
    
    for (const meeting of fixtures) {
      assert.ok(meeting.meeting_id, 'Meeting should have meeting_id');
      assert.ok(meeting.title, 'Meeting should have title');
      assert.ok(meeting.start_time, 'Meeting should have start_time');
      assert.ok(Array.isArray(meeting.participants), 'Meeting should have participants array');
      assert.ok(meeting.program, 'Meeting should have program');
      assert.ok(meeting.transcript_text, 'Meeting should have transcript_text');
      assert.ok(validPrograms.includes(meeting.program), `Program ${meeting.program} should be valid`);
    }
  });

  it('should format excerpts around matching terms', () => {
    const chunks = retrieveFromFixtures('identity self-fulfilling prophecy', fixtures, { topK: 4 });
    
    assert.ok(chunks.length > 0, 'Should find matches');
    const chunk = chunks[0];
    
    // Should contain some of the query terms
    const lower = chunk.text.toLowerCase();
    const hasMatch = lower.includes('identity') || lower.includes('self-fulfilling') || lower.includes('prophecy');
    assert.ok(hasMatch, 'Excerpt should contain query terms');
  });
});
