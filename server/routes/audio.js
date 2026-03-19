import { Router } from 'express';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, unlinkSync, statSync, createReadStream } from 'fs';
import { dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '..', '.env'), quiet: true });

const router = Router();

const scriptsDir = join(__dirname, '..', 'data', 'scripts');
const audioDir = join(__dirname, '..', 'data', 'audio');
const musicDir = join(__dirname, '..', 'data', 'music');

// Validate that an ID/filename is safe (no path traversal)
function isSafeFilename(name) {
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

// Ensure directories exist
if (!existsSync(scriptsDir)) mkdirSync(scriptsDir, { recursive: true });
if (!existsSync(audioDir)) mkdirSync(audioDir, { recursive: true });
if (!existsSync(musicDir)) mkdirSync(musicDir, { recursive: true });

// Mix voice audio with background music using ffmpeg
// Music plays at lower volume, loops to match voice length, fades in/out
function mixAudioWithMusic(voicePath, musicPath, outputPath, musicVolume = 0.15) {
  // ffmpeg command:
  // - Input 0: voice MP3
  // - Input 1: background music, looped to match voice duration
  // - Filter: lower music volume, fade in 5s, fade out 5s at the end, mix together
  const cmd = [
    'ffmpeg', '-y',
    '-i', `"${voicePath}"`,
    '-stream_loop', '-1', '-i', `"${musicPath}"`,
    '-filter_complex',
    `"[1:a]volume=${musicVolume},afade=t=in:d=5[music];` +
    `[0:a]aresample=44100[voice];` +
    `[music]aresample=44100,afade=t=out:st=0:d=5[musicfade];` +
    `[voice][musicfade]amix=inputs=2:duration=first:dropout_transition=5[out]"`,
    '-map', '"[out]"',
    '-ab', '192k',
    `"${outputPath}"`,
  ].join(' ');

  execSync(cmd, { stdio: 'pipe', timeout: 300000 });
}

// GET /music — list available background music tracks
router.get('/music', (req, res) => {
  try {
    const files = readdirSync(musicDir).filter(f => f.endsWith('.mp3') || f.endsWith('.wav'));
    const tracks = files.map(f => ({
      id: f.replace(/\.(mp3|wav)$/, ''),
      filename: f,
      name: f.replace(/\.(mp3|wav)$/, '').replace(/_/g, ' '),
    }));
    res.json({ tracks });
  } catch (error) {
    console.error('Error listing music:', error.message);
    res.status(500).json({ error: 'Failed to list music tracks' });
  }
});

// GET /scripts — list all saved scripts
router.get('/scripts', (req, res) => {
  try {
    const files = readdirSync(scriptsDir).filter(f => f.endsWith('.json'));
    const scripts = [];
    for (const f of files) {
      try {
        const data = JSON.parse(readFileSync(join(scriptsDir, f), 'utf-8'));
        scripts.push(data);
      } catch (err) {
        console.warn(`Skipping corrupt script file ${f}: ${err.message}`);
      }
    }
    scripts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
    if (typeof title !== 'string' || typeof script !== 'string') {
      return res.status(400).json({ error: 'title and script must be strings' });
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
    res.status(201).json(data);
  } catch (error) {
    console.error('Error saving script:', error.message);
    res.status(500).json({ error: 'Failed to save script' });
  }
});

// POST /generate-audio/:scriptId — generate audio via ElevenLabs
router.post('/generate-audio/:scriptId', async (req, res) => {
  try {
    const { scriptId } = req.params;
    if (!isSafeFilename(scriptId)) {
      return res.status(400).json({ error: 'Invalid script ID' });
    }
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
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.85,
          similarity_boost: 0.80,
          style: 0.15,
          use_speaker_boost: false,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs error:', response.status, errorText);
      return res.status(502).json({ error: `ElevenLabs API error: ${response.status}` });
    }

    // Save voice-only audio file
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const voiceFileName = `${scriptId}-voice.mp3`;
    const voicePath = join(audioDir, voiceFileName);
    writeFileSync(voicePath, audioBuffer);

    // Check if music track was requested
    const { musicTrack, musicVolume } = req.body || {};
    let finalFileName = `${scriptId}.mp3`;
    const finalPath = join(audioDir, finalFileName);

    if (musicTrack && isSafeFilename(musicTrack.replace(/\.(mp3|wav)$/, ''))) {
      const musicPath = join(musicDir, musicTrack);
      if (existsSync(musicPath)) {
        try {
          console.log(`Mixing voice with music: ${musicTrack} at volume ${musicVolume || 0.15}`);
          mixAudioWithMusic(voicePath, musicPath, finalPath, musicVolume || 0.15);
          // Remove voice-only file after successful mix
          unlinkSync(voicePath);
        } catch (mixErr) {
          console.error('Music mixing failed, using voice-only:', mixErr.message);
          // Fall back to voice-only
          writeFileSync(finalPath, audioBuffer);
          if (existsSync(voicePath) && voicePath !== finalPath) unlinkSync(voicePath);
        }
      } else {
        console.warn(`Music track not found: ${musicTrack}, using voice-only`);
        writeFileSync(finalPath, audioBuffer);
        if (existsSync(voicePath)) unlinkSync(voicePath);
      }
    } else {
      // No music requested — just rename voice file to final
      writeFileSync(finalPath, audioBuffer);
      if (existsSync(voicePath)) unlinkSync(voicePath);
    }

    // Update script record with audio file reference
    scriptData.audioFile = finalFileName;
    scriptData.musicTrack = musicTrack || null;
    writeFileSync(scriptPath, JSON.stringify(scriptData, null, 2));

    res.json({
      success: true,
      audioFile: finalFileName,
      musicTrack: musicTrack || null,
      script: scriptData,
    });
  } catch (error) {
    console.error('Error generating audio:', error.message);
    res.status(500).json({ error: 'Failed to generate audio' });
  }
});

// GET /audio/:filename — serve audio file with range request support
router.get('/audio/:filename', (req, res) => {
  const filename = req.params.filename;
  // Only allow safe filenames ending in .mp3
  if (!isSafeFilename(filename.replace('.mp3', '')) || !filename.endsWith('.mp3')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = join(audioDir, filename);
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'Audio file not found' });
  }

  const stat = statSync(filePath);
  const fileSize = stat.size;

  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize || start > end) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', end - start + 1);
    res.setHeader('Content-Type', 'audio/mpeg');
    createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    createReadStream(filePath).pipe(res);
  }
});

// DELETE /scripts/:scriptId — delete a script and its audio
router.delete('/scripts/:scriptId', (req, res) => {
  try {
    const { scriptId } = req.params;
    if (!isSafeFilename(scriptId)) {
      return res.status(400).json({ error: 'Invalid script ID' });
    }
    const scriptPath = join(scriptsDir, `${scriptId}.json`);

    if (!existsSync(scriptPath)) {
      return res.status(404).json({ error: 'Script not found' });
    }

    const scriptData = JSON.parse(readFileSync(scriptPath, 'utf-8'));

    // Delete audio file if exists
    if (scriptData.audioFile) {
      const audioPath = join(audioDir, basename(scriptData.audioFile));
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
