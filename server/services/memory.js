import db from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

function buildSessionId() {
  return `session-${Date.now()}-${uuidv4().slice(0, 8)}`;
}

function getTodayDateKey() {
  return new Date().toISOString().split('T')[0];
}

export function isSessionLocked(session) {
  return Boolean(session?.locked_at) || session?.session_status === 'locked';
}

export function createConversationSession(userId, options = {}) {
  const {
    moodBefore = null,
    sessionType = 'general_chat',
    title = '',
    dateKey = getTodayDateKey(),
    sessionStatus = 'active',
  } = options;

  const id = buildSessionId();

  db.prepare(`
    INSERT INTO sessions (
      id,
      user_id,
      date_key,
      session_type,
      session_status,
      title,
      mood_before,
      last_message_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(id, userId, dateKey, sessionType, sessionStatus, title, moodBefore);

  return {
    id,
    user_id: userId,
    date_key: dateKey,
    session_type: sessionType,
    session_status: sessionStatus,
    title,
    mood_before: moodBefore,
  };
}

// Create a new daily hypnosis session
export function createSession(userId, moodBefore = null) {
  return createConversationSession(userId, {
    moodBefore,
    sessionType: 'daily_hypnosis',
    dateKey: getTodayDateKey(),
    sessionStatus: 'active',
  });
}

// Update session with chat messages
export function updateSessionMessages(sessionId, messages) {
  db.prepare(`
    UPDATE sessions
    SET chat_messages = ?, last_message_at = datetime('now')
    WHERE id = ?
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
  if (metadata.title !== undefined) { fields.push('title = ?'); values.push(metadata.title); }
  if (metadata.session_status !== undefined) { fields.push('session_status = ?'); values.push(metadata.session_status); }
  if (metadata.hypnosis_generated_at !== undefined) { fields.push('hypnosis_generated_at = ?'); values.push(metadata.hypnosis_generated_at); }
  if (metadata.locked_at !== undefined) { fields.push('locked_at = ?'); values.push(metadata.locked_at); }
  if (metadata.touchLastMessageAt) { fields.push(`last_message_at = datetime('now')`); }

  if (fields.length === 0) return;

  values.push(sessionId);
  db.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function markHypnosisGenerated(sessionId, metadata = {}) {
  const session = getSession(sessionId);
  if (!session) return null;

  const generatedAt = new Date().toISOString();
  const lockedAt = session.session_type === 'daily_hypnosis' ? generatedAt : null;
  const sessionStatus = lockedAt ? 'locked' : 'hypnosis_generated';

  updateSessionMetadata(sessionId, {
    script_id: metadata.scriptId,
    audio_file: metadata.audioFile,
    title: metadata.title,
    hypnosis_generated_at: generatedAt,
    locked_at: lockedAt,
    session_status: sessionStatus,
    touchLastMessageAt: true,
  });

  return getSession(sessionId);
}

// Get recent sessions for memory context
export function getRecentSessions(userId, limit = 5) {
  return db.prepare(`
    SELECT id, date_key, chat_summary, detected_map, detected_state, key_themes,
           mood_before, mood_after, user_rating, user_feedback,
           session_type, session_status, hypnosis_generated_at, last_message_at
    FROM sessions
    WHERE user_id = ? AND chat_summary != ''
    ORDER BY COALESCE(last_message_at, created_at) DESC
    LIMIT ?
  `).all(userId, limit);
}

// Get today's daily hypnosis session if one exists
export function getTodaySession(userId) {
  const today = getTodayDateKey();
  return db.prepare(`
    SELECT *
    FROM sessions
    WHERE user_id = ? AND date_key = ? AND session_type = 'daily_hypnosis'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(userId, today);
}

// Get session by ID
export function getSession(sessionId) {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
}

export function getSessionForUser(sessionId, userId) {
  return db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(sessionId, userId);
}

export function deleteSessionForUser(sessionId, userId) {
  const session = getSessionForUser(sessionId, userId);
  if (!session) {
    return { deleted: false, reason: 'not_found' };
  }

  if (session.session_type === 'daily_hypnosis') {
    return { deleted: false, reason: 'protected_daily_session' };
  }

  db.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').run(sessionId, userId);
  return { deleted: true, reason: null };
}

export function getSidebarSessions(userId, limit = 30, offset = 0) {
  return db.prepare(`
    SELECT id, user_id, date_key, session_type, session_status, title,
           chat_summary, script_id, audio_file, hypnosis_generated_at,
           locked_at, last_message_at, created_at,
           CASE WHEN locked_at IS NULL OR locked_at = '' THEN 0 ELSE 1 END AS is_locked
    FROM sessions
    WHERE user_id = ?
    ORDER BY COALESCE(last_message_at, created_at) DESC, created_at DESC
    LIMIT ? OFFSET ?
  `).all(userId, limit, offset);
}

// Get all sessions for a user (paginated)
export function getAllSessions(userId, limit = 30, offset = 0) {
  return db.prepare(`
    SELECT id, date_key, chat_summary, detected_map, detected_state, key_themes,
           mood_before, mood_after, user_rating, script_id, audio_file, created_at,
           session_type, session_status, title, last_message_at, hypnosis_generated_at,
           locked_at,
           CASE WHEN locked_at IS NULL OR locked_at = '' THEN 0 ELSE 1 END AS is_locked
    FROM sessions
    WHERE user_id = ?
    ORDER BY COALESCE(last_message_at, created_at) DESC, created_at DESC
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
