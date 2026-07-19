import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import type { useVoiceRecorder } from '../../hooks/useVoiceRecorder';

type Phase = 'preparing' | 'gate' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'paused';

// Full-screen turn-based voice conversation: listen → think → speak → listen.
// Portaled to body (rd overlay rule: position:fixed inside AppShell's scroll
// container is broken on iOS). The first tap ("begin") doubles as the iOS
// audio unlock — auto-playing TTS without a gesture would be blocked.
export default function VoiceSession({ ready, lastReply, onSend, speak, stopSpeaking, recorder, onClose }: {
  ready: boolean;
  lastReply: string;
  onSend: (text: string) => Promise<string | null>;
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => void;
  recorder: ReturnType<typeof useVoiceRecorder>;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>(ready ? 'gate' : 'preparing');
  const [heard, setHeard] = useState('');
  const [reply, setReply] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const aliveRef = useRef(true);
  const busyRef = useRef(false);

  useEffect(() => () => { aliveRef.current = false; }, []);

  useEffect(() => {
    if (ready) setPhase((p) => (p === 'preparing' ? 'gate' : p));
  }, [ready]);

  const startListening = useCallback(async () => {
    if (!aliveRef.current) return;
    setNote(null);
    const ok = await recorder.start();
    if (!aliveRef.current) { recorder.cancel(); return; }
    if (ok) {
      setPhase('listening');
    } else {
      setPhase('paused');
      setNote(recorder.error || 'Microphone unavailable. Check mic permissions.');
    }
  }, [recorder]);

  // One full turn: stop recording → transcribe → coach → speak → listen again.
  const finishTurn = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      setPhase('transcribing');
      const blob = await recorder.stop();
      if (!aliveRef.current) return;
      if (!blob) { setPhase('paused'); setNote("Didn't catch that — tap to try again."); return; }
      let text = '';
      try {
        text = (await api.voiceTranscribe(blob)).text;
      } catch (err: any) {
        if (!aliveRef.current) return;
        setPhase('paused'); setNote(err.message || "Didn't catch that — tap to try again.");
        return;
      }
      if (!aliveRef.current) return;
      setHeard(text);
      setPhase('thinking');
      const coachReply = await onSend(text);
      if (!aliveRef.current) return;
      if (!coachReply) { setPhase('paused'); setNote('Lost the thread — tap to keep going.'); return; }
      setReply(coachReply);
      setPhase('speaking');
      await speak(coachReply);
      if (!aliveRef.current) return;
      await startListening();
    } finally {
      busyRef.current = false;
    }
  }, [onSend, recorder, speak, startListening]);

  const begin = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      if (lastReply) {
        setReply(lastReply);
        setPhase('speaking');
        await speak(lastReply);
        if (!aliveRef.current) return;
      }
    } finally {
      busyRef.current = false;
    }
    await startListening();
  }, [lastReply, speak, startListening]);

  const orbTap = useCallback(() => {
    if (phase === 'gate') { void begin(); return; }
    if (phase === 'listening') { void finishTurn(); return; }
    if (phase === 'speaking') { stopSpeaking(); return; } // speak() resolves on pause → loops to listening
    if (phase === 'paused') { void startListening(); }
  }, [begin, finishTurn, phase, startListening, stopSpeaking]);

  const close = useCallback(() => {
    aliveRef.current = false;
    recorder.cancel();
    stopSpeaking();
    onClose();
  }, [onClose, recorder, stopSpeaking]);

  const orbStyle = {
    preparing: { bg: 'radial-gradient(circle at 35% 30%, rgba(157,180,204,0.4), rgba(62,106,140,0.3))', glow: 'rgba(157,180,204,0.2)', anim: false },
    gate: { bg: 'radial-gradient(circle at 35% 30%, var(--rd-accent-bright), var(--rd-accent-deep))', glow: 'var(--rd-accent-glow)', anim: true },
    listening: { bg: 'radial-gradient(circle at 35% 30%, var(--rd-sage-soft), #5f8a6f)', glow: 'rgba(169,198,179,0.45)', anim: true },
    transcribing: { bg: 'radial-gradient(circle at 35% 30%, rgba(201,224,209,0.5), rgba(95,138,111,0.4))', glow: 'rgba(169,198,179,0.25)', anim: false },
    thinking: { bg: 'radial-gradient(circle at 35% 30%, rgba(157,180,204,0.55), rgba(62,106,140,0.5))', glow: 'rgba(127,180,217,0.25)', anim: true },
    speaking: { bg: 'radial-gradient(circle at 35% 30%, var(--rd-accent-bright), var(--rd-accent-deep))', glow: 'var(--rd-accent-glow)', anim: true },
    paused: { bg: 'radial-gradient(circle at 35% 30%, rgba(157,180,204,0.35), rgba(62,106,140,0.3))', glow: 'rgba(157,180,204,0.15)', anim: false },
  }[phase];

  const statusLine = {
    preparing: 'Getting your session ready…',
    gate: 'Tap to begin',
    listening: 'Listening — tap when you’re done',
    transcribing: 'Catching that…',
    thinking: 'Thinking…',
    speaking: 'Tap to interrupt',
    paused: note || 'Tap to continue',
  }[phase];

  const reduceMotion = typeof window !== 'undefined'
    && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 'var(--app-height, 100dvh)', zIndex: 100, background: 'var(--rd-bg)', color: 'var(--rd-ink)',
      fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'calc(env(safe-area-inset-top) + 20px) 24px calc(env(safe-area-inset-bottom) + 28px)',
    }}>
      <div style={{ alignSelf: 'stretch', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={close} aria-label="End voice session" style={{
          background: 'none', border: 'none', color: 'var(--rd-muted)', fontSize: 14, cursor: 'pointer', padding: 8,
        }}>End</button>
        <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--rd-muted-2)' }}>Voice session</div>
        <button onClick={close} aria-label="Switch to text" style={{
          background: 'none', border: 'none', color: 'var(--rd-muted)', fontSize: 14, cursor: 'pointer', padding: 8,
        }}>Aa</button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30, width: '100%', maxWidth: 380 }}>
        <button onClick={orbTap} aria-label={statusLine} style={{
          width: 170, height: 170, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: orbStyle.bg,
          boxShadow: `0 0 60px ${orbStyle.glow}`,
          animation: orbStyle.anim && !reduceMotion ? 'orbBreathe 4.5s ease-in-out infinite' : undefined,
          transition: 'background 0.6s ease, box-shadow 0.6s ease',
        }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--rd-muted)', marginBottom: 18 }}>{statusLine}</div>
          {heard && (
            <div style={{ fontSize: 14, color: 'var(--rd-muted-2)', lineHeight: 1.5, marginBottom: 12, fontStyle: 'italic' }}>
              “{heard.length > 140 ? heard.slice(0, 140) + '…' : heard}”
            </div>
          )}
          {reply && phase !== 'gate' && (
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, lineHeight: 1.45, color: 'var(--rd-ink-soft)' }}>
              {reply.length > 220 ? reply.slice(0, 220) + '…' : reply}
            </div>
          )}
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--rd-dim)' }}>
        Everything here is saved to your session, same as typing.
      </div>
    </div>,
    document.body,
  );
}
