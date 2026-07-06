import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { formatTime } from './libraryLogic';

type Recording = { id: string; title: string; audioFile: string | null };

export default function Player({ recording, onClose }: { recording: Recording; onClose: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = new Audio(recording.audioFile ? api.getAudioUrl(recording.audioFile) : '');
    audioRef.current = audio;
    const onTime = () => setElapsed(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || 0);
    const onEnd = () => { setPlaying(false); setElapsed(0); audio.currentTime = 0; };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnd);
      audio.removeAttribute('src');
      audioRef.current = null;
    };
  }, [recording.audioFile]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
  };

  const rewind15 = () => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = Math.max(0, audio.currentTime - 15);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
    setElapsed(audio.currentTime);
  };

  const progressPct = duration ? (elapsed / duration) * 100 : 0;
  const reduceMotion = typeof window !== 'undefined'
    && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50, background: 'var(--rd-bg)', color: 'var(--rd-ink)',
      fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'calc(env(safe-area-inset-top) + 20px) 24px calc(env(safe-area-inset-bottom) + 32px)',
    }}>
      <button onClick={onClose} aria-label="Close player" style={{
        alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--rd-muted)',
        fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: 8,
      }}>⌄</button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, width: '100%', maxWidth: 360 }}>
        <div style={{
          width: 180, height: 180, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, var(--rd-accent-bright), var(--rd-accent) 60%, var(--rd-accent-deep) 100%)',
          boxShadow: '0 0 60px var(--rd-accent-glow)',
          animation: playing && !reduceMotion ? 'orbBreathe 7s ease-in-out infinite' : 'none',
        }} />

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 8, maxWidth: 300 }}>{recording.title}</div>
          <div style={{ fontSize: 13, color: 'var(--rd-dim)' }}>{playing ? 'Breathe with the circle' : "Press play when you're settled"}</div>
        </div>

        <div style={{ width: '100%' }}>
          <div onClick={seek} style={{ height: 6, borderRadius: 999, background: 'var(--rd-border)', cursor: 'pointer', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--rd-accent-bright)', borderRadius: 999 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--rd-muted-2)' }}>
            <span>{formatTime(elapsed)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <button onClick={rewind15} aria-label="Rewind 15 seconds" style={{ background: 'none', border: 'none', color: 'var(--rd-muted)', fontSize: 14, cursor: 'pointer' }}>↺ 15</button>
          <button onClick={toggle} aria-label={playing ? 'Pause' : 'Play'} style={{
            width: 68, height: 68, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'var(--rd-accent)', color: '#06121c', fontSize: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{playing ? '❚❚' : '▶'}</button>
          <span style={{ width: 40 }} />
        </div>
      </div>
    </div>
  );
}
