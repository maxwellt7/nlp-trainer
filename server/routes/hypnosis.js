import { Router } from 'express';
import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import anthropic from '../config/anthropic.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
const promptsDir = join(dataDir, 'prompts');

const router = Router();

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

function loadPrompt(promptFile, content) {
  const template = readFileSync(join(promptsDir, promptFile), 'utf-8');
  return template.replace('{{CONTENT}}', JSON.stringify(content, null, 2));
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

// POST /chat — intake conversation
router.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const allContent = loadAllContent();
    const systemPrompt = loadPrompt('hypnotist.txt', allContent);

    const fullSystemPrompt = `${systemPrompt}\n\nYou are in INTAKE phase. Conduct the intake conversation. Respond in JSON format: {"reply": "...", "readyToGenerate": false/true}`;

    // Limit conversation length and validate roles
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
      system: fullSystemPrompt,
      messages: apiMessages,
    });

    const text = response.content[0].text;
    let parsed;
    try {
      parsed = parseJsonResponse(text);
    } catch {
      parsed = { reply: text, readyToGenerate: false };
    }

    res.json({
      reply: parsed.reply || text,
      readyToGenerate: parsed.readyToGenerate === true,
    });
  } catch (error) {
    console.error('Hypnosis chat error:', error.message);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// POST /generate — generate the hypnosis script
router.post('/generate', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const allContent = loadAllContent();
    const systemPrompt = loadPrompt('hypnotist.txt', allContent);

    const fullSystemPrompt = `${systemPrompt}\n\nYou are in GENERATION phase. Based on the intake conversation, generate the complete self-hypnosis script. Respond in JSON format: {"title": "...", "duration": "short" or "full", "estimatedMinutes": number, "script": "..."}`;

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
      system: fullSystemPrompt,
      messages: apiMessages,
    });

    const text = response.content[0].text;
    let parsed;
    try {
      parsed = parseJsonResponse(text);
    } catch {
      parsed = { title: 'Hypnosis Script', duration: 'full', estimatedMinutes: 20, script: text };
    }

    res.json({
      title: parsed.title || 'Hypnosis Script',
      duration: parsed.duration || 'full',
      estimatedMinutes: parsed.estimatedMinutes || 20,
      script: parsed.script || text,
    });
  } catch (error) {
    console.error('Hypnosis generate error:', error.message);
    res.status(500).json({ error: 'Failed to generate script' });
  }
});

export default router;
