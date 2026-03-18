import { Router } from 'express';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import anthropic from '../config/anthropic.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
const promptsDir = join(dataDir, 'prompts');

const router = Router();

// Helper: load and parse a JSON file from the data directory
function loadDataFile(filename) {
  const filePath = join(dataDir, filename);
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

// Helper: load modules.json
function loadModules() {
  return loadDataFile('modules.json');
}

// Helper: load lesson content, optionally filtered by contentKeys
function loadLessonContent(lesson) {
  const data = loadDataFile(lesson.dataFile);

  if (!lesson.contentKeys || lesson.contentKeys.length === 0) {
    return data;
  }

  // Filter to only the specified content keys
  // Search top-level first, then one level deep for nested structures
  const filtered = {};
  for (const key of lesson.contentKeys) {
    if (data[key] !== undefined) {
      filtered[key] = data[key];
    } else {
      // Search one level deep inside nested objects
      for (const topKey of Object.keys(data)) {
        if (data[topKey] && typeof data[topKey] === 'object' && !Array.isArray(data[topKey])) {
          if (data[topKey][key] !== undefined) {
            filtered[key] = data[topKey][key];
            break;
          }
        }
      }
    }
  }
  return filtered;
}

// Helper: find a lesson by ID across all modules
function findLesson(lessonId) {
  const data = loadModules();
  const modules = data.modules || data;
  for (const mod of modules) {
    for (const lesson of mod.lessons) {
      if (lesson.id === lessonId) {
        return { lesson, module: mod };
      }
    }
  }
  return null;
}

// Helper: load a prompt template and inject content
function loadPrompt(promptFile, content) {
  const template = readFileSync(join(promptsDir, promptFile), 'utf-8');
  return template.replace('{{CONTENT}}', JSON.stringify(content, null, 2));
}

// Helper: determine quiz type guidance based on module number
function getQuizTypeGuidance(moduleNumber) {
  if (moduleNumber >= 1 && moduleNumber <= 4) {
    return 'Focus on these question types: multiple_choice, pattern_identification, construction. These modules cover NLP language patterns — test recognition, identification, and ability to construct examples.';
  } else if (moduleNumber === 5) {
    return 'Focus on these question types: meta_program_match, multiple_choice. These lessons cover Meta Programs — test ability to identify which filter result a response exhibits and select correct linguistic markers.';
  } else if (moduleNumber === 6) {
    return 'Focus on scenario-based session flow questions. Test understanding of when and how to apply techniques in real coaching/therapy sessions. Use multiple_choice and construction types.';
  }
  return 'Use a mix of all question types.';
}

// GET /modules - return curriculum structure
router.get('/modules', (req, res) => {
  try {
    const data = loadModules();
    res.json(data);
  } catch (error) {
    console.error('Error loading modules:', error.message);
    res.status(500).json({ error: 'Failed to load curriculum modules' });
  }
});

// GET /lesson/:lessonId - load lesson content
router.get('/lesson/:lessonId', (req, res) => {
  try {
    const result = findLesson(req.params.lessonId);
    if (!result) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const rawContent = loadLessonContent(result.lesson);
    // Frontend expects content as array of { key, data } objects
    const content = Object.entries(rawContent).map(([key, data]) => ({ key, data }));
    res.json({
      lesson: result.lesson,
      module: { id: result.module.id, title: result.module.title },
      content,
    });
  } catch (error) {
    console.error('Error loading lesson:', error.message);
    res.status(500).json({ error: 'Failed to load lesson content' });
  }
});

// POST /quiz - generate quiz using Claude
router.post('/quiz', async (req, res) => {
  try {
    const { lessonId } = req.body;
    if (!lessonId) {
      return res.status(400).json({ error: 'lessonId is required' });
    }

    const result = findLesson(lessonId);
    if (!result) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const content = loadLessonContent(result.lesson);
    const systemPrompt = loadPrompt('quiz-master.txt', content);

    const moduleNumber = parseInt(result.module.id.replace('module-', ''), 10);
    const typeGuidance = getQuizTypeGuidance(moduleNumber);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Generate a quiz for the lesson: "${result.lesson.title}". ${typeGuidance}\n\nReturn ONLY the JSON array of 5 question objects, no other text.`,
        },
      ],
    });

    const text = response.content[0].text;

    // Try to parse JSON from the response
    let questions;
    try {
      questions = JSON.parse(text);
    } catch {
      // Try extracting JSON from markdown code block
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error('Failed to parse quiz questions from AI response');
      }
    }

    res.json({ lessonId, questions });
  } catch (error) {
    console.error('Error generating quiz:', error.message);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
});

// POST /quiz/evaluate - evaluate quiz answers using Claude
router.post('/quiz/evaluate', async (req, res) => {
  try {
    const { lessonId, questions, userAnswers } = req.body;
    const answers = userAnswers;
    if (!lessonId || !questions || !answers) {
      return res.status(400).json({ error: 'lessonId, questions, and userAnswers are required' });
    }

    const result = findLesson(lessonId);
    if (!result) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const content = loadLessonContent(result.lesson);
    const systemPrompt = loadPrompt('quiz-master.txt', content);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Evaluate these quiz answers. Questions:\n${JSON.stringify(questions, null, 2)}\n\nStudent answers:\n${JSON.stringify(answers, null, 2)}\n\nReturn ONLY the JSON evaluation object with results, overallScore, and summary.`,
        },
      ],
    });

    const text = response.content[0].text;

    let evaluation;
    try {
      evaluation = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        evaluation = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error('Failed to parse evaluation from AI response');
      }
    }

    res.json(evaluation);
  } catch (error) {
    console.error('Error evaluating quiz:', error.message);
    res.status(500).json({ error: 'Failed to evaluate quiz answers' });
  }
});

// GET /reference - return all content for reference mode
router.get('/reference', (req, res) => {
  try {
    res.json({
      miltonModel: loadDataFile('milton-model.json'),
      metaPrograms: loadDataFile('meta-programs.json'),
      presuppositions: loadDataFile('presuppositions.json'),
      primeDirectives: loadDataFile('prime-directives.json'),
      quantumLinguistics: loadDataFile('quantum-linguistics.json'),
      personalBreakthrough: loadDataFile('personal-breakthrough.json'),
    });
  } catch (error) {
    console.error('Error loading reference content:', error.message);
    res.status(500).json({ error: 'Failed to load reference content' });
  }
});

export default router;
