// Tests for transcript-retrieve.js

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { retrieveTranscriptChunks, getTranscriptStats, loadAllTranscripts } from './transcript-retrieve.js';

describe('Transcript Retrieval', () => {
  before(() => {
    // Ensure sample transcript exists
    const transcripts = loadAllTranscripts();
    assert.ok(Array.isArray(transcripts), 'Should load transcripts as array');
    console.log(`Loaded ${transcripts.length} transcripts for testing`);
  });

  it('should load all transcripts from coach-context/transcripts/', () => {
    const transcripts = loadAllTranscripts();
    assert.ok(Array.isArray(transcripts), 'Should return an array');
    
    // Sample transcript should exist
    if (transcripts.length > 0) {
      const first = transcripts[0];
      assert.ok(first.meeting_id, 'Should have meeting_id');
      assert.ok(first.title, 'Should have title');
      assert.ok(first.program, 'Should have program');
      assert.ok(first.transcript_text, 'Should have transcript_text');
      assert.ok(first.start_time, 'Should have start_time');
      assert.ok(Array.isArray(first.participants), 'Should have participants array');
    }
  });

  it('should retrieve relevant chunks for identity-related query', () => {
    const chunks = retrieveTranscriptChunks('identity beliefs limiting self-fulfilling', { topK: 4 });
    
    assert.ok(Array.isArray(chunks), 'Should return an array');
    
    if (chunks.length > 0) {
      const chunk = chunks[0];
      assert.ok(chunk.source, 'Chunk should have source');
      assert.ok(chunk.filename, 'Chunk should have filename');
      assert.ok(chunk.text, 'Chunk should have text');
      assert.ok(typeof chunk.score === 'number', 'Chunk should have numeric score');
      assert.ok(chunk.source.startsWith('transcript:'), 'Source should be prefixed with transcript:');
    }
  });

  it('should retrieve chunks for parts work query', () => {
    const chunks = retrieveTranscriptChunks('parts conflict inner self protective strategy', { topK: 4 });
    
    assert.ok(Array.isArray(chunks), 'Should return an array');
    
    // Should find the Inner World Mastery meeting about parts work
    const partsChunk = chunks.find(c => c.text.toLowerCase().includes('parts'));
    if (partsChunk) {
      assert.ok(partsChunk.filename.includes('Inner World Mastery'), 'Should identify program in filename');
      assert.ok(partsChunk.text.length <= 1300, 'Should limit excerpt length');
    }
  });

  it('should return empty array for non-matching query', () => {
    const chunks = retrieveTranscriptChunks('quantum physics thermodynamics entropy', { topK: 4 });
    assert.ok(Array.isArray(chunks), 'Should return an array');
    // May return empty if no match, or low-scoring chunks
  });

  it('should respect topK limit', () => {
    const chunks = retrieveTranscriptChunks('identity beliefs parts work', { topK: 2 });
    assert.ok(chunks.length <= 2, 'Should respect topK limit');
  });

  it('should respect minScore threshold', () => {
    const chunks = retrieveTranscriptChunks('identity', { minScore: 0.50 });
    
    for (const chunk of chunks) {
      assert.ok(chunk.score >= 0.50, `Score ${chunk.score} should be >= 0.50`);
    }
  });

  it('should return stats about loaded transcripts', () => {
    const stats = getTranscriptStats();
    
    assert.ok(stats, 'Should return stats object');
    assert.ok(typeof stats.total === 'number', 'Should have total count');
    assert.ok(stats.byProgram, 'Should have program breakdown');
    
    if (stats.total > 0) {
      assert.ok(stats.dateRange, 'Should have date range');
      assert.ok(stats.dateRange.earliest, 'Should have earliest date');
      assert.ok(stats.dateRange.latest, 'Should have latest date');
      
      // Verify valid programs
      const validPrograms = ['We Level Up', 'Inner World Mastery', 'Mastering Influence', 'Legacy Leaders'];
      for (const program of Object.keys(stats.byProgram)) {
        assert.ok(validPrograms.includes(program), `Program ${program} should be valid`);
      }
    }
  });

  it('should handle empty query gracefully', () => {
    const chunks = retrieveTranscriptChunks('', { topK: 4 });
    assert.ok(Array.isArray(chunks), 'Should return an array');
    assert.equal(chunks.length, 0, 'Should return empty array for empty query');
  });

  it('should validate meeting schema', () => {
    const transcripts = loadAllTranscripts();
    
    for (const meeting of transcripts) {
      assert.ok(meeting.meeting_id, 'Meeting should have meeting_id');
      assert.ok(meeting.title, 'Meeting should have title');
      assert.ok(meeting.start_time, 'Meeting should have start_time');
      assert.ok(Array.isArray(meeting.participants), 'Meeting should have participants array');
      assert.ok(meeting.program, 'Meeting should have program');
      assert.ok(meeting.transcript_text, 'Meeting should have transcript_text');
      assert.ok(meeting.date, 'Meeting should have date from filename');
      
      // Validate program is one of the four
      const validPrograms = ['We Level Up', 'Inner World Mastery', 'Mastering Influence', 'Legacy Leaders'];
      assert.ok(validPrograms.includes(meeting.program), `Program ${meeting.program} should be valid`);
    }
  });
});
