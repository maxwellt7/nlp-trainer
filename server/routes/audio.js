import { Router } from 'express';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, unlinkSync, renameSync, statSync, createReadStream } from 'fs';
import { dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import dotenv from 'dotenv';

import { getConfiguredVoices, resolveVoiceSelection } from '../services/audio-voices.js';
import { saveScriptForUser, getScriptsDir } from '../services/scripts.js';
import {
  createJob as createAudioJob,
  setJobRunning as setAudioJobRunning,
  setJobComplete as setAudioJobComplete,
  setJobFailed as setAudioJobFailed,
  getJob as getAudioJob,
  getActiveJobForScript,
} from '../services/audio-jobs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '..', '.env'), quiet: true });

const router = Router();

// Persistent storage: /app/storage on Railway, /tmp on Vercel (read-only /var/task), data/ locally
const storageRoot = existsSync('/app/storage')
  ? '/app/storage'
  : process.env.VERCEL
    ? '/tmp/alignment-engine'
    : join(__dirname, '..', 'data');
const scriptsDir = join(storageRoot, 'scripts');
const audioDir = join(storageRoot, 'audio');
// Music is static content shipped with the code, not user-generated
const musicDir = join(__dirname, '..', 'data', 'music');

// Validate that an ID/filename is safe (no path traversal)
function isSafeFilename(name) {
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

// Ensure directories exist; tolerate read-only filesystems (Vercel) so module load doesn't crash
const ensureDir = (p) => {
  try {
    if (!existsSync(p)) mkdirSync(p, { recursive: true });
  } catch (err) {
    console.warn('audio.js: cannot create', p, '-', err.message);
  }
};
ensureDir(scriptsDir);
ensureDir(audioDir);
ensureDir(musicDir);

/**
 * Generate a silence audio file of the specified duration using ffmpeg.
 * Returns the path to the generated silence file.
 */
function generateSilence(outputPath, durationSeconds) {
  const dur = Math.min(Math.max(Number(durationSeconds) || 1, 0.5), 30); // clamp 0.5s–30s
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', `anullsrc=r=44100:cl=mono`,
    '-t', String(dur),
    '-ab', '192k',
    outputPath,
  ], { stdio: 'pipe', timeout: 30000 });
  return outputPath;
}

/**
 * Parse a script into segments: alternating text and pause durations.
 * Returns an array of { type: 'text', content } or { type: 'pause', duration }.
 */
function parseScriptSegments(scriptText) {
  const segments = [];
  // Match <break time="Xs"/> or <break time="X.Xs"/>
  const breakRegex = /<break\s+time="([\d.]+)s"\s*\/>/g;
  let lastIndex = 0;
  let match;

  while ((match = breakRegex.exec(scriptText)) !== null) {
    // Text before this break
    const textBefore = scriptText.slice(lastIndex, match.index).trim();
    if (textBefore) {
      // Strip any remaining HTML tags
      const cleanText = textBefore.replace(/<[^>]+>/g, '').trim();
      if (cleanText) {
        segments.push({ type: 'text', content: cleanText });
      }
    }
    // The pause
    segments.push({ type: 'pause', duration: parseFloat(match[1]) });
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last break
  const remaining = scriptText.slice(lastIndex).trim();
  if (remaining) {
    const cleanText = remaining.replace(/<[^>]+>/g, '').trim();
    if (cleanText) {
      segments.push({ type: 'text', content: cleanText });
    }
  }

  return segments;
}

/**
 * Mix voice audio with background music using ffmpeg.
 * Music plays at lower volume, loops to match voice length, fades in/out.
 */
function mixAudioWithMusic(voicePath, musicPath, outputPath, musicVolume = 0.15) {
  const vol = Number(musicVolume);
  if (!Number.isFinite(vol) || vol < 0 || vol > 1) {
    throw new Error('musicVolume must be a number between 0 and 1');
  }

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
    console.log(`[Audio] Listing music from: ${musicDir}`);
    const files = readdirSync(musicDir).filter(f => f.endsWith('.mp3') || f.endsWith('.wav'));
    console.log(`[Audio] Found ${files.length} music files:`, files);
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

// GET /voices — list configured ElevenLabs voices
router.get('/voices', (req, res) => {
  try {
    const { voices, defaultVoiceId } = getConfiguredVoices();
    res.json({ voices, defaultVoiceId });
  } catch (error) {
    console.error('Error listing voices:', error.message);
    res.status(500).json({ error: 'Failed to list voices' });
  }
});

// GET /scripts — list saved scripts for the current user
router.get('/scripts', (req, res) => {
  try {
    const userId = req.userId;
    const files = readdirSync(scriptsDir).filter(f => f.endsWith('.json'));
    const scripts = [];
    for (const f of files) {
      try {
        const data = JSON.parse(readFileSync(join(scriptsDir, f), 'utf-8'));
        // Only include scripts belonging to this user (or legacy scripts with no userId)
        if (data.userId === userId || (!data.userId && userId === 'default-user')) {
          scripts.push(data);
        }
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

    const data = saveScriptForUser({
      userId: req.userId,
      title,
      duration,
      estimatedMinutes,
      script,
    });
    res.status(201).json(data);
  } catch (error) {
    console.error('Error saving script:', error.message);
    res.status(500).json({ error: 'Failed to save script' });
  }
});

// Long-running ElevenLabs render extracted so the route can dispatch it as
// a background job. Resolves to the same shape the synchronous endpoint
// used to return; rejects with an Error whose message is what gets stored
// in the audio_jobs row for the client to see.
async function renderAudio({ scriptId, scriptPath, scriptData, requestedVoiceId, musicTrack, musicVolume }) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not configured');

  const selectedVoice = resolveVoiceSelection(requestedVoiceId);
  const voiceId = selectedVoice.id;

  // Parse script into text segments and pause segments
  const segments = parseScriptSegments(scriptData.script);
  console.log(`[Audio] Parsed ${segments.length} segments (text + pauses)`);

  // If no SSML <break> tags found, fall back to a single-text-block render.
  const hasBreaks = segments.some((s) => s.type === 'pause');

  // ElevenLabs has a 10,000 char limit per request
  const MAX_CHUNK = 9500;

  async function generateTTS(text) {
    const chunks = [];
    if (text.length <= MAX_CHUNK) {
      chunks.push(text);
    } else {
      let remaining = text;
      while (remaining.length > 0) {
        if (remaining.length <= MAX_CHUNK) {
          chunks.push(remaining);
          break;
        }
        let splitIdx = remaining.lastIndexOf('. ', MAX_CHUNK);
        if (splitIdx === -1 || splitIdx < MAX_CHUNK * 0.5) {
          splitIdx = remaining.lastIndexOf(' ', MAX_CHUNK);
        }
        if (splitIdx === -1) splitIdx = MAX_CHUNK;
        chunks.push(remaining.slice(0, splitIdx + 1));
        remaining = remaining.slice(splitIdx + 1).trimStart();
      }
    }

    const buffers = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`[Audio] TTS chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`);
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
        console.error('[Audio] ElevenLabs error:', response.status, errorText);
        // Surface the real ElevenLabs detail so it lands in the audio_jobs
        // row and the UI can show something other than "Failed to generate audio".
        throw new Error(`ElevenLabs ${response.status}: ${errorText.slice(0, 200)}`);
      }

      buffers.push(Buffer.from(await response.arrayBuffer()));
    }
    return buffers;
  }

  // Generate audio parts (voice segments + silence segments)
  const partFiles = [];
  const tempFiles = []; // track all temp files for cleanup

  try {
    if (hasBreaks) {
      let partIndex = 0;
      for (const segment of segments) {
        if (segment.type === 'text') {
          const buffers = await generateTTS(segment.content);
          for (const buf of buffers) {
            const partPath = join(audioDir, `${scriptId}-part-${partIndex}.mp3`);
            writeFileSync(partPath, buf);
            partFiles.push(partPath);
            tempFiles.push(partPath);
            partIndex++;
          }
        } else if (segment.type === 'pause') {
          const silencePath = join(audioDir, `${scriptId}-silence-${partIndex}.mp3`);
          console.log(`[Audio] Generating ${segment.duration}s silence`);
          generateSilence(silencePath, segment.duration);
          partFiles.push(silencePath);
          tempFiles.push(silencePath);
          partIndex++;
        }
      }
    } else {
      const cleanText = scriptData.script.replace(/<[^>]+>/g, '');
      const buffers = await generateTTS(cleanText);
      let partIndex = 0;
      for (const buf of buffers) {
        const partPath = join(audioDir, `${scriptId}-part-${partIndex}.mp3`);
        writeFileSync(partPath, buf);
        partFiles.push(partPath);
        tempFiles.push(partPath);
        partIndex++;
      }
    }

    // Concatenate all parts into a single voice file
    const voiceFileName = `${scriptId}-voice.mp3`;
    const voicePath = join(audioDir, voiceFileName);
    tempFiles.push(voicePath);

    if (partFiles.length === 1) {
      renameSync(partFiles[0], voicePath);
      tempFiles.splice(tempFiles.indexOf(partFiles[0]), 1);
    } else {
      const listFile = join(audioDir, `${scriptId}-parts.txt`);
      writeFileSync(listFile, partFiles.map(p => `file '${p}'`).join('\n'));
      tempFiles.push(listFile);
      execFileSync('ffmpeg', [
        '-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', voicePath,
      ], { stdio: 'pipe', timeout: 120000 });
    }

    let finalFileName = `${scriptId}.mp3`;
    const finalPath = join(audioDir, finalFileName);

    console.log(`[Audio] Music track requested: "${musicTrack}", volume: ${musicVolume}`);

    if (musicTrack) {
      let musicPath = null;
      const exactPath = join(musicDir, musicTrack);
      if (existsSync(exactPath)) musicPath = exactPath;
      if (!musicPath && !musicTrack.endsWith('.mp3') && !musicTrack.endsWith('.wav')) {
        const withMp3 = join(musicDir, `${musicTrack}.mp3`);
        const withWav = join(musicDir, `${musicTrack}.wav`);
        if (existsSync(withMp3)) musicPath = withMp3;
        else if (existsSync(withWav)) musicPath = withWav;
      }
      if (!musicPath) {
        const baseName = musicTrack.replace(/\.(mp3|wav)$/, '');
        const mp3Path = join(musicDir, `${baseName}.mp3`);
        const wavPath = join(musicDir, `${baseName}.wav`);
        if (existsSync(mp3Path)) musicPath = mp3Path;
        else if (existsSync(wavPath)) musicPath = wavPath;
      }

      if (musicPath) {
        try {
          mixAudioWithMusic(voicePath, musicPath, finalPath, musicVolume || 0.15);
        } catch (mixErr) {
          console.error('[Audio] Music mixing failed, using voice-only:', mixErr.message);
          if (existsSync(voicePath)) renameSync(voicePath, finalPath);
        }
      } else {
        console.warn(`[Audio] Music track not found: "${musicTrack}"`);
        renameSync(voicePath, finalPath);
      }
    } else {
      renameSync(voicePath, finalPath);
    }

    for (const f of tempFiles) {
      if (f !== finalPath && existsSync(f)) {
        try { unlinkSync(f); } catch { /* ignore */ }
      }
    }

    // Update script record with audio file reference
    scriptData.audioFile = finalFileName;
    scriptData.musicTrack = musicTrack || null;
    scriptData.voiceId = selectedVoice.id;
    scriptData.voiceLabel = selectedVoice.label;
    writeFileSync(scriptPath, JSON.stringify(scriptData, null, 2));

    return {
      success: true,
      audioFile: finalFileName,
      musicTrack: musicTrack || null,
      voiceId: selectedVoice.id,
      voiceLabel: selectedVoice.label,
      script: scriptData,
    };
  } catch (genError) {
    for (const f of tempFiles) {
      if (existsSync(f)) {
        try { unlinkSync(f); } catch { /* ignore */ }
      }
    }
    throw genError;
  }
}

// POST /generate-audio/:scriptId — kicks off ElevenLabs render as a background job.
// Returns 202 + jobId immediately. Frontend polls /audio-status/:jobId until
// status is complete or failed. Survives mobile backgrounding because all
// the work is server-side.
router.post('/generate-audio/:scriptId', async (req, res) => {
  try {
    const { scriptId } = req.params;
    if (!isSafeFilename(scriptId)) {
      return res.status(400).json({ error: 'Invalid script ID' });
    }
    const sPath = join(scriptsDir, `${scriptId}.json`);
    if (!existsSync(sPath)) {
      return res.status(404).json({ error: 'Script not found' });
    }

    const scriptData = JSON.parse(readFileSync(sPath, 'utf-8'));
    if (scriptData.userId && scriptData.userId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to access this script' });
    }

    // If a render is already in flight for this script, return it instead of
    // starting a duplicate (would race over the same temp files).
    const existing = getActiveJobForScript(req.userId, scriptId);
    if (existing) {
      return res.status(202).json({ jobId: existing.id, status: existing.status });
    }

    const { voiceId: requestedVoiceId, musicTrack, musicVolume } = req.body || {};
    const job = createAudioJob(req.userId, scriptId);
    res.status(202).json({ jobId: job.id, status: 'queued' });

    setImmediate(async () => {
      try {
        setAudioJobRunning(job.id);
        const result = await renderAudio({
          scriptId,
          scriptPath: sPath,
          scriptData,
          requestedVoiceId,
          musicTrack,
          musicVolume,
        });
        setAudioJobComplete(job.id, result);
      } catch (err) {
        console.error('[audio] job failed:', err.message);
        setAudioJobFailed(job.id, err.message || 'Audio generation failed');
      }
    });
  } catch (error) {
    console.error('Error starting audio generation:', error.message);
    res.status(500).json({ error: error.message || 'Failed to start audio generation' });
  }
});

// GET /audio-status/:jobId — poll endpoint for the audio render job.
router.get('/audio-status/:jobId', (req, res) => {
  const job = getAudioJob(req.params.jobId, req.userId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({
    jobId: job.id,
    status: job.status,
    result: job.status === 'complete' ? job.result : undefined,
    error: job.status === 'failed' ? job.error : undefined,
  });
});

// GET /audio-active/:scriptId — frontend recovery: "is there an in-flight audio
// render I should be polling for this script?" Used after refresh / re-open.
router.get('/audio-active/:scriptId', (req, res) => {
  const job = getActiveJobForScript(req.userId, req.params.scriptId);
  if (!job) return res.json({ jobId: null });
  res.json({ jobId: job.id, status: job.status });
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

    // Verify ownership
    if (scriptData.userId && scriptData.userId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this script' });
    }

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
