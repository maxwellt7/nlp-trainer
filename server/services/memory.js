import db from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

// Create a new session
export function createSession(userId, moodBefore = null) {
  const id = `session-${Date.now()}-${uuidv4().slice(0, 8)}`;
  const dateKey = new Date().toISOString().split('T')[0];

  db.prepare(`
    INSERT INTO sessions (id, user_id, date_key, mood_before) VALUES (?, ?, ?, ?)
  `).run(id, userId, dateKey, moodBefore);

  return { id, user_id: userId, date_key: dateKey };
}

// Update session with chat messages
export function updateSessionMessages(sessionId, messages) {
  db.prepare(`
    UPDATE sessions SET chat_messages = ? WHERE id = ?
  `).run(JSON.stringify(messages), sessionId);
}

// Update session with AI-extracted metadata
export function updateSessionMetadata(sessionId, metadata) {
  const fields = [];
  const values = [];

  if (metadata.chat_summary !== undefined) { fields.push('chat_summary = ?'); values.push(metadata.chat_summary); }
  if (metadata.detected_map !== undefined) { fields.push('detected_map = ?'); values.push(metadata.detected_map); }
  if (metadata.detected_state !== undefined) { fields.push('detected_state = ?'); values.push(metadata.detected_state); }
  if (metadata.key_themes !== undefined) { fields.push('key_themes = ?'); values.push(JSON.stringify(metadata.key_themes)); }
  if (metadata.script_id !== undefined) { fields.push('script_id = ?'); values.push(metadata.script_id); }
  if (metadata.audio_file !== undefined) { fields.push('audio_file = ?'); values.push(metadata.audio_file); }
  if (metadata.user_rating !== undefined) { fields.push('user_rating = ?'); values.push(metadata.user_rating); }
  if (metadata.user_feedback !== undefined) { fields.push('user_feedback = ?'); values.push(metadata.user_feedback); }
  if (metadata.mood_after !== undefined) { fields.push('mood_after = ?'); values.push(metadata.mood_after); }

  if (fields.length === 0) return;

  values.push(sessionId);
  db.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

// Get recent sessions for memory context
export function getRecentSessions(userId, limit = 5) {
  return db.prepare(`
    SELECT id, date_key, chat_summary, detected_map, detected_state, key_themes, 
           mood_before, mood_after, user_rating, user_feedback
    FROM sessions 
    WHERE user_id = ? AND chat_summary != ''
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(userId, limit);
}

// Get today's session if one exists
export function getTodaySession(userId) {
  const today = new Date().toISOString().split('T')[0];
  return db.prepare(`
    SELECT * FROM sessions WHERE user_id = ? AND date_key = ? ORDER BY created_at DESC LIMIT 1
  `).get(userId, today);
}

// Get session by ID
export function getSession(sessionId) {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
}

// Get all sessions for a user (paginated)
export function getAllSessions(userId, limit = 30, offset = 0) {
  return db.prepare(`
    SELECT id, date_key, chat_summary, detected_map, detected_state, key_themes,
           mood_before, mood_after, user_rating, script_id, audio_file, created_at
    FROM sessions 
    WHERE user_id = ?
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `).all(userId, limit, offset);
}

// Build memory context string for prompt injection
export function buildMemoryContext(userId) {
  const sessions = getRecentSessions(userId, 5);
  if (sessions.length === 0) {
    return 'No previous sessions recorded. This appears to be a new user.';
  }

  let context = 'RECENT SESSION HISTORY:\n\n';
  for (const s of sessions) {
    context += `--- Session: ${s.date_key} ---\n`;
    if (s.chat_summary) context += `Summary: ${s.chat_summary}\n`;
    if (s.detected_map) context += `Active Context Map: ${s.detected_map}\n`;
    if (s.detected_state) context += `Emotional State: ${s.detected_state}\n`;
    if (s.key_themes) {
      try {
        const themes = JSON.parse(s.key_themes);
        if (themes.length > 0) context += `Key Themes: ${themes.join(', ')}\n`;
      } catch {}
    }
    if (s.mood_before !== null) context += `Mood Before: ${s.mood_before}/10\n`;
    if (s.mood_after !== null) context += `Mood After: ${s.mood_after}/10\n`;
    if (s.user_feedback) context += `User Feedback: ${s.user_feedback}\n`;
    context += '\n';
  }

  return context;
}

// Save a memory summary (weekly/monthly consolidation)
export function saveMemorySummary(userId, period, summary, keyPatterns = []) {
  const id = `mem-${uuidv4()}`;
  db.prepare(`
    INSERT INTO memory_summaries (id, user_id, period, summary, key_patterns)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, period, summary, JSON.stringify(keyPatterns));
  return id;
}

// Get memory summaries
export function getMemorySummaries(userId, limit = 4) {
  return db.prepare(`
    SELECT * FROM memory_summaries WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
  `).all(userId, limit);
}
