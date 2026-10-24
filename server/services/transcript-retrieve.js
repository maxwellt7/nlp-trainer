// Transcript retrieval service: read Read.ai transcripts from coach-context/
// and return relevant excerpts for the AI coach.
//
// Similar to conversation-retrieve.js, but for program call transcripts.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tokenizeQuery, scoreText, excerptAroundMatches } from './conversation-retrieve.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TRANSCRIPTS_DIR = join(__dirname, '../../coach-context/transcripts');

const VALID_PROGRAMS = new Set([
  'We Level Up',
  'Inner World Mastery',
  'Mastering Influence',
  'Legacy Leaders',
]);

/**
 * Load all transcript files from coach-context/transcripts/
 * Returns array of { meeting_id, title, start_time, participants, program, summary, transcript_text, date }
 */
export function loadAllTranscripts() {
  if (!existsSync(TRANSCRIPTS_DIR)) {
    console.warn('[transcripts] coach-context/transcripts/ directory not found');
    return [];
  }

  const files = readdirSync(TRANSCRIPTS_DIR).filter(f => f.endsWith('.json'));
  const transcripts = [];

  for (const file of files) {
    try {
      const filePath = join(TRANSCRIPTS_DIR, file);
      const content = readFileSync(filePath, 'utf-8');
      const meetings = JSON.parse(content);

      if (!Array.isArray(meetings)) {
        console.warn(`[transcripts] ${file} is not an array, skipping`);
        continue;
      }

      for (const meeting of meetings) {
        if (!validateMeeting(meeting)) {
          console.warn(`[transcripts] Invalid meeting in ${file}:`, meeting.meeting_id);
          continue;
        }

        transcripts.push({
          ...meeting,
          date: file.replace('.json', ''), // YYYY-MM-DD from filename
        });
      }
    } catch (err) {
      console.error(`[transcripts] Failed to load ${file}:`, err.message);
    }
  }

  return transcripts;
}

/**
 * Validate a meeting object has all required fields
 */
function validateMeeting(meeting) {
  return (
    meeting &&
    typeof meeting.meeting_id === 'string' &&
    typeof meeting.title === 'string' &&
    typeof meeting.start_time === 'string' &&
    Array.isArray(meeting.participants) &&
    typeof meeting.program === 'string' &&
    VALID_PROGRAMS.has(meeting.program) &&
    typeof meeting.transcript_text === 'string'
  );
}

/**
 * Format a meeting for search/retrieval
 */
function flattenMeetingText(meeting) {
  const parts = [];
  
  if (meeting.program) parts.push(`Program: ${meeting.program}`);
  if (meeting.title) parts.push(`Title: ${meeting.title}`);
  if (meeting.summary) parts.push(`Summary: ${meeting.summary}`);
  if (Array.isArray(meeting.participants) && meeting.participants.length > 0) {
    parts.push(`Participants: ${meeting.participants.join(', ')}`);
  }
  if (meeting.transcript_text) parts.push(meeting.transcript_text);

  return parts.join('\n');
}

/**
 * Format meeting metadata for display in prompt
 */
function formatMeetingLabel(meeting) {
  const dateStr = formatDate(meeting.start_time);
  return `${meeting.program} — ${meeting.title} (${dateStr})`;
}

function formatDate(isoString) {
  try {
    const date = new Date(isoString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  } catch {
    return isoString;
  }
}

/**
 * Retrieve relevant transcript excerpts for a query.
 * Returns chunks in the same format as conversation-retrieve:
 * { source, filename, text, score }
 */
export function retrieveTranscriptChunks(query, { topK = 4, minScore = 0.30 } = {}) {
  const terms = tokenizeQuery(query);
  const transcripts = loadAllTranscripts();

  if (!Array.isArray(transcripts) || transcripts.length === 0) return [];
  if (terms.length === 0) return [];

  const scored = [];

  for (const meeting of transcripts) {
    const text = flattenMeetingText(meeting);
    if (!text.trim()) continue;

    const score = scoreText(text, terms);
    if (score < minScore) continue;

    scored.push({
      source: `transcript:${meeting.meeting_id}`,
      filename: formatMeetingLabel(meeting),
      text: excerptAroundMatches(text, terms, 1200),
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

/**
 * Get transcript statistics for monitoring
 */
export function getTranscriptStats() {
  const transcripts = loadAllTranscripts();
  const programCounts = {};
  
  for (const meeting of transcripts) {
    programCounts[meeting.program] = (programCounts[meeting.program] || 0) + 1;
  }

  return {
    total: transcripts.length,
    byProgram: programCounts,
    dateRange: transcripts.length > 0
      ? {
          earliest: transcripts.reduce((min, m) => m.start_time < min ? m.start_time : min, transcripts[0].start_time),
          latest: transcripts.reduce((max, m) => m.start_time > max ? m.start_time : max, transcripts[0].start_time),
        }
      : null,
  };
}
