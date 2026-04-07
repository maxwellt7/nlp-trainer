import { Router } from 'express';
// User ID now comes from req.userId (set by extractUserId middleware)
import {
  getUserXp,
  getXpHistory,
  getUserMysteryBoxes,
  getUnopenedBoxes,
  openMysteryBox,
  getUserAchievements,
  getAllAchievementDefs,
  checkAchievements,
} from '../services/gamification.js';

const router = Router();

// GET /api/gamification/xp — get user's XP, level, and progress
router.get('/xp', (req, res) => {
  try {
    const userId = req.userId;
    const xp = getUserXp(userId);
    res.json(xp);
  } catch (error) {
    console.error('Error getting XP:', error.message);
    res.status(500).json({ error: 'Failed to get XP data' });
  }
});

// GET /api/gamification/xp/history — get XP event history
router.get('/xp/history', (req, res) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 20;
    const history = getXpHistory(userId, limit);
    res.json({ events: history });
  } catch (error) {
    console.error('Error getting XP history:', error.message);
    res.status(500).json({ error: 'Failed to get XP history' });
  }
});

// GET /api/gamification/mystery-boxes — get user's mystery boxes
router.get('/mystery-boxes', (req, res) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 20;
    const boxes = getUserMysteryBoxes(userId, limit);
    // Don't reveal content of unopened boxes
    const sanitized = boxes.map(b => ({
      ...b,
      reward_content: b.opened ? b.reward_content : null,
    }));
    res.json({ boxes: sanitized });
  } catch (error) {
    console.error('Error getting mystery boxes:', error.message);
    res.status(500).json({ error: 'Failed to get mystery boxes' });
  }
});

// GET /api/gamification/mystery-boxes/unopened — get unopened boxes
router.get('/mystery-boxes/unopened', (req, res) => {
  try {
    const userId = req.userId;
    const boxes = getUnopenedBoxes(userId);
    const sanitized = boxes.map(b => ({
      id: b.id,
      rarity: b.rarity,
      reward_type: b.reward_type,
      reward_title: b.reward_title,
      created_at: b.created_at,
    }));
    res.json({ boxes: sanitized });
  } catch (error) {
    console.error('Error getting unopened boxes:', error.message);
    res.status(500).json({ error: 'Failed to get unopened boxes' });
  }
});

// POST /api/gamification/mystery-boxes/:boxId/open — open a mystery box
router.post('/mystery-boxes/:boxId/open', (req, res) => {
  try {
    const userId = req.userId;
    const result = openMysteryBox(userId, req.params.boxId);
    if (!result) {
      return res.status(404).json({ error: 'Mystery box not found' });
    }
    res.json(result);
  } catch (error) {
    console.error('Error opening mystery box:', error.message);
    res.status(500).json({ error: 'Failed to open mystery box' });
  }
});

// GET /api/gamification/achievements — get user's unlocked achievements
router.get('/achievements', (req, res) => {
  try {
    const userId = req.userId;
    const unlocked = getUserAchievements(userId);
    const allDefs = getAllAchievementDefs();
    
    // Mark which are unlocked
    const unlockedKeys = new Set(unlocked.map(a => a.achievement_key));
    const all = allDefs.map(def => ({
      ...def,
      unlocked: unlockedKeys.has(def.key),
      unlocked_at: unlocked.find(a => a.achievement_key === def.key)?.unlocked_at || null,
    }));
    
    res.json({ achievements: all, unlockedCount: unlocked.length, totalCount: allDefs.length });
  } catch (error) {
    console.error('Error getting achievements:', error.message);
    res.status(500).json({ error: 'Failed to get achievements' });
  }
});

// GET /api/gamification/summary — get full gamification summary for dashboard
router.get('/summary', (req, res) => {
  try {
    const userId = req.userId;
    const xp = getUserXp(userId);
    const unopened = getUnopenedBoxes(userId);
    const achievements = getUserAchievements(userId);
    const recentXp = getXpHistory(userId, 5);
    
    res.json({
      xp,
      unopenedBoxes: unopened.length,
      totalAchievements: achievements.length,
      recentXpEvents: recentXp,
    });
  } catch (error) {
    console.error('Error getting gamification summary:', error.message);
    res.status(500).json({ error: 'Failed to get gamification summary' });
  }
});

export default router;
