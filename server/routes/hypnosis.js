import { Router } from 'express';
import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import anthropic from '../config/anthropic.js';
import { ensureDefaultUser, getProfileForPrompt, updateProfile, updateStreak } from '../services/profile.js';
import { createSession, updateSessionMessages, updateSessionMetadata, buildMemoryContext, getTodaySession } from '../services/memory.js';
import { buildIdentityContext, processValueDetections, upsertIdentityStatement } from '../services/identity.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
const promptsDir = join(dataDir, 'prompts');

const router = Router();

// Cache for NLP content
let nlpContentCache = null;
function loadNlpContent() {
  if (nlpContentCache) return nlpContentCache;
  const files = readdirSync(dataDir).filter(f => f.endsWith('.json') && f !== 'modules.json' && f !== 'coaching-frameworks.json');
  const allContent = {};
  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(join(dataDir, file), 'utf-8'));
      allContent[file.replace('.json', '')] = data;
    } catch (err) {
      console.warn(`Skipping data file ${file}: ${err.message}`);
    }
  }
  nlpContentCache = allContent;
  return allContent;
}

// Load coaching frameworks
let coachingCache = null;
function loadCoachingFrameworks() {
  if (coachingCache) return coachingCache;
  try {
    coachingCache = JSON.parse(readFileSync(join(dataDir, 'coaching-frameworks.json'), 'utf-8'));
  } catch (err) {
    console.warn('Could not load coaching frameworks:', err.message);
    coachingCache = {};
  }
  return coachingCache;
}

// Build the full system prompt with all context injected
function buildSystemPrompt(userId, phase) {
  const template = readFileSync(join(promptsDir, 'daily-coach.txt'), 'utf-8');
  const nlpContent = loadNlpContent();
  const coachingFrameworks = loadCoachingFrameworks();
  const profile = getProfileForPrompt(userId);
  const memoryContext = buildMemoryContext(userId);

  const identityContext = buildIdentityContext(userId);

  let prompt = template
    .replace('{{NLP_CONTENT}}', JSON.stringify(nlpContent, null, 2))
    .replace('{{COACHING_FRAMEWORKS}}', JSON.stringify(coachingFrameworks, null, 2))
    .replace('{{USER_PROFILE}}', profile ? JSON.stringify(profile, null, 2) : 'No profile data yet — this is a new user.')
    .replace('{{IDENTITY_CONTEXT}}', identityContext)
    .replace('{{MEMORY_CONTEXT}}', memoryContext);

  if (phase === 'coaching') {
    prompt += '\n\nYou are in COACHING phase. Conduct the daily coaching conversation. Ask ONE question at a time. Respond in the COACHING JSON format.';
  } else if (phase === 'generation') {
    prompt += '\n\nYou are in GENERATION phase. Based on the coaching conversation, generate the complete personalized hypnosis script. Respond in the GENERATION JSON format.';
  }

  return prompt;
}

function parseJsonResponse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1].trim());
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) return JSON.parse(objMatch[0]);
    throw new Error('Could not parse JSON from AI response');
  }
}

// POST /chat — daily coaching conversation
router.post('/chat', async (req, res) => {
  try {
    const { messages, sessionId, moodBefore } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const userId = ensureDefaultUser();

    // Create or retrieve session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const existing = getTodaySession(userId);
      if (existing) {
        currentSessionId = existing.id;
      } else {
        const newSession = createSession(userId, moodBefore || null);
        currentSessionId = newSession.id;
      }
    }

    const systemPrompt = buildSystemPrompt(userId, 'coaching');

    if (messages.length > 50) {
      return res.status(400).json({ error: 'Conversation too long. Please start a new session.' });
    }

    const apiMessages = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: String(m.content) }));

    if (apiMessages.length === 0) {
      return res.status(400).json({ error: 'No valid messages provided' });
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: apiMessages,
    });

    const text = response.content[0].text;
    let parsed;
    try {
      parsed = parseJsonResponse(text);
    } catch {
      parsed = { reply: text, readyToGenerate: false, profileUpdates: {} };
    }

    // Save messages to session
    updateSessionMessages(currentSessionId, messages.concat([
      { role: 'assistant', content: parsed.reply || text }
    ]));

    // Apply profile updates if detected
    if (parsed.profileUpdates) {
      const pu = parsed.profileUpdates;
      const profileUpdate = {};

      if (pu.detected_map) {
        updateSessionMetadata(currentSessionId, { detected_map: pu.detected_map });
      }
      if (pu.detected_state) {
        updateSessionMetadata(currentSessionId, { detected_state: pu.detected_state });
      }
      if (pu.key_themes && pu.key_themes.length > 0) {
        updateSessionMetadata(currentSessionId, { key_themes: pu.key_themes });
      }

      // Update meta-programs if detected
      if (pu.meta_programs) {
        const currentProfile = getProfileForPrompt(userId);
        const currentMeta = currentProfile?.meta_programs || {};
        const newMeta = { ...currentMeta };
        for (const [key, value] of Object.entries(pu.meta_programs)) {
          if (value && value !== null) {
            newMeta[key] = value;
          }
        }
        profileUpdate.meta_programs = newMeta;
      }

      // Update capacity index based on detected state
      if (pu.detected_state) {
        const currentProfile = getProfileForPrompt(userId);
        const cap = currentProfile?.capacity_index || { suppression: 5, discharge: 5, capacity: 5 };
        if (pu.detected_state === 'suppression') { cap.suppression = Math.min(10, cap.suppression + 0.5); cap.capacity = Math.max(0, cap.capacity - 0.3); }
        if (pu.detected_state === 'discharge') { cap.discharge = Math.min(10, cap.discharge + 0.5); cap.capacity = Math.max(0, cap.capacity - 0.3); }
        if (pu.detected_state === 'capacity') { cap.capacity = Math.min(10, cap.capacity + 0.5); cap.suppression = Math.max(0, cap.suppression - 0.2); cap.discharge = Math.max(0, cap.discharge - 0.2); }
        profileUpdate.capacity_index = cap;
      }

      // Update force audit
      if (pu.force_pattern) {
        const currentProfile = getProfileForPrompt(userId);
        const force = currentProfile?.force_audit || { overt: 0, subtle: 5, clean: 5 };
        if (pu.force_pattern === 'subtle') { force.subtle = Math.min(10, force.subtle + 0.5); force.clean = Math.max(0, force.clean - 0.3); }
        if (pu.force_pattern === 'clean') { force.clean = Math.min(10, force.clean + 0.5); force.subtle = Math.max(0, force.subtle - 0.2); }
        profileUpdate.force_audit = force;
      }

      // Update victim/healer
      if (pu.victim_healer) {
        const currentProfile = getProfileForPrompt(userId);
        const vh = currentProfile?.victim_healer || { score: 0, trending: 'stable' };
        if (pu.victim_healer === 'victim') { vh.score = Math.max(-5, vh.score - 0.5); vh.trending = 'declining'; }
        if (pu.victim_healer === 'healer') { vh.score = Math.min(5, vh.score + 0.5); vh.trending = 'improving'; }
        if (pu.victim_healer === 'mixed') { vh.trending = 'stable'; }
        profileUpdate.victim_healer = vh;
      }

      if (Object.keys(profileUpdate).length > 0) {
        updateProfile(userId, profileUpdate);
      }
    }

    // Process value detections from AI
    if (parsed.valueDetections && Array.isArray(parsed.valueDetections) && parsed.valueDetections.length > 0) {
      try {
        processValueDetections(userId, currentSessionId, parsed.valueDetections);
      } catch (err) {
        console.warn('Value detection processing error:', err.message);
      }
    }

    // Process identity statements from AI
    if (parsed.identityStatements && Array.isArray(parsed.identityStatements) && parsed.identityStatements.length > 0) {
      try {
        for (const stmt of parsed.identityStatements) {
          if (stmt.statement_type && stmt.content) {
            upsertIdentityStatement(userId, stmt);
          }
        }
      } catch (err) {
        console.warn('Identity statement processing error:', err.message);
      }
    }

    res.json({
      reply: parsed.reply || text,
      readyToGenerate: parsed.readyToGenerate === true,
      sessionId: currentSessionId,
      profileUpdates: parsed.profileUpdates || {},
    });
  } catch (error) {
    console.error('Hypnosis chat error:', error.message);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// POST /generate — generate the hypnosis script
router.post('/generate', async (req, res) => {
  try {
    const { messages, sessionId } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const userId = ensureDefaultUser();
    const systemPrompt = buildSystemPrompt(userId, 'generation');

    if (messages.length > 50) {
      return res.status(400).json({ error: 'Conversation too long.' });
    }

    const apiMessages = [
      ...messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: String(m.content) })),
      { role: 'user', content: 'Please generate my personalized hypnosis script now based on everything we discussed.' },
    ];

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: apiMessages,
    });

    const text = response.content[0].text;
    let parsed;
    try {
      parsed = parseJsonResponse(text);
    } catch {
      parsed = { title: 'Hypnosis Script', duration: 'full', estimatedMinutes: 20, script: text, sessionSummary: '', keyThemes: [] };
    }

    // Update session with summary and themes
    if (sessionId) {
      updateSessionMetadata(sessionId, {
        chat_summary: parsed.sessionSummary || '',
        key_themes: parsed.keyThemes || [],
      });

      // Update streak
      updateStreak(userId);
    }

    res.json({
      title: parsed.title || 'Hypnosis Script',
      duration: parsed.duration || 'full',
      estimatedMinutes: parsed.estimatedMinutes || 20,
      script: parsed.script || text,
      sessionSummary: parsed.sessionSummary || '',
      keyThemes: parsed.keyThemes || [],
    });
  } catch (error) {
    console.error('Hypnosis generate error:', error.message);
    res.status(500).json({ error: 'Failed to generate script' });
  }
});

export default router;
