import { useRef, useState } from 'react';
import { api } from '../../services/api';

interface Turn { question: string; answer: string; sources: { filename: string; score: number }[]; }

export default function Ask() {
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setError(null);
    setLoading(true);
    const history = turns.flatMap((t) => [
      { role: 'user' as const, content: t.question },
      { role: 'assistant' as const, content: t.answer },
    ]);
    try {
      const { answer, sources } = await api.ask(q, history);
      setTurns((prev) => [...prev, { question: q, answer, sources }]);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }));
    } catch (err: any) {
      setError(err.message || 'Something went wrong — try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: 'var(--rd-ink)', fontFamily: 'var(--font-sans)' }}>
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 'calc(env(safe-area-inset-top) + 20px) 20px 12px' }}>
        <div style={{ maxWidth: 440, margin: '0 auto' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 28, margin: '0 0 6px' }}>Ask your library</h1>
          <div style={{ fontSize: 14, color: 'var(--rd-muted)', lineHeight: 1.55, marginBottom: 24 }}>
            Answers come only from what you've saved. Nothing is kept here.
          </div>

          {turns.length === 0 && !loading && (
            <div style={{ fontSize: 14, color: 'var(--rd-muted-2)', lineHeight: 1.6 }}>
              Ask anything — “What does the material say about limiting beliefs?”
            </div>
          )}

          {turns.map((t, i) => (
            <div key={i} style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                <div style={{ background: 'var(--rd-surface-2)', border: '1px solid var(--rd-border)', borderRadius: 16, padding: '10px 14px', fontSize: 14, maxWidth: '85%' }}>{t.question}</div>
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--rd-ink-soft)', whiteSpace: 'pre-wrap' }}>{t.answer}</div>
              {t.sources.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {t.sources.map((s) => (
                    <span key={s.filename} style={{ fontSize: 11, color: 'var(--rd-muted)', background: 'var(--rd-surface)', border: '1px solid var(--rd-border)', borderRadius: 999, padding: '3px 10px' }}>{s.filename}</span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ fontSize: 14, color: 'var(--rd-muted)', fontStyle: 'italic' }}>Searching your library…</div>
          )}
          {error && (
            <div style={{ fontSize: 13, color: 'var(--rd-danger)', marginTop: 8 }}>{error}</div>
          )}
        </div>
      </div>

      <form onSubmit={submit} style={{ flexShrink: 0, padding: '10px 16px calc(env(safe-area-inset-bottom) + 10px)', borderTop: '1px solid var(--rd-border)', background: 'var(--rd-bg)' }}>
        <div style={{ maxWidth: 440, margin: '0 auto', display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            style={{ flex: 1, background: 'var(--rd-surface)', border: '1px solid var(--rd-border)', borderRadius: 999, padding: '11px 16px', color: 'var(--rd-ink)', fontSize: 15, fontFamily: 'var(--font-sans)' }}
          />
          <button type="submit" disabled={!input.trim() || loading} style={{ flexShrink: 0, border: 'none', borderRadius: 999, padding: '0 18px', fontSize: 14, fontWeight: 600, cursor: input.trim() && !loading ? 'pointer' : 'default', background: input.trim() && !loading ? 'var(--rd-accent)' : 'var(--rd-surface)', color: input.trim() && !loading ? '#06121c' : 'var(--rd-dim)' }}>Ask</button>
        </div>
      </form>
    </div>
  );
}
