import { Router } from 'express';
import { listGoals, createGoal, updateGoal, deleteGoal } from '../services/goals.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// All goal routes require an authenticated user (spec). In dev with no Clerk
// key, extractUserId sets req.userId = 'default-user', so this passes locally.
router.use(requireAuth);

// GET /api/goals — list the user's goals
router.get('/', (req, res) => {
  try {
    res.json({ goals: listGoals(req.userId) });
  } catch (error) {
    console.error('Error listing goals:', error.message);
    res.status(500).json({ error: 'Failed to list goals' });
  }
});

// POST /api/goals — create a goal
router.post('/', (req, res) => {
  try {
    if (!req.body || !req.body.title || !req.body.title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    res.status(201).json({ goal: createGoal(req.userId, req.body) });
  } catch (error) {
    console.error('Error creating goal:', error.message);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

// PUT /api/goals/:id — update a goal (incl. completed for mark-achieved)
router.put('/:id', (req, res) => {
  try {
    const goal = updateGoal(req.userId, req.params.id, req.body || {});
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    res.json({ goal });
  } catch (error) {
    console.error('Error updating goal:', error.message);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

// DELETE /api/goals/:id — delete a goal
router.delete('/:id', (req, res) => {
  try {
    if (!deleteGoal(req.userId, req.params.id)) {
      return res.status(404).json({ error: 'Goal not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting goal:', error.message);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

export default router;
