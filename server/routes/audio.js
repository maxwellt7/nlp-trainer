import { Router } from 'express';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, unlinkSync, renameSync, statSync, createReadStream } from 'fs';
import { dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '..', '.env'), quiet: true });

const router = Router();

// Persistent storage: use /app/storage on Railway (volume mount), fallback to data/ locally
const storageRoot = existsSync('/app/storage') ? '/app/storage' : join(__dirname, '..', 'data');
const scriptsDir = join(storageRoot, 'scripts');
const audioDir = join(storageRoot, 'audio');
// Music is static content shipped with the code, not user-generated
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
  // Validate musicVolume is a safe number in range
  const vol = Number(musicVolume);
  if (!Number.isFinite(vol) || vol < 0 || vol > 1) {
    throw new Error('musicVolume must be a number between 0 and 1');
  }

  // Use execFileSync with argument array to prevent shell injection.
  // Arguments are passed directly to the ffmpeg process, never interpreted by a shell.
  const filterComplex =
    `[1:a]volume=${vol},afade=t=in:d=5[music];` +
    `[0:a]aresample=44100[voice];` +
    `[music]aresample=44100,afade=t=out:st=0:d=5[musicfade];` +
    `[voice][musicfade]amix=inputs=2:duration=first:dropout_transition=5[out]`;

  const args = [
    '-y',
    '-i', voicePath,
    '-stream_loop', '-1', '-i', musicPath,
    '-filter_complex', filterComplex,
    '-map', '[out]',
    '-ab', '192k',
    outputPath,
  ];

  execFileSync('ffmpeg', args, { stdio: 'pipe', timeout: 300000 });
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

    // Strip SSML break tags — ElevenLabs v1 TTS doesn't support SSML
    // Replace breaks with natural pauses (ellipsis + newline) for pacing
    const scriptText = scriptData.script
      .replace(/<break\s+time="[^"]*"\s*\/>/g, '... ')
      .replace(/<[^>]+>/g, '');

    // ElevenLabs has a 10,000 char limit per request — split long scripts into chunks
    const MAX_CHUNK = 9500; // leave margin for safety
    const chunks = [];
    if (scriptText.length <= MAX_CHUNK) {
      chunks.push(scriptText);
    } else {
      let remaining = scriptText;
      while (remaining.length > 0) {
        if (remaining.length <= MAX_CHUNK) {
          chunks.push(remaining);
          break;
        }
        // Split at the last sentence boundary within the limit
        let splitIdx = remaining.lastIndexOf('. ', MAX_CHUNK);
        if (splitIdx === -1 || splitIdx < MAX_CHUNK * 0.5) {
          splitIdx = remaining.lastIndexOf(' ', MAX_CHUNK);
        }
        if (splitIdx === -1) splitIdx = MAX_CHUNK;
        chunks.push(remaining.slice(0, splitIdx + 1));
        remaining = remaining.slice(splitIdx + 1).trimStart();
      }
    }

    // Generate audio for each chunk
    const audioBuffers = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`Generating audio chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`);
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: chunks[i],
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

      audioBuffers.push(Buffer.from(await response.arrayBuffer()));
    }

    // If multiple chunks, concatenate with ffmpeg; otherwise use the single buffer
    const voiceFileName = `${scriptId}-voice.mp3`;
    const voicePath = join(audioDir, voiceFileName);

    if (audioBuffers.length === 1) {
      writeFileSync(voicePath, audioBuffers[0]);
    } else {
      // Write each chunk to a temp file, then concatenate with ffmpeg
      const chunkPaths = audioBuffers.map((buf, i) => {
        const p = join(audioDir, `${scriptId}-chunk-${i}.mp3`);
        writeFileSync(p, buf);
        return p;
      });
      const listFile = join(audioDir, `${scriptId}-chunks.txt`);
      writeFileSync(listFile, chunkPaths.map(p => `file '${p}'`).join('\n'));
      try {
        execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', voicePath], { stdio: 'pipe', timeout: 120000 });
      } finally {
        // Clean up temp files
        chunkPaths.forEach(p => { try { unlinkSync(p); } catch {} });
        try { unlinkSync(listFile); } catch {}
      }
    }

    // Check if music track was requested
    const { musicTrack, musicVolume } = req.body || {};
    let finalFileName = `${scriptId}.mp3`;
    const finalPath = join(audioDir, finalFileName);

    const musicBaseName = musicTrack ? musicTrack.replace(/\.(mp3|wav)$/, '') : '';
    const hasValidExt = musicTrack && (musicTrack.endsWith('.mp3') || musicTrack.endsWith('.wav'));
    if (musicTrack && hasValidExt && isSafeFilename(musicBaseName)) {
      const musicPath = join(musicDir, `${musicBaseName}${musicTrack.endsWith('.wav') ? '.wav' : '.mp3'}`);
      if (existsSync(musicPath)) {
        try {
          console.log(`Mixing voice with music: ${musicTrack} at volume ${musicVolume || 0.15}`);
          mixAudioWithMusic(voicePath, musicPath, finalPath, musicVolume || 0.15);
          // Remove voice-only file after successful mix
          unlinkSync(voicePath);
        } catch (mixErr) {
          console.error('Music mixing failed, using voice-only:', mixErr.message);
          // Fall back to voice-only — rename the already-written voice file
          renameSync(voicePath, finalPath);
        }
      } else {
        console.warn(`Music track not found: ${musicTrack}, using voice-only`);
        renameSync(voicePath, finalPath);
      }
    } else {
      // No music requested — just rename voice file to final
      renameSync(voicePath, finalPath);
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
