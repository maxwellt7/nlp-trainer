import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'recording' | 'stopping';

// Hard cap per turn — protects transcription spend and the 15 MB upload limit.
const MAX_RECORDING_MS = 90_000;

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) || '';
}

// Push-to-talk recorder. The mic stream is acquired on start() and fully
// released after every turn (required for iOS — a held stream blocks other
// audio and keeps the red indicator on).
export function useVoiceRecorder() {
  const [state, setState] = useState<RecorderState>('idle');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const resolveRef = useRef<((b: Blob | null) => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => () => {
    try { recRef.current?.stop(); } catch { /* already stopped */ }
    cleanup();
  }, [cleanup]);

  const start = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (recRef.current) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMimeType();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const type = rec.mimeType || mime || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        cleanup();
        setState('idle');
        // <1 KB is a tap, not speech — treat as nothing said.
        resolveRef.current?.(blob.size > 1000 ? blob : null);
        resolveRef.current = null;
      };
      rec.start();
      recRef.current = rec;
      setState('recording');
      timerRef.current = setTimeout(() => { try { rec.stop(); } catch { /* raced */ } }, MAX_RECORDING_MS);
      return true;
    } catch {
      cleanup();
      setState('idle');
      setError('Microphone unavailable. Allow mic access in Settings and try again.');
      return false;
    }
  }, [cleanup]);

  const stop = useCallback((): Promise<Blob | null> => {
    const rec = recRef.current;
    if (!rec || rec.state === 'inactive') return Promise.resolve(null);
    setState('stopping');
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      try { rec.stop(); } catch { cleanup(); setState('idle'); resolve(null); }
    });
  }, [cleanup]);

  const cancel = useCallback(() => {
    resolveRef.current = null;
    try { recRef.current?.stop(); } catch { /* already stopped */ }
    cleanup();
    setState('idle');
  }, [cleanup]);

  return { state, error, start, stop, cancel };
}
