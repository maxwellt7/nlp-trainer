import db from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

// Ensure a default user exists (single-user mode — legacy fallback)
export function ensureDefaultUser() {
  return ensureUser('default-user');
}

// Ensure a user exists in the database — creates user, profile, and streak if new
export function ensureUser(userId) {
  if (!userId) return ensureUser('default-user');
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!existing) {
    db.prepare('INSERT INTO users (id) VALUES (?)').run(userId);
    const profileId = `profile-${uuidv4()}`;
    db.prepare('INSERT INTO profiles (id, user_id) VALUES (?, ?)').run(profileId, userId);
    db.prepare('INSERT INTO streaks (user_id) VALUES (?)').run(userId);
    console.log(`Created new user record for: ${userId}`);
  }
  return userId;
}

// Get user profile
export function getProfile(userId) {
  return db.prepare('SELECT * FROM profiles WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1').get(userId);
}

// Update profile with parsed JSON fields
export function updateProfile(userId, updates) {
  const profile = getProfile(userId);
  if (!profile) return null;

  const fields = ['context_maps', 'meta_programs', 'capacity_index', 'force_audit', 'victim_healer', 'nervous_system', 'congruence', 'rep_system'];
  
  for (const field of fields) {
    if (updates[field] !== undefined) {
      const value = typeof updates[field] === 'string' ? updates[field] : JSON.stringify(updates[field]);
      db.prepare(`UPDATE profiles SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`).run(value, profile.id);
    }
  }

  return getProfile(userId);
}

// Get profile as parsed object (for injection into prompts)
export function getProfileForPrompt(userId) {
  const raw = getProfile(userId);
  if (!raw) return null;

  return {
    context_maps: JSON.parse(raw.context_maps || '{}'),
    meta_programs: JSON.parse(raw.meta_programs || '{}'),
    capacity_index: JSON.parse(raw.capacity_index || '{}'),
    force_audit: JSON.parse(raw.force_audit || '{}'),
    victim_healer: JSON.parse(raw.victim_healer || '{}'),
    nervous_system: JSON.parse(raw.nervous_system || '{}'),
    congruence: JSON.parse(raw.congruence || '{}'),
    rep_system: raw.rep_system || 'unknown',
    updated_at: raw.updated_at,
  };
}

// Get streak info
export function getStreak(userId) {
  return db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(userId);
}

// Update streak after a session
export function updateStreak(userId) {
  const streak = getStreak(userId);
  if (!streak) return;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  let newCurrent = 1;
  if (streak.last_session_date === today) {
    // Already logged today, no change
    return streak;
  } else if (streak.last_session_date === yesterday) {
    newCurrent = streak.current_streak + 1;
  }

  const newLongest = Math.max(streak.longest_streak, newCurrent);
  const newTotal = streak.total_sessions + 1;

  db.prepare(`
    UPDATE streaks 
    SET current_streak = ?, longest_streak = ?, last_session_date = ?, total_sessions = ?
    WHERE user_id = ?
  `).run(newCurrent, newLongest, today, newTotal, userId);

  return { current_streak: newCurrent, longest_streak: newLongest, last_session_date: today, total_sessions: newTotal };
}
