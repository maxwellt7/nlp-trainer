import express from 'express';
import db from '../db/index.js';

const router = express.Router();

// ── Ensure analytics tables exist ──
try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      user_id TEXT,
      email TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS page_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      user_id TEXT,
      referrer TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
} catch (err) {
  console.error('Failed to create analytics tables:', err.message);
}

// ── POST /api/analytics/event — Track an analytics event ──
router.post('/event', (req, res) => {
  try {
    const { eventType, userId, email, metadata } = req.body;
    if (!eventType) return res.status(400).json({ error: 'eventType required' });

    db.prepare(`
      INSERT INTO analytics_events (event_type, user_id, email, metadata)
      VALUES (?, ?, ?, ?)
    `).run(
      eventType,
      userId || null,
      email || null,
      metadata ? JSON.stringify(metadata) : '{}'
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Analytics event error:', err.message);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

// ── POST /api/analytics/pageview — Track a page view ──
router.post('/pageview', (req, res) => {
  try {
    const { path, userId, referrer, userAgent } = req.body;
    db.prepare(`
      INSERT INTO page_views (path, user_id, referrer, user_agent)
      VALUES (?, ?, ?, ?)
    `).run(path || '/', userId || null, referrer || null, userAgent || null);

    res.json({ success: true });
  } catch (err) {
    console.error('Pageview error:', err.message);
    res.status(500).json({ error: 'Failed to track pageview' });
  }
});

// ── GET /api/analytics/overview — Main dashboard overview ──
router.get('/overview', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    // Quiz funnel metrics
    const quizLeads = db.prepare(
      `SELECT COUNT(*) as count FROM quiz_leads WHERE created_at >= ?`
    ).get(since);

    const quizLeadsTotal = db.prepare(
      `SELECT COUNT(*) as count FROM quiz_leads`
    ).get();

    // Quiz leads by day
    const quizLeadsByDay = db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as count
      FROM quiz_leads
      WHERE created_at >= ?
      GROUP BY date(created_at)
      ORDER BY day ASC
    `).all(since);

    // Quiz tier distribution
    const tierDistribution = db.prepare(`
      SELECT tier, COUNT(*) as count
      FROM quiz_leads
      WHERE tier IS NOT NULL
      GROUP BY tier
      ORDER BY count DESC
    `).all();

    // User metrics
    const totalUsers = db.prepare(
      `SELECT COUNT(*) as count FROM users`
    ).get();

    const recentUsers = db.prepare(
      `SELECT COUNT(*) as count FROM users WHERE created_at >= ?`
    ).get(since);

    // Session metrics
    const totalSessions = db.prepare(
      `SELECT COUNT(*) as count FROM sessions`
    ).get();

    const recentSessions = db.prepare(
      `SELECT COUNT(*) as count FROM sessions WHERE created_at >= ?`
    ).get(since);

    const sessionsByDay = db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as count
      FROM sessions
      WHERE created_at >= ?
      GROUP BY date(created_at)
      ORDER BY day ASC
    `).all(since);

    // Streak data
    const streakData = db.prepare(`
      SELECT
        AVG(current_streak) as avg_streak,
        MAX(longest_streak) as max_streak,
        SUM(total_sessions) as total_completed,
        COUNT(*) as active_users
      FROM streaks
      WHERE total_sessions > 0
    `).get();

    // XP / Level distribution
    const levelDistribution = db.prepare(`
      SELECT level, COUNT(*) as count
      FROM user_xp
      GROUP BY level
      ORDER BY level ASC
    `).all();

    // Scripts generated
    const totalScripts = db.prepare(
      `SELECT COUNT(*) as count FROM scripts`
    ).get();

    const recentScripts = db.prepare(
      `SELECT COUNT(*) as count FROM scripts WHERE created_at >= ?`
    ).get(since);

    // Analytics events
    const eventCounts = db.prepare(`
      SELECT event_type, COUNT(*) as count
      FROM analytics_events
      WHERE created_at >= ?
      GROUP BY event_type
      ORDER BY count DESC
    `).all(since);

    // Page views
    const pageViewsByPath = db.prepare(`
      SELECT path, COUNT(*) as count
      FROM page_views
      WHERE created_at >= ?
      GROUP BY path
      ORDER BY count DESC
      LIMIT 20
    `).all(since);

    const totalPageViews = db.prepare(
      `SELECT COUNT(*) as count FROM page_views WHERE created_at >= ?`
    ).get(since);

    // Recent leads
    const recentLeads = db.prepare(`
      SELECT email, name, score, tier, created_at
      FROM quiz_leads
      ORDER BY created_at DESC
      LIMIT 10
    `).all();

    res.json({
      period: { days, since },
      funnel: {
        quizLeads: quizLeads?.count || 0,
        quizLeadsTotal: quizLeadsTotal?.count || 0,
        quizLeadsByDay: quizLeadsByDay || [],
        tierDistribution: tierDistribution || [],
      },
      users: {
        total: totalUsers?.count || 0,
        recent: recentUsers?.count || 0,
      },
      sessions: {
        total: totalSessions?.count || 0,
        recent: recentSessions?.count || 0,
        byDay: sessionsByDay || [],
      },
      engagement: {
        avgStreak: streakData?.avg_streak || 0,
        maxStreak: streakData?.max_streak || 0,
        totalCompleted: streakData?.total_completed || 0,
        activeUsers: streakData?.active_users || 0,
      },
      gamification: {
        levelDistribution: levelDistribution || [],
      },
      content: {
        totalScripts: totalScripts?.count || 0,
        recentScripts: recentScripts?.count || 0,
      },
      events: eventCounts || [],
      pageViews: {
        total: totalPageViews?.count || 0,
        byPath: pageViewsByPath || [],
      },
      recentLeads: recentLeads || [],
    });
  } catch (err) {
    console.error('Analytics overview error:', err.message);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// ── GET /api/analytics/leads — Paginated lead list ──
router.get('/leads', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const leads = db.prepare(
      'SELECT * FROM quiz_leads ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(limit, offset);
    const total = db.prepare('SELECT COUNT(*) as count FROM quiz_leads').get();
    res.json({ leads, total: total?.count || 0 });
  } catch (err) {
    console.error('Analytics leads error:', err.message);
    res.status(500).json({ error: 'Failed to load leads' });
  }
});

// ── GET /api/analytics/users — User list with engagement data ──
router.get('/users', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const users = db.prepare(`
      SELECT
        u.id,
        u.created_at,
        COALESCE(s.current_streak, 0) as current_streak,
        COALESCE(s.longest_streak, 0) as longest_streak,
        COALESCE(s.total_sessions, 0) as total_sessions,
        s.last_session_date,
        COALESCE(x.level, 1) as level,
        COALESCE(x.total_xp, 0) as total_xp,
        COALESCE(x.title, 'Seeker') as title
      FROM users u
      LEFT JOIN streaks s ON u.id = s.user_id
      LEFT JOIN user_xp x ON u.id = x.user_id
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const total = db.prepare('SELECT COUNT(*) as count FROM users').get();
    res.json({ users, total: total?.count || 0 });
  } catch (err) {
    console.error('Analytics users error:', err.message);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

export default router;
