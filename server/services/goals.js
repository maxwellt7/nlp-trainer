import db from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { safeJsonParse } from './safe-json.js';

// The goals service is the single mapping boundary between the DB row shape
// (snake_case, completed INTEGER, JSON-in-TEXT) and the app shape (camelCase,
// completed boolean, parsed arrays). Routes and the frontend use the app shape.

function rowToGoal(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    category: row.category || 'Health',
    targetDate: row.target_date || '',
    milestones: safeJsonParse(row.milestones, []),
    rewards: safeJsonParse(row.rewards, []),
    completed: !!row.completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Drop rewards with neither a name nor an image (prototype saveGoal rule).
function cleanRewards(rewards) {
  if (!Array.isArray(rewards)) return [];
  return rewards
    .filter(r => r && ((r.name && r.name.trim()) || r.image))
    .map(r => ({
      type: r.type === 'experience' ? 'experience' : 'material',
      name: (r.name || '').trim(),
      image: r.image || '',
    }));
}

function cleanMilestones(ms) {
  if (!Array.isArray(ms)) return [];
  return ms
    .filter(m => m && typeof m.text === 'string' && m.text.trim())
    .map(m => ({ text: m.text.trim(), done: !!m.done }));
}

export function listGoals(userId) {
  const rows = db.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY target_date ASC').all(userId);
  return rows.map(rowToGoal);
}

export function getGoal(userId, id) {
  return rowToGoal(db.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?').get(id, userId));
}

export function createGoal(userId, draft = {}) {
  const id = `goal-${uuidv4()}`;
  db.prepare(`INSERT INTO goals (id, user_id, title, description, category, target_date, milestones, rewards, completed)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, userId,
    (draft.title || '').trim(),
    draft.description || '',
    draft.category || 'Health',
    draft.targetDate || '',
    JSON.stringify(cleanMilestones(draft.milestones)),
    JSON.stringify(cleanRewards(draft.rewards)),
    draft.completed ? 1 : 0,
  );
  return getGoal(userId, id);
}

export function updateGoal(userId, id, patch = {}) {
  const existing = getGoal(userId, id);
  if (!existing) return null;
  const next = {
    title: patch.title !== undefined ? patch.title.trim() : existing.title,
    description: patch.description !== undefined ? patch.description : existing.description,
    category: patch.category !== undefined ? patch.category : existing.category,
    target_date: patch.targetDate !== undefined ? patch.targetDate : existing.targetDate,
    milestones: patch.milestones !== undefined ? cleanMilestones(patch.milestones) : existing.milestones,
    rewards: patch.rewards !== undefined ? cleanRewards(patch.rewards) : existing.rewards,
    completed: patch.completed !== undefined ? (patch.completed ? 1 : 0) : (existing.completed ? 1 : 0),
  };
  db.prepare(`UPDATE goals SET title=?, description=?, category=?, target_date=?, milestones=?, rewards=?, completed=?, updated_at=datetime('now')
              WHERE id=? AND user_id=?`).run(
    next.title, next.description, next.category, next.target_date,
    JSON.stringify(next.milestones), JSON.stringify(next.rewards), next.completed, id, userId,
  );
  return getGoal(userId, id);
}

export function deleteGoal(userId, id) {
  const existing = getGoal(userId, id);
  if (!existing) return false;
  db.prepare('DELETE FROM goals WHERE id = ? AND user_id = ?').run(id, userId);
  return true;
}
