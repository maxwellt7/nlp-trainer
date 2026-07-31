import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';

interface Source { filename: string; score: number }
interface Turn { question: string; answer: string; sources: Source[] }
interface ThreadMeta { id: string; title: string; updatedAt: string }

export default function Ask() {
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadMeta[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshThreads = () => { api.askThreads().then((d) => setThreads(d.threads)).catch(() => {}); };
  useEffect(() => { refreshThreads(); }, []);

  const scrollToEnd = () => requestAnimationFrame(() =>
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setError(null);
    setLoading(true);
    try {
      const { answer, sources, threadId: tid } = await api.ask(q, threadId);
      setTurns((prev) => [...prev, { question: q, answer, sources }]);
      const isNew = !threadId;
      setThreadId(tid);
      if (isNew) refreshThreads();
      scrollToEnd();
    } catch (err: any) {
      setError(err.message || 'Something went wrong — try again.');
    } finally {
      setLoading(false);
    }
  };

  const openThread = async (id: string) => {
    setSidebarOpen(false);
    setError(null);
    try {
      const t = await api.askThread(id);
      const loaded: Turn[] = [];
      for (let i = 0; i < t.messages.length; i += 1) {
        const m = t.messages[i];
        if (m.role === 'user') {
          const a = t.messages[i + 1];
          loaded.push({ question: m.content, answer: a?.role === 'assistant' ? a.content : '', sources: a?.sources || [] });
          if (a?.role === 'assistant') i += 1;
        }
      }
      setTurns(loaded);
      setThreadId(t.id);
      scrollToEnd();
    } catch {
      setError('Could not open that thread.');
    }
  };

  const startNew = () => { setThreadId(null); setTurns([]); setError(null); setSidebarOpen(false); };

  const removeThread = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (id === threadId) startNew();
    try { await api.deleteAskThread(id); } catch { /* already gone from view */ }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: 'var(--rd-ink)', fontFamily: 'var(--font-sans)', position: 'relative' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 'calc(env(safe-area-inset-top) + 14px) 16px 12px', borderBottom: '1px solid var(--rd-border)' }}>
        <button onClick={() => setSidebarOpen(true)} aria-label="History" style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)', borderRadius: 999, padding: '7px 14px', color: 'var(--rd-muted)', fontSize: 13, cursor: 'pointer' }}>History</button>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>Ask your library</div>
        <button onClick={startNew} aria-label="New question" style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)', borderRadius: 999, padding: '7px 14px', color: 'var(--rd-accent-bright)', fontSize: 13, cursor: 'pointer' }}>New</button>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 20px 12px' }}>
        <div style={{ maxWidth: 440, margin: '0 auto' }}>
          {turns.length === 0 && !loading && (
            <div style={{ fontSize: 14, color: 'var(--rd-muted-2)', lineHeight: 1.6, marginTop: 8 }}>
              Answers come only from what you've saved. Ask anything — “What does the material say about clean influence?”
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
          {loading && <div style={{ fontSize: 14, color: 'var(--rd-muted)', fontStyle: 'italic' }}>Searching your library…</div>}
          {error && <div style={{ fontSize: 13, color: 'var(--rd-danger)', marginTop: 8 }}>{error}</div>}
        </div>
      </div>

      {/* Composer */}
      <form onSubmit={submit} style={{ flexShrink: 0, padding: '10px 16px calc(env(safe-area-inset-bottom) + 10px)', borderTop: '1px solid var(--rd-border)', background: 'var(--rd-bg)' }}>
        <div style={{ maxWidth: 440, margin: '0 auto', display: 'flex', gap: 8 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question…" style={{ flex: 1, background: 'var(--rd-surface)', border: '1px solid var(--rd-border)', borderRadius: 999, padding: '11px 16px', color: 'var(--rd-ink)', fontSize: 15, fontFamily: 'var(--font-sans)' }} />
          <button type="submit" disabled={!input.trim() || loading} style={{ flexShrink: 0, border: 'none', borderRadius: 999, padding: '0 18px', fontSize: 14, fontWeight: 600, cursor: input.trim() && !loading ? 'pointer' : 'default', background: input.trim() && !loading ? 'var(--rd-accent)' : 'var(--rd-surface)', color: input.trim() && !loading ? '#06121c' : 'var(--rd-dim)' }}>Ask</button>
        </div>
      </form>

      {/* Sidebar drawer */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.5)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '82%', maxWidth: 320, background: 'var(--rd-bg-deep)', borderRight: '1px solid var(--rd-border)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(env(safe-area-inset-top) + 16px) 16px 12px', borderBottom: '1px solid var(--rd-border)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>History</div>
              <button onClick={startNew} style={{ background: 'var(--rd-accent)', color: '#06121c', border: 'none', borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>New question</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 10px' }}>
              {threads.length === 0 && <div style={{ fontSize: 13, color: 'var(--rd-muted-2)', padding: 12 }}>No questions yet.</div>}
              {threads.map((t) => (
                <div key={t.id} onClick={() => openThread(t.id)} role="button" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', background: t.id === threadId ? 'var(--rd-surface-2)' : 'transparent', marginBottom: 2 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--rd-ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title || 'Untitled'}</span>
                  <button onClick={(e) => removeThread(t.id, e)} aria-label="Delete" style={{ background: 'none', border: 'none', color: 'var(--rd-muted-2)', fontSize: 16, cursor: 'pointer', padding: 4, flexShrink: 0 }}>×</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
