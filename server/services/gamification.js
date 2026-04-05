import db from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

// ── Level Thresholds & Titles ──
// Progressive curve: early levels fast, later levels require sustained commitment
const LEVEL_CONFIG = [
  { level: 1, title: 'Seeker', xpRequired: 0 },
  { level: 2, title: 'Seeker', xpRequired: 100 },
  { level: 3, title: 'Seeker', xpRequired: 250 },
  { level: 4, title: 'Initiate', xpRequired: 500 },
  { level: 5, title: 'Initiate', xpRequired: 850 },
  { level: 6, title: 'Initiate', xpRequired: 1300 },
  { level: 7, title: 'Architect', xpRequired: 1900 },
  { level: 8, title: 'Architect', xpRequired: 2700 },
  { level: 9, title: 'Architect', xpRequired: 3800 },
  { level: 10, title: 'Sovereign', xpRequired: 5200 },
  { level: 11, title: 'Sovereign', xpRequired: 7000 },
  { level: 12, title: 'Sovereign', xpRequired: 9500 },
  { level: 13, title: 'Transcendent', xpRequired: 13000 },
  { level: 14, title: 'Transcendent', xpRequired: 17500 },
  { level: 15, title: 'Transcendent', xpRequired: 23000 },
];

// ── XP Award Amounts ──
const XP_AWARDS = {
  session_complete: 25,        // Completing daily coaching chat
  script_generated: 15,        // Generating hypnosis script
  audio_generated: 10,         // Generating audio
  vulnerability_bonus: 20,     // AI detects deep/vulnerable response
  streak_3: 15,                // 3-day streak bonus
  streak_7: 40,                // 7-day streak bonus
  streak_14: 80,               // 14-day streak bonus
  streak_30: 200,              // 30-day streak bonus
  first_session: 50,           // First ever session
  first_script: 30,            // First script generated
  value_detected: 5,           // New value detected
  conflict_detected: 10,       // Value conflict identified
  identity_statement: 5,       // Identity statement captured
};

// ── Mystery Box Rarity Weights ──
const RARITY_WEIGHTS = [
  { rarity: 'common', weight: 50, color: '#94a3b8' },
  { rarity: 'uncommon', weight: 30, color: '#22d3ee' },
  { rarity: 'rare', weight: 15, color: '#a78bfa' },
  { rarity: 'legendary', weight: 5, color: '#fbbf24' },
];

// ── Mystery Box Reward Templates ──
const REWARD_TEMPLATES = {
  common: [
    { type: 'affirmation', title: 'Personal Affirmation', contentFn: (ctx) => generateAffirmation(ctx) },
    { type: 'quote', title: 'Wisdom Quote', contentFn: (ctx) => generateQuote(ctx) },
    { type: 'reflection', title: 'Reflection Prompt', contentFn: (ctx) => generateReflection(ctx) },
  ],
  uncommon: [
    { type: 'micro_framework', title: 'Micro-Framework Unlocked', contentFn: (ctx) => generateMicroFramework(ctx) },
    { type: 'pattern_insight', title: 'Pattern Insight', contentFn: (ctx) => generatePatternInsight(ctx) },
    { type: 'challenge', title: 'Growth Challenge', contentFn: (ctx) => generateChallenge(ctx) },
  ],
  rare: [
    { type: 'deep_pattern', title: 'Deep Pattern Detection', contentFn: (ctx) => generateDeepPattern(ctx) },
    { type: 'value_map', title: 'Value Constellation', contentFn: (ctx) => generateValueMap(ctx) },
  ],
  legendary: [
    { type: 'breakthrough', title: 'Breakthrough Insight', contentFn: (ctx) => generateBreakthrough(ctx) },
    { type: 'masterclass', title: 'Masterclass Unlocked', contentFn: (ctx) => generateMasterclass(ctx) },
  ],
};

// ── Achievement Definitions ──
const ACHIEVEMENT_DEFS = [
  { key: 'first_session', title: 'First Steps', description: 'Complete your first coaching session', icon: '🌱', check: (stats) => stats.sessions >= 1 },
  { key: 'sessions_5', title: 'Building Momentum', description: 'Complete 5 coaching sessions', icon: '🔥', check: (stats) => stats.sessions >= 5 },
  { key: 'sessions_10', title: 'Committed', description: 'Complete 10 coaching sessions', icon: '⚡', check: (stats) => stats.sessions >= 10 },
  { key: 'sessions_25', title: 'Deep Practitioner', description: 'Complete 25 coaching sessions', icon: '💎', check: (stats) => stats.sessions >= 25 },
  { key: 'sessions_50', title: 'Master of Practice', description: 'Complete 50 coaching sessions', icon: '👑', check: (stats) => stats.sessions >= 50 },
  { key: 'streak_3', title: 'Three-Day Fire', description: 'Maintain a 3-day streak', icon: '🔥', check: (stats) => stats.streak >= 3 },
  { key: 'streak_7', title: 'Weekly Warrior', description: 'Maintain a 7-day streak', icon: '⚔️', check: (stats) => stats.streak >= 7 },
  { key: 'streak_14', title: 'Fortnight Force', description: 'Maintain a 14-day streak', icon: '🛡️', check: (stats) => stats.streak >= 14 },
  { key: 'streak_30', title: 'Monthly Sovereign', description: 'Maintain a 30-day streak', icon: '🏛️', check: (stats) => stats.streak >= 30 },
  { key: 'level_initiate', title: 'Initiate Awakened', description: 'Reach the Initiate level', icon: '✨', check: (stats) => stats.level >= 4 },
  { key: 'level_architect', title: 'Architect Risen', description: 'Reach the Architect level', icon: '🏗️', check: (stats) => stats.level >= 7 },
  { key: 'level_sovereign', title: 'Sovereign Crowned', description: 'Reach the Sovereign level', icon: '👑', check: (stats) => stats.level >= 10 },
  { key: 'values_3', title: 'Value Explorer', description: 'Discover 3 core values', icon: '🧭', check: (stats) => stats.values >= 3 },
  { key: 'values_7', title: 'Value Cartographer', description: 'Discover 7 core values', icon: '🗺️', check: (stats) => stats.values >= 7 },
  { key: 'first_audio', title: 'Voice of Change', description: 'Generate your first hypnosis audio', icon: '🎧', check: (stats) => stats.audios >= 1 },
  { key: 'mystery_rare', title: 'Rare Find', description: 'Open a rare mystery box', icon: '💜', check: (stats) => stats.rareBoxes >= 1 },
  { key: 'mystery_legendary', title: 'Legendary Discovery', description: 'Open a legendary mystery box', icon: '🌟', check: (stats) => stats.legendaryBoxes >= 1 },
];

// ── Core Functions ──

export function ensureUserXp(userId) {
  const existing = db.prepare('SELECT user_id FROM user_xp WHERE user_id = ?').get(userId);
  if (!existing) {
    db.prepare('INSERT INTO user_xp (user_id) VALUES (?)').run(userId);
  }
}

export function getUserXp(userId) {
  ensureUserXp(userId);
  const xp = db.prepare('SELECT * FROM user_xp WHERE user_id = ?').get(userId);
  const levelConfig = LEVEL_CONFIG.find(l => l.level === xp.level) || LEVEL_CONFIG[0];
  const nextLevelConfig = LEVEL_CONFIG.find(l => l.level === xp.level + 1);
  
  return {
    ...xp,
    title: levelConfig.title,
    currentLevelXp: levelConfig.xpRequired,
    nextLevelXp: nextLevelConfig ? nextLevelConfig.xpRequired : null,
    progressToNext: nextLevelConfig 
      ? Math.min(1, (xp.total_xp - levelConfig.xpRequired) / (nextLevelConfig.xpRequired - levelConfig.xpRequired))
      : 1,
    maxLevel: !nextLevelConfig,
  };
}

export function awardXp(userId, eventType, sessionId = null, extraDescription = '') {
  ensureUserXp(userId);
  
  const baseAmount = XP_AWARDS[eventType] || 0;
  if (baseAmount === 0) return null;
  
  // Get streak multiplier
  const xpRow = db.prepare('SELECT streak_multiplier FROM user_xp WHERE user_id = ?').get(userId);
  const multiplier = xpRow?.streak_multiplier || 1.0;
  const finalAmount = Math.round(baseAmount * multiplier);
  
  // Record the XP event
  const eventId = `xp-${uuidv4()}`;
  const description = extraDescription || eventType.replace(/_/g, ' ');
  db.prepare('INSERT INTO xp_events (id, user_id, event_type, xp_amount, description, session_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(eventId, userId, eventType, finalAmount, description, sessionId);
  
  // Update total XP
  db.prepare(`UPDATE user_xp SET total_xp = total_xp + ?, updated_at = datetime('now') WHERE user_id = ?`)
    .run(finalAmount, userId);
  
  // Update specific counters
  if (eventType === 'session_complete') {
    db.prepare(`UPDATE user_xp SET sessions_completed = sessions_completed + 1 WHERE user_id = ?`).run(userId);
  } else if (eventType === 'script_generated') {
    db.prepare(`UPDATE user_xp SET scripts_generated = scripts_generated + 1 WHERE user_id = ?`).run(userId);
  } else if (eventType === 'audio_generated') {
    db.prepare(`UPDATE user_xp SET audios_generated = audios_generated + 1 WHERE user_id = ?`).run(userId);
  } else if (eventType === 'vulnerability_bonus') {
    db.prepare(`UPDATE user_xp SET vulnerability_bonus = vulnerability_bonus + ? WHERE user_id = ?`).run(finalAmount, userId);
  }
  
  // Check for level up
  const levelUpResult = checkLevelUp(userId);
  
  return {
    eventId,
    xpAwarded: finalAmount,
    multiplier,
    eventType,
    levelUp: levelUpResult,
  };
}

function checkLevelUp(userId) {
  const xp = db.prepare('SELECT total_xp, level FROM user_xp WHERE user_id = ?').get(userId);
  if (!xp) return null;
  
  let newLevel = xp.level;
  let newTitle = LEVEL_CONFIG[0].title;
  
  for (const config of LEVEL_CONFIG) {
    if (xp.total_xp >= config.xpRequired) {
      newLevel = config.level;
      newTitle = config.title;
    }
  }
  
  if (newLevel > xp.level) {
    const nextConfig = LEVEL_CONFIG.find(l => l.level === newLevel + 1);
    db.prepare(`UPDATE user_xp SET level = ?, title = ?, xp_to_next = ?, updated_at = datetime('now') WHERE user_id = ?`)
      .run(newLevel, newTitle, nextConfig ? nextConfig.xpRequired - xp.total_xp : 0, userId);
    
    return { newLevel, newTitle, previousLevel: xp.level };
  }
  
  return null;
}

export function updateStreakMultiplier(userId, currentStreak) {
  ensureUserXp(userId);
  let multiplier = 1.0;
  if (currentStreak >= 30) multiplier = 2.0;
  else if (currentStreak >= 14) multiplier = 1.75;
  else if (currentStreak >= 7) multiplier = 1.5;
  else if (currentStreak >= 3) multiplier = 1.25;
  
  db.prepare(`UPDATE user_xp SET streak_multiplier = ?, updated_at = datetime('now') WHERE user_id = ?`)
    .run(multiplier, userId);
  
  // Award streak milestone XP
  const streakMilestones = { 3: 'streak_3', 7: 'streak_7', 14: 'streak_14', 30: 'streak_30' };
  if (streakMilestones[currentStreak]) {
    return awardXp(userId, streakMilestones[currentStreak], null, `${currentStreak}-day streak milestone`);
  }
  
  return null;
}

export function getXpHistory(userId, limit = 20) {
  return db.prepare('SELECT * FROM xp_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(userId, limit);
}

// ── Mystery Box Functions ──

function rollRarity() {
  const totalWeight = RARITY_WEIGHTS.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const r of RARITY_WEIGHTS) {
    roll -= r.weight;
    if (roll <= 0) return r.rarity;
  }
  return 'common';
}

function generateAffirmation(ctx) {
  const topValue = ctx.topValues?.[0] || 'growth';
  const affirmations = [
    `I am deeply aligned with my value of ${topValue}, and it guides every decision I make.`,
    `My commitment to ${topValue} grows stronger with each session. I am becoming who I was always meant to be.`,
    `Today I choose ${topValue} not from obligation, but from the deepest truth of who I am.`,
    `I release all distorted expressions of ${topValue} and embrace its purest form.`,
    `My ${topValue} is not something I do — it is who I am, all the time.`,
  ];
  return affirmations[Math.floor(Math.random() * affirmations.length)];
}

function generateQuote(ctx) {
  const quotes = [
    { text: 'The privilege of a lifetime is to become who you truly are.', author: 'Carl Jung' },
    { text: 'Between stimulus and response there is a space. In that space is our freedom.', author: 'Viktor Frankl' },
    { text: 'What you resist, persists. What you look at, disappears.', author: 'Neale Donald Walsch' },
    { text: 'The cave you fear to enter holds the treasure you seek.', author: 'Joseph Campbell' },
    { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' },
    { text: 'The wound is the place where the Light enters you.', author: 'Rumi' },
    { text: 'Until you make the unconscious conscious, it will direct your life and you will call it fate.', author: 'Carl Jung' },
    { text: 'The only way out is through.', author: 'Robert Frost' },
  ];
  const q = quotes[Math.floor(Math.random() * quotes.length)];
  return JSON.stringify(q);
}

function generateReflection(ctx) {
  const reflections = [
    'What would change if you stopped trying to manage other people\'s perceptions of you?',
    'Where in your life are you using force instead of influence right now?',
    'If your body could speak, what would it say about how you\'ve been treating it this week?',
    'What are you tolerating that you know you shouldn\'t be?',
    'What would the version of you who has already solved this problem do today?',
    'Where are you living in your head instead of your body right now?',
    'What truth are you avoiding because it would require you to change?',
  ];
  return reflections[Math.floor(Math.random() * reflections.length)];
}

function generateMicroFramework(ctx) {
  const frameworks = [
    { name: 'The 2-Minute Capacity Check', content: 'Pause. Notice: Am I suppressing (holding it in), discharging (letting it out reactively), or in capacity (feeling it fully while choosing my response)? Name it. Just naming it shifts you toward capacity.' },
    { name: 'The All-The-Time Filter', content: 'Take any identity claim you make ("I am creative") and test it: Is this true ALL the time? If not, it\'s a behavior, not an identity. Real identity is what\'s true even when no one is watching.' },
    { name: 'The Force Audit', content: 'In your next conversation, notice: Am I trying to get this person to do/feel/think something specific? That\'s force. Can I instead share my truth and let them respond freely? That\'s influence.' },
    { name: 'Value Purification', content: 'Pick your top value. Ask: How do I express this purely (for its own sake)? How do I express it in a distorted way (to get something)? The gap between these two answers is your growth edge.' },
    { name: 'The Map Check', content: 'When you feel triggered, ask: Am I reacting to what\'s actually happening (Map 1), or am I reacting from an old pattern (Map 2/3)? The answer changes everything.' },
  ];
  const fw = frameworks[Math.floor(Math.random() * frameworks.length)];
  return JSON.stringify(fw);
}

function generatePatternInsight(ctx) {
  const state = ctx.detectedState || 'awareness';
  const insights = [
    `Your recent sessions show a pattern of moving from ${state} toward greater capacity. This trajectory suggests you\'re building emotional resilience faster than you realize.`,
    `The values you express most frequently are beginning to align with your daily behaviors. This is the early stage of unconscious competence.`,
    `Your coaching responses have been getting deeper over time. The AI has detected less surface-level deflection and more genuine vulnerability.`,
  ];
  return insights[Math.floor(Math.random() * insights.length)];
}

function generateChallenge(ctx) {
  const challenges = [
    { name: '24-Hour Force Fast', content: 'For the next 24 hours, catch yourself every time you try to control an outcome. Instead of forcing, state your truth and release attachment to the response.' },
    { name: 'The Vulnerability Window', content: 'Today, share one genuine feeling with someone you trust — not a thought about a feeling, but the feeling itself. Notice what happens in your body when you do.' },
    { name: 'The Identity Inventory', content: 'Write down 5 things you believe about yourself. For each one, ask: "Is this who I actually am, or who I\'ve been performing?" Be ruthlessly honest.' },
  ];
  const ch = challenges[Math.floor(Math.random() * challenges.length)];
  return JSON.stringify(ch);
}

function generateDeepPattern(ctx) {
  const topValues = ctx.topValues || ['growth', 'authenticity'];
  return `Deep Pattern Detected: Your value of "${topValues[0]}" appears to be in creative tension with your behavioral patterns. When you express ${topValues[0]} purely, you feel energized and aligned. But under stress, it shifts into a distorted form — becoming a tool for external validation rather than internal truth. This pattern connects to your earliest sessions where similar themes emerged. The path forward: notice the moment of shift, and choose the pure expression consciously.`;
}

function generateValueMap(ctx) {
  const values = ctx.topValues || ['growth', 'connection', 'freedom'];
  return JSON.stringify({
    type: 'value_constellation',
    description: `Your top values (${values.join(', ')}) form a constellation. When aligned, they create a powerful force for authentic living. When in conflict, they create the internal friction you sometimes feel. Understanding this map is the key to resolving that friction.`,
    values: values,
  });
}

function generateBreakthrough(ctx) {
  return `Breakthrough Insight: The pattern your sessions reveal is profound — you are not broken, and you never were. The "problems" you bring to coaching are actually your psyche\'s intelligent attempts to protect you using strategies that once worked but have outlived their usefulness. Every session where you show up honestly accelerates the process of updating these strategies. You are not fixing yourself. You are remembering yourself.`;
}

function generateMasterclass(ctx) {
  return JSON.stringify({
    type: 'masterclass',
    title: 'The Architecture of Change',
    content: 'Masterclass unlocked: A deep dive into how lasting transformation actually works. Change doesn\'t happen through willpower or forcing new behaviors. It happens when your internal map of reality updates to match your actual experience. This is why the daily coaching conversation matters — each honest exchange updates your map slightly, and these micro-updates compound into breakthrough moments. The key insight: you cannot think your way into a new way of living. You must live your way into a new way of thinking.',
    duration: '5 min read',
  });
}

export function generateMysteryBox(userId, sessionId = null) {
  const rarity = rollRarity();
  const templates = REWARD_TEMPLATES[rarity];
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  // Build context for reward generation
  const ctx = buildRewardContext(userId);
  const content = template.contentFn(ctx);
  
  const boxId = `box-${uuidv4()}`;
  db.prepare(`INSERT INTO mystery_boxes (id, user_id, session_id, rarity, reward_type, reward_title, reward_content) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(boxId, userId, sessionId, rarity, template.type, template.title, content);
  
  return {
    id: boxId,
    rarity,
    rewardType: template.type,
    rewardTitle: template.title,
    // Don't include content until opened
  };
}

function buildRewardContext(userId) {
  try {
    const values = db.prepare('SELECT value_name, confidence FROM values_detected WHERE user_id = ? ORDER BY confidence DESC LIMIT 5').all(userId);
    const topValues = values.map(v => v.value_name);
    
    const xp = db.prepare('SELECT * FROM user_xp WHERE user_id = ?').get(userId);
    const streak = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(userId);
    
    // Get recent session state
    const recentSession = db.prepare('SELECT detected_state, detected_map FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(userId);
    
    return {
      topValues,
      level: xp?.level || 1,
      streak: streak?.current_streak || 0,
      detectedState: recentSession?.detected_state || 'unknown',
      detectedMap: recentSession?.detected_map || 'unknown',
    };
  } catch {
    return { topValues: ['growth'], level: 1, streak: 0, detectedState: 'unknown', detectedMap: 'unknown' };
  }
}

export function openMysteryBox(userId, boxId) {
  const box = db.prepare('SELECT * FROM mystery_boxes WHERE id = ? AND user_id = ?').get(boxId, userId);
  if (!box) return null;
  if (box.opened) return box; // Already opened
  
  db.prepare(`UPDATE mystery_boxes SET opened = 1, opened_at = datetime('now') WHERE id = ?`).run(boxId);
  
  return {
    ...box,
    opened: 1,
    reward_content: box.reward_content,
  };
}

export function getUserMysteryBoxes(userId, limit = 20) {
  return db.prepare('SELECT * FROM mystery_boxes WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(userId, limit);
}

export function getUnopenedBoxes(userId) {
  return db.prepare('SELECT * FROM mystery_boxes WHERE user_id = ? AND opened = 0 ORDER BY created_at DESC').all(userId);
}

// ── Achievement Functions ──

export function checkAchievements(userId) {
  const xp = db.prepare('SELECT * FROM user_xp WHERE user_id = ?').get(userId);
  const streak = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(userId);
  const valueCount = db.prepare('SELECT COUNT(*) as count FROM values_detected WHERE user_id = ?').get(userId);
  const rareBoxCount = db.prepare("SELECT COUNT(*) as count FROM mystery_boxes WHERE user_id = ? AND rarity = 'rare' AND opened = 1").get(userId);
  const legendaryBoxCount = db.prepare("SELECT COUNT(*) as count FROM mystery_boxes WHERE user_id = ? AND rarity = 'legendary' AND opened = 1").get(userId);
  
  const stats = {
    sessions: xp?.sessions_completed || 0,
    streak: streak?.current_streak || 0,
    level: xp?.level || 1,
    values: valueCount?.count || 0,
    audios: xp?.audios_generated || 0,
    rareBoxes: rareBoxCount?.count || 0,
    legendaryBoxes: legendaryBoxCount?.count || 0,
  };
  
  const newAchievements = [];
  
  for (const def of ACHIEVEMENT_DEFS) {
    if (def.check(stats)) {
      // Check if already unlocked
      const existing = db.prepare('SELECT id FROM achievements WHERE user_id = ? AND achievement_key = ?').get(userId, def.key);
      if (!existing) {
        const achId = `ach-${uuidv4()}`;
        db.prepare('INSERT INTO achievements (id, user_id, achievement_key, title, description, icon) VALUES (?, ?, ?, ?, ?, ?)')
          .run(achId, userId, def.key, def.title, def.description, def.icon);
        newAchievements.push({ id: achId, ...def });
      }
    }
  }
  
  return newAchievements;
}

export function getUserAchievements(userId) {
  return db.prepare('SELECT * FROM achievements WHERE user_id = ? ORDER BY unlocked_at DESC').all(userId);
}

export function getAllAchievementDefs() {
  return ACHIEVEMENT_DEFS.map(d => ({ key: d.key, title: d.title, description: d.description, icon: d.icon }));
}

// ── Session Completion Handler ──
// Call this after script generation to award XP, generate mystery box, and check achievements
export function onSessionComplete(userId, sessionId, options = {}) {
  const results = {
    xpEvents: [],
    levelUp: null,
    mysteryBox: null,
    newAchievements: [],
  };
  
  // Award session completion XP
  const sessionXp = awardXp(userId, 'session_complete', sessionId, 'Daily session completed');
  if (sessionXp) {
    results.xpEvents.push(sessionXp);
    if (sessionXp.levelUp) results.levelUp = sessionXp.levelUp;
  }
  
  // Award script generation XP
  const scriptXp = awardXp(userId, 'script_generated', sessionId, 'Hypnosis script generated');
  if (scriptXp) {
    results.xpEvents.push(scriptXp);
    if (scriptXp.levelUp) results.levelUp = scriptXp.levelUp;
  }
  
  // Award vulnerability bonus if detected
  if (options.vulnerabilityDetected) {
    const vulnXp = awardXp(userId, 'vulnerability_bonus', sessionId, 'Deep vulnerability detected');
    if (vulnXp) {
      results.xpEvents.push(vulnXp);
      if (vulnXp.levelUp) results.levelUp = vulnXp.levelUp;
    }
  }
  
  // Generate mystery box
  results.mysteryBox = generateMysteryBox(userId, sessionId);
  
  // Check for new achievements
  results.newAchievements = checkAchievements(userId);
  
  // Get updated XP state
  results.xpState = getUserXp(userId);
  
  return results;
}

// ── Audio Generation Handler ──
export function onAudioGenerated(userId, sessionId) {
  const xpResult = awardXp(userId, 'audio_generated', sessionId, 'Hypnosis audio generated');
  const achievements = checkAchievements(userId);
  return { xpResult, achievements, xpState: getUserXp(userId) };
}

// ── Value Detection Handler ──
export function onValueDetected(userId, sessionId) {
  return awardXp(userId, 'value_detected', sessionId, 'New value detected');
}

export function onConflictDetected(userId, sessionId) {
  return awardXp(userId, 'conflict_detected', sessionId, 'Value conflict identified');
}
