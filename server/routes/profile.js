import { Router } from 'express';
import { getProfile, getProfileForPrompt, updateProfile, getStreak, updateStreak } from '../services/profile.js';
import { getUserXp, getUnopenedBoxes } from '../services/gamification.js';
import { getAllSessions, getRecentSessions, getSessionForUser, getTodaySession, isSessionLocked, updateSessionMetadata } from '../services/memory.js';

const router = Router();

// GET /api/profile — get user profile and streak
router.get('/', (req, res) => {
  try {
    const userId = req.userId;
    const profile = getProfileForPrompt(userId);
    const streak = getStreak(userId);
    const todaySession = getTodaySession(userId);

    // Get gamification data
    let xp = null;
    let unopenedBoxes = 0;
    try {
      xp = getUserXp(userId);
      unopenedBoxes = getUnopenedBoxes(userId).length;
    } catch { /* gamification optional */ }

    // Determine daily session state: locked/generated, in-progress, or none
    const sessionCompleted = !!(todaySession && isSessionLocked(todaySession));
    const sessionInProgress = !!(todaySession && !sessionCompleted);

    res.json({
      userId,
      profile,
      streak,
      hasSessionToday: !!todaySession,
      sessionCompleted,
      sessionInProgress,
      todaySessionId: todaySession?.id || null,
      xp,
      unopenedBoxes,
    });
  } catch (error) {
    console.error('Error getting profile:', error.message);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// PUT /api/profile — update profile fields
router.put('/', (req, res) => {
  try {
    const userId = req.userId;
    const updated = updateProfile(userId, req.body);
    res.json({ profile: getProfileForPrompt(userId) });
  } catch (error) {
    console.error('Error updating profile:', error.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET /api/profile/sessions — get session history
router.get('/sessions', (req, res) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 30;
    const offset = parseInt(req.query.offset) || 0;
    const sessions = getAllSessions(userId, limit, offset);

    // Parse JSON fields
    const parsed = sessions.map(s => ({
      ...s,
      key_themes: JSON.parse(s.key_themes || '[]'),
    }));

    res.json({ sessions: parsed });
  } catch (error) {
    console.error('Error getting sessions:', error.message);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// GET /api/profile/sessions/:sessionId — get a specific session
router.get('/sessions/:sessionId', (req, res) => {
  try {
    const session = getSessionForUser(req.params.sessionId, req.userId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({
      ...session,
      chat_messages: JSON.parse(session.chat_messages || '[]'),
      key_themes: JSON.parse(session.key_themes || '[]'),
    });
  } catch (error) {
    console.error('Error getting session:', error.message);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// POST /api/profile/sessions/:sessionId/rate — rate a session
router.post('/sessions/:sessionId/rate', (req, res) => {
  try {
    const { rating, feedback } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    const session = getSessionForUser(req.params.sessionId, req.userId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    updateSessionMetadata(req.params.sessionId, {
      user_rating: rating,
      user_feedback: feedback || '',
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error rating session:', error.message);
    res.status(500).json({ error: 'Failed to rate session' });
  }
});

// GET /api/profile/streak — get streak info
router.get('/streak', (req, res) => {
  try {
    const userId = req.userId;
    const streak = getStreak(userId);
    res.json(streak);
  } catch (error) {
    console.error('Error getting streak:', error.message);
    res.status(500).json({ error: 'Failed to get streak' });
  }
});

export default router;
