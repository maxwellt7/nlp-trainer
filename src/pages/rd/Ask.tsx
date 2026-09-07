import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { compressScreenshot, isAskImageFile } from './askImage';
import { parseAskMarkdown, type Block, type Inline } from './askMarkdown';

interface Source { filename: string; score: number }
interface Turn { question: string; answer: string; sources: Source[]; previewUrl?: string }
interface ThreadMeta { id: string; title: string; updatedAt: string }
interface Attachment { mime: 'image/jpeg'; data: string; previewUrl: string; name: string }

function renderInlines(inlines: Inline[]) {
  return inlines.map((node, i) => {
    if (node.type === 'strong') return <strong key={i}>{node.value}</strong>;
    if (node.type === 'em') return <em key={i}>{node.value}</em>;
    return <span key={i}>{node.value}</span>;
  });
}

function MarkdownAnswer({ text }: { text: string }) {
  const blocks: Block[] = parseAskMarkdown(text);
  return (
    <div style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--rd-ink-soft)' }}>
      {blocks.map((block, i) => {
        if (block.type === 'gap') return <div key={i} style={{ height: 10 }} />;
        if (block.type === 'quote') {
          return (
            <div key={i} style={{
              borderLeft: '2px solid var(--rd-accent)',
              padding: '2px 0 2px 12px',
              margin: '8px 0',
              color: 'var(--rd-muted)',
            }}>
              {renderInlines(block.inlines)}
            </div>
          );
        }
        return <p key={i} style={{ margin: '0 0 8px' }}>{renderInlines(block.inlines)}</p>;
      })}
    </div>
  );
}

export default function Ask() {
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadMeta[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [readingShot, setReadingShot] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshThreads = () => { api.askThreads().then((d) => setThreads(d.threads)).catch(() => {}); };
  useEffect(() => { refreshThreads(); }, []);

  const scrollToEnd = () => requestAnimationFrame(() =>
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }));

  const attachFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      if (!isAskImageFile(file)) throw new Error('Use a PNG, JPEG, or WebP screenshot.');
      const next = await compressScreenshot(file);
      setAttachment((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return { ...next, name: file.name || 'screenshot' };
      });
    } catch (err: any) {
      setError(err.message || 'Could not attach that screenshot.');
    }
  };

  const clearAttachment = () => {
    setAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if ((!q && !attachment) || loading) return;
    const pending = attachment;
    setInput('');
    setAttachment(null);
    setError(null);
    setLoading(true);
    setReadingShot(Boolean(pending));
    try {
      const displayQuestion = q || 'Analyze this conversation';
      const { answer, sources, threadId: tid } = await api.ask(
        q,
        threadId,
        pending ? { mime: pending.mime, data: pending.data } : null,
      );
      setTurns((prev) => [...prev, {
        question: displayQuestion,
        answer,
        sources,
        previewUrl: pending?.previewUrl,
      }]);
      const isNew = !threadId;
      setThreadId(tid);
      if (isNew) refreshThreads();
      scrollToEnd();
    } catch (err: any) {
      setError(err.message || 'Something went wrong — try again.');
      if (pending) setAttachment(pending);
    } finally {
      setLoading(false);
      setReadingShot(false);
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

  const startNew = () => {
    clearAttachment();
    setTurns((prev) => {
      prev.forEach((t) => { if (t.previewUrl) URL.revokeObjectURL(t.previewUrl); });
      return [];
    });
    setThreadId(null);
    setError(null);
    setSidebarOpen(false);
  };

  const removeThread = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (id === threadId) startNew();
    try { await api.deleteAskThread(id); } catch { /* already gone from view */ }
  };

  const canSend = Boolean(input.trim() || attachment) && !loading;

  return (
    <div
      style={{ height: '100%', display: 'flex', flexDirection: 'column', color: 'var(--rd-ink)', fontFamily: 'var(--font-sans)', position: 'relative' }}
      onPaste={(e) => {
        const file = [...e.clipboardData.items].find((item) => item.type.startsWith('image/'))?.getAsFile();
        if (file) {
          e.preventDefault();
          attachFile(file);
        }
      }}
    >
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
              Answers come from your saved library and from coaching conversations you've had here. Attach a screenshot of a chat if you want it read and analyzed.
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i} style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                <div style={{ background: 'var(--rd-surface-2)', border: '1px solid var(--rd-border)', borderRadius: 16, padding: '10px 14px', fontSize: 14, maxWidth: '85%' }}>
                  {t.previewUrl && (
                    <img src={t.previewUrl} alt="" style={{ display: 'block', width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 10, marginBottom: 8 }} />
                  )}
                  <div style={{ whiteSpace: 'pre-wrap' }}>{t.question}</div>
                </div>
              </div>
              <MarkdownAnswer text={t.answer} />
              {t.sources.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {t.sources.map((s, si) => (
                    <span key={`${s.filename}-${si}`} style={{ fontSize: 11, color: 'var(--rd-muted)', background: 'var(--rd-surface)', border: '1px solid var(--rd-border)', borderRadius: 999, padding: '3px 10px' }}>{s.filename}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && <div style={{ fontSize: 14, color: 'var(--rd-muted)', fontStyle: 'italic' }}>{readingShot ? 'Reading screenshot and searching…' : 'Searching your library and conversations…'}</div>}
          {error && <div style={{ fontSize: 13, color: 'var(--rd-danger)', marginTop: 8 }}>{error}</div>}
        </div>
      </div>

      {/* Composer */}
      <form onSubmit={submit} style={{ flexShrink: 0, padding: '10px 16px calc(env(safe-area-inset-bottom) + 10px)', borderTop: '1px solid var(--rd-border)', background: 'var(--rd-bg)' }}>
        <div style={{ maxWidth: 440, margin: '0 auto' }}>
          {attachment && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, background: 'var(--rd-surface)', border: '1px solid var(--rd-border)', borderRadius: 14, padding: 8 }}>
              <img src={attachment.previewUrl} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--rd-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.name}</div>
              <button type="button" onClick={clearAttachment} aria-label="Remove screenshot" style={{ background: 'none', border: 'none', color: 'var(--rd-muted-2)', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>×</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => { attachFile(e.target.files?.[0]); e.target.value = ''; }} />
            <button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach screenshot" disabled={loading} style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 999, border: '1px solid var(--rd-border)', background: 'var(--rd-surface)', color: 'var(--rd-muted)', fontSize: 18, cursor: loading ? 'default' : 'pointer' }}>
              +
            </button>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={attachment ? 'Optional question…' : 'Ask a question…'} style={{ flex: 1, background: 'var(--rd-surface)', border: '1px solid var(--rd-border)', borderRadius: 999, padding: '11px 16px', color: 'var(--rd-ink)', fontSize: 15, fontFamily: 'var(--font-sans)' }} />
            <button type="submit" disabled={!canSend} style={{ flexShrink: 0, border: 'none', borderRadius: 999, padding: '0 18px', fontSize: 14, fontWeight: 600, cursor: canSend ? 'pointer' : 'default', background: canSend ? 'var(--rd-accent)' : 'var(--rd-surface)', color: canSend ? '#06121c' : 'var(--rd-dim)' }}>Ask</button>
          </div>
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
