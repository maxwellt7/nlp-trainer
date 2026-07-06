import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import Screen from '../../components/rd/Screen';
import Card from '../../components/rd/Card';
import Player from './Player';
import { recordingMeta } from './libraryLogic';

export default function Library() {
  const [scripts, setScripts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<any | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [preparingIds, setPreparingIds] = useState<Record<string, boolean>>({});
  const setPreparing = (id: string, v: boolean) =>
    setPreparingIds(prev => { const n = { ...prev }; if (v) n[id] = true; else delete n[id]; return n; });
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const data = await api.listScripts();
      setScripts(data?.scripts || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load your recordings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    setScripts(prev => prev.filter(s => s.id !== id));
    setMenuId(null);
    try { await api.deleteScript(id); } catch { /* already removed from view; best-effort */ }
  };

  const prepare = async (id: string) => {
    if (preparingIds[id]) return;
    setPreparing(id, true);
    setRowError(prev => { const n = { ...prev }; delete n[id]; return n; });
    let jobId: string;
    try {
      const r = await api.audioGenerateStart(id);
      jobId = r.jobId;
    } catch {
      setRowError(prev => ({ ...prev, [id]: 'Could not start. Try again.' }));
      setPreparing(id, false);
      return;
    }
    let inFlight = false;
    let terminal = false;
    const tick = async (): Promise<void> => {
      if (inFlight || terminal) return;
      inFlight = true;
      try {
        const r = await api.audioGenerateStatus(jobId);
        if (terminal) return;
        if (r.status === 'complete') { terminal = true; await load(); setPreparing(id, false); return; }
        if (r.status === 'failed') {
          terminal = true;
          setRowError(prev => ({ ...prev, [id]: 'Preparing failed. Try again.' }));
          setPreparing(id, false);
          return;
        }
        setTimeout(tick, 4000);
      } catch {
        if (!terminal) setTimeout(tick, 7000);
      } finally {
        inFlight = false;
      }
    };
    tick();
  };

  if (loading) {
    return <Screen><div style={{ color: 'var(--rd-muted)', fontSize: 14, marginTop: 40 }}>Gathering your recordings…</div></Screen>;
  }

  if (error) {
    return (
      <Screen>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 400, margin: '0 0 8px' }}>Your recordings</h1>
        <div style={{ color: 'var(--rd-muted)', fontSize: 14, marginBottom: 18 }}>We couldn't reach your recordings just now.</div>
        <button onClick={() => window.location.reload()} style={{
          background: 'var(--rd-accent)', color: '#06121c', border: 'none', borderRadius: 999,
          padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>Try again</button>
      </Screen>
    );
  }

  const now = new Date();

  return (
    <>
      <Screen>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 400, margin: '0 0 6px' }}>Your recordings</h1>
        <div style={{ fontSize: 14, color: 'var(--rd-muted)', lineHeight: 1.55, marginBottom: 26 }}>
          Every session is yours to return to, any time.
        </div>

        {scripts.length === 0 && (
          <div style={{ fontSize: 14, color: 'var(--rd-muted)', lineHeight: 1.55 }}>
            Your sessions will appear here once you've had one.
          </div>
        )}

        {scripts.map(s => (
          <div key={s.id} style={{ marginBottom: 12 }}>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {s.audioFile ? (
                  <button onClick={() => setActive(s)} aria-label={`Play ${s.title}`} style={{
                    width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
                    background: 'radial-gradient(circle at 35% 30%, var(--rd-accent-bright), var(--rd-accent) 60%, var(--rd-accent-deep) 100%)',
                    color: '#06121c', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>▶</button>
                ) : (
                  <button onClick={() => prepare(s.id)} disabled={!!preparingIds[s.id]} style={{
                    fontSize: 12, color: 'var(--rd-muted)', background: 'var(--rd-surface)', border: '1px solid var(--rd-border)',
                    borderRadius: 999, padding: '8px 12px', cursor: preparingIds[s.id] ? 'default' : 'pointer', flexShrink: 0,
                  }}>{preparingIds[s.id] ? 'Preparing…' : 'Prepare recording'}</button>
                )}

                <div style={{ flex: 1, minWidth: 0, cursor: s.audioFile ? 'pointer' : 'default' }} onClick={() => s.audioFile && setActive(s)}>
                  <div style={{ fontSize: 15, color: 'var(--rd-ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--rd-muted-2)', marginTop: 2 }}>{recordingMeta(s.createdAt, s.estimatedMinutes, now)}</div>
                  {rowError[s.id] && <div style={{ fontSize: 12, color: 'var(--rd-danger)', marginTop: 4 }}>{rowError[s.id]}</div>}
                </div>

                <button onClick={() => setMenuId(menuId === s.id ? null : s.id)} aria-label="More options" style={{
                  background: 'none', border: 'none', color: 'var(--rd-muted-2)', fontSize: 20, cursor: 'pointer', flexShrink: 0, padding: 4,
                }}>⋯</button>
              </div>

              {menuId === s.id && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--rd-border)', textAlign: 'right' }}>
                  <button onClick={() => remove(s.id)} style={{ background: 'none', border: 'none', color: 'var(--rd-danger)', fontSize: 13, cursor: 'pointer' }}>Remove</button>
                </div>
              )}
            </Card>
          </div>
        ))}
      </Screen>

      {active && <Player recording={active} onClose={() => setActive(null)} />}
    </>
  );
}
