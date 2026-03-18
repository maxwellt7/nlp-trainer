import { Router } from 'express';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

const router = Router();

const scriptsDir = join(__dirname, '..', 'data', 'scripts');
const audioDir = join(__dirname, '..', 'data', 'audio');

// Ensure directories exist
if (!existsSync(scriptsDir)) mkdirSync(scriptsDir, { recursive: true });
if (!existsSync(audioDir)) mkdirSync(audioDir, { recursive: true });

// GET /scripts — list all saved scripts
router.get('/scripts', (req, res) => {
  try {
    const files = readdirSync(scriptsDir).filter(f => f.endsWith('.json'));
    const scripts = files.map(f => {
      const data = JSON.parse(readFileSync(join(scriptsDir, f), 'utf-8'));
      return data;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ scripts });
  } catch (error) {
    console.error('Error listing scripts:', error.message);
    res.status(500).json({ error: 'Failed to list scripts' });
  }
});

// POST /scripts — save a new script
router.post('/scripts', (req, res) => {
  try {
    const { title, duration, estimatedMinutes, script } = req.body;
    if (!title || !script) {
      return res.status(400).json({ error: 'title and script are required' });
    }

    const id = `script-${Date.now()}`;
    const data = {
      id,
      title,
      duration: duration || 'full',
      estimatedMinutes: estimatedMinutes || 20,
      script,
      audioFile: null,
      createdAt: new Date().toISOString(),
    };

    writeFileSync(join(scriptsDir, `${id}.json`), JSON.stringify(data, null, 2));
    res.json(data);
  } catch (error) {
    console.error('Error saving script:', error.message);
    res.status(500).json({ error: 'Failed to save script' });
  }
});

// POST /generate-audio/:scriptId — generate audio via ElevenLabs
router.post('/generate-audio/:scriptId', async (req, res) => {
  try {
    const { scriptId } = req.params;
    const scriptPath = join(scriptsDir, `${scriptId}.json`);

    if (!existsSync(scriptPath)) {
      return res.status(404).json({ error: 'Script not found' });
    }

    const scriptData = JSON.parse(readFileSync(scriptPath, 'utf-8'));
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'ELEVENLABS_API_KEY not configured' });
    }

    // Use voice ID from env or default to "Rachel" (a calm, soothing voice)
    const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

    // Strip SSML break tags for plain text, or keep them if using SSML mode
    // ElevenLabs supports SSML in their API with model_id that supports it
    const scriptText = scriptData.script;

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: scriptText,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.75,
          style: 0.4,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs error:', response.status, errorText);
      return res.status(502).json({ error: `ElevenLabs API error: ${response.status}` });
    }

    // Save audio file
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const audioFileName = `${scriptId}.mp3`;
    writeFileSync(join(audioDir, audioFileName), audioBuffer);

    // Update script record with audio file reference
    scriptData.audioFile = audioFileName;
    writeFileSync(scriptPath, JSON.stringify(scriptData, null, 2));

    res.json({
      success: true,
      audioFile: audioFileName,
      script: scriptData,
    });
  } catch (error) {
    console.error('Error generating audio:', error.message);
    res.status(500).json({ error: 'Failed to generate audio' });
  }
});

// GET /audio/:filename — serve audio file
router.get('/audio/:filename', (req, res) => {
  const filePath = join(audioDir, req.params.filename);
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'Audio file not found' });
  }
  res.setHeader('Content-Type', 'audio/mpeg');
  res.send(readFileSync(filePath));
});

// DELETE /scripts/:scriptId — delete a script and its audio
router.delete('/scripts/:scriptId', (req, res) => {
  try {
    const { scriptId } = req.params;
    const scriptPath = join(scriptsDir, `${scriptId}.json`);

    if (!existsSync(scriptPath)) {
      return res.status(404).json({ error: 'Script not found' });
    }

    const scriptData = JSON.parse(readFileSync(scriptPath, 'utf-8'));

    // Delete audio file if exists
    if (scriptData.audioFile) {
      const audioPath = join(audioDir, scriptData.audioFile);
      if (existsSync(audioPath)) {
        unlinkSync(audioPath);
      }
    }

    // Delete script file
    unlinkSync(scriptPath);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting script:', error.message);
    res.status(500).json({ error: 'Failed to delete script' });
  }
});

export default router;
