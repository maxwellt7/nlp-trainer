import { Router } from 'express';
import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import anthropic from '../config/anthropic.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
const promptsDir = join(dataDir, 'prompts');

const router = Router();

// Predefined scenario setup instructions
const SCENARIO_SETUPS = {
  sales: 'Activate the SALES scenario. You are Alex, the skeptical business prospect. Begin the conversation in character.',
  coaching: 'Activate the COACHING scenario. You are Jordan, the client who feels stuck. Wait for the practitioner to begin the session.',
  negotiation: 'Activate the NEGOTIATION scenario. You are Morgan, the business partner. Begin by stating your position on the joint venture.',
  'pattern-drill': 'Activate the PATTERN_DRILL scenario. You speak using Milton Model patterns. Start with your first message containing 3 patterns for the student to identify.',
  free: 'Activate the FREE scenario. Wait for the student to describe the character and situation they want to practice with.',
};

// Helper: load all data files to build the full knowledge base (cached)
let contentCache = null;
function loadAllContent() {
  if (contentCache) return contentCache;

  const files = readdirSync(dataDir).filter((f) => f.endsWith('.json') && f !== 'modules.json');
  const allContent = {};

  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(join(dataDir, file), 'utf-8'));
      allContent[file.replace('.json', '')] = data;
    } catch (err) {
      console.warn(`Skipping data file ${file}: ${err.message}`);
    }
  }

  contentCache = allContent;
  return allContent;
}

// Helper: load prompt template and inject content
function loadPrompt(promptFile, content) {
  const template = readFileSync(join(promptsDir, promptFile), 'utf-8');
  return template.replace('{{CONTENT}}', JSON.stringify(content, null, 2));
}

// Helper: parse JSON from Claude's response
function parseJsonResponse(text) {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Try extracting from markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }

    // Try finding the first { to last } or first [ to last ]
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      return JSON.parse(objMatch[0]);
    }

    throw new Error('Could not parse JSON from AI response');
  }
}

// POST /chat - send a message in a practice session
router.post('/chat', async (req, res) => {
  try {
    const { scenario, messages: incomingMessages, message, conversationHistory = [], coached = true, scenarioSetup, customSetup } = req.body;

    // Support both frontend format (messages array) and legacy format (message + conversationHistory)
    let apiMessages;
    if (incomingMessages && Array.isArray(incomingMessages)) {
      // Frontend sends full messages array
      apiMessages = incomingMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: String(m.content) }));
    } else if (message) {
      // Legacy format: build from conversationHistory + message
      apiMessages = conversationHistory
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: String(m.content) }));
      apiMessages.push({ role: 'user', content: String(message) });
    } else {
      return res.status(400).json({ error: 'scenario and messages (or message) are required' });
    }

    if (!scenario || apiMessages.length === 0) {
      return res.status(400).json({ error: 'scenario and at least one message are required' });
    }

    // Prevent excessively long conversation histories
    if (apiMessages.length > 100) {
      return res.status(400).json({ error: 'Conversation too long. Please start a new session.' });
    }

    const scenarioKey = scenario.toLowerCase();
    const setup = scenarioSetup || customSetup;
    const setupInstruction = scenarioKey === 'free' && setup
      ? `Activate the FREE scenario. ${setup}`
      : SCENARIO_SETUPS[scenarioKey];

    if (!setupInstruction) {
      return res.status(400).json({
        error: `Invalid scenario. Choose from: ${Object.keys(SCENARIO_SETUPS).join(', ')}`,
      });
    }

    const allContent = loadAllContent();
    const systemPrompt = loadPrompt('practice-coach.txt', allContent);

    const modeInstruction = coached
      ? 'Respond in COACHED mode — include both dialogue and coaching feedback.'
      : 'Respond in UNCOACHED mode — include only dialogue.';

    const fullSystemPrompt = `${systemPrompt}\n\n--- SESSION SETUP ---\n${setupInstruction}\n\n${modeInstruction}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: fullSystemPrompt,
      messages: apiMessages,
    });

    const text = response.content[0].text;

    let parsed;
    try {
      parsed = parseJsonResponse(text);
    } catch {
      // If JSON parsing fails, wrap the raw text as dialogue
      parsed = coached
        ? { dialogue: text, coaching: null }
        : { dialogue: text };
    }

    res.json({
      response: parsed,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    });
  } catch (error) {
    console.error('Error in practice chat:', error.message);
    res.status(500).json({ error: 'Failed to process practice message' });
  }
});

// POST /debrief - get end-of-session debrief
router.post('/debrief', async (req, res) => {
  try {
    const { scenario, messages: incomingMessages, conversationHistory = [] } = req.body;

    // Support both frontend format (messages) and legacy format (conversationHistory)
    const history = (incomingMessages && Array.isArray(incomingMessages)) ? incomingMessages : conversationHistory;

    if (!scenario || history.length === 0) {
      return res.status(400).json({ error: 'scenario and messages are required' });
    }

    if (history.length > 100) {
      return res.status(400).json({ error: 'Conversation too long for debrief.' });
    }

    const allContent = loadAllContent();
    const systemPrompt = loadPrompt('practice-coach.txt', allContent);

    const scenarioKey = scenario.toLowerCase();
    const setupInstruction = SCENARIO_SETUPS[scenarioKey] || SCENARIO_SETUPS.free;

    const fullSystemPrompt = `${systemPrompt}\n\n--- SESSION SETUP ---\n${setupInstruction}\n\nRespond in COACHED mode.`;

    // Build messages from conversation history, then append debrief request
    // Filter to valid roles and coerce content to string to prevent injection
    const messages = history
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .map(msg => ({ role: msg.role, content: String(msg.content) }));

    messages.push({
      role: 'user',
      content: 'Please provide a DEBRIEF of this entire practice session. Analyze all of my messages throughout the conversation and give me comprehensive feedback on my NLP pattern usage, strengths, areas to improve, and what I should practice next.',
    });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: fullSystemPrompt,
      messages,
    });

    const text = response.content[0].text;

    let parsed;
    try {
      parsed = parseJsonResponse(text);
    } catch {
      parsed = { summary: text };
    }

    res.json({
      debrief: parsed,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    });
  } catch (error) {
    console.error('Error generating debrief:', error.message);
    res.status(500).json({ error: 'Failed to generate session debrief' });
  }
});

export default router;
