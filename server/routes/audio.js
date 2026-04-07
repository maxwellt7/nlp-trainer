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

// POST /generate-audio/:scriptId — generate audio via ElevenLabs with proper pauses
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

    // Parse script into text segments and pause segments
    const segments = parseScriptSegments(scriptData.script);
    console.log(`[Audio] Parsed ${segments.length} segments (text + pauses)`);

    // If no break tags found, fall back to the old approach (single text block)
    const hasBreaks = segments.some(s => s.type === 'pause');
    
    // ElevenLabs has a 10,000 char limit per request
    const MAX_CHUNK = 9500;

    /**
     * Generate TTS for a text string, potentially splitting into sub-chunks.
     * Returns an array of audio buffers.
     */
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
          throw new Error(`ElevenLabs API error: ${response.status}`);
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
        // Process each segment: generate TTS for text, silence for pauses
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
        // No break tags — single text block (legacy behavior)
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
        tempFiles.splice(tempFiles.indexOf(partFiles[0]), 1); // don't delete the renamed file
      } else {
        const listFile = join(audioDir, `${scriptId}-parts.txt`);
        writeFileSync(listFile, partFiles.map(p => `file '${p}'`).join('\n'));
        tempFiles.push(listFile);
        execFileSync('ffmpeg', [
          '-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', voicePath,
        ], { stdio: 'pipe', timeout: 120000 });
      }

      // Check if music track was requested
      const { musicTrack, musicVolume } = req.body || {};
      let finalFileName = `${scriptId}.mp3`;
      const finalPath = join(audioDir, finalFileName);

      console.log(`[Audio] Music track requested: "${musicTrack}", volume: ${musicVolume}`);
      console.log(`[Audio] Music directory: ${musicDir}`);

      if (musicTrack) {
        // Try to find the music file — be flexible with the filename
        let musicPath = null;

        // Try exact filename first
        const exactPath = join(musicDir, musicTrack);
        if (existsSync(exactPath)) {
          musicPath = exactPath;
        }

        // Try with .mp3 extension if not already present
        if (!musicPath && !musicTrack.endsWith('.mp3') && !musicTrack.endsWith('.wav')) {
          const withMp3 = join(musicDir, `${musicTrack}.mp3`);
          const withWav = join(musicDir, `${musicTrack}.wav`);
          if (existsSync(withMp3)) musicPath = withMp3;
          else if (existsSync(withWav)) musicPath = withWav;
        }

        // Try stripping extension and re-adding
        if (!musicPath) {
          const baseName = musicTrack.replace(/\.(mp3|wav)$/, '');
          const mp3Path = join(musicDir, `${baseName}.mp3`);
          const wavPath = join(musicDir, `${baseName}.wav`);
          if (existsSync(mp3Path)) musicPath = mp3Path;
          else if (existsSync(wavPath)) musicPath = wavPath;
        }

        if (musicPath) {
          try {
            console.log(`[Audio] Mixing voice with music: ${musicPath} at volume ${musicVolume || 0.15}`);
            mixAudioWithMusic(voicePath, musicPath, finalPath, musicVolume || 0.15);
            console.log(`[Audio] Music mixing successful`);
          } catch (mixErr) {
            console.error('[Audio] Music mixing failed, using voice-only:', mixErr.message);
            // Fall back to voice-only
            if (existsSync(voicePath)) {
              renameSync(voicePath, finalPath);
            }
          }
        } else {
          console.warn(`[Audio] Music track not found: "${musicTrack}"`);
          // List available files for debugging
          try {
            const available = readdirSync(musicDir);
            console.log(`[Audio] Available music files:`, available);
          } catch {}
          renameSync(voicePath, finalPath);
        }
      } else {
        // No music requested — just rename voice file to final
        renameSync(voicePath, finalPath);
      }

      // Clean up temp files (but not the final output)
      for (const f of tempFiles) {
        if (f !== finalPath && existsSync(f)) {
          try { unlinkSync(f); } catch {}
        }
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
    } catch (genError) {
      // Clean up any temp files on error
      for (const f of tempFiles) {
        if (existsSync(f)) {
          try { unlinkSync(f); } catch {}
        }
      }
      throw genError;
    }
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
