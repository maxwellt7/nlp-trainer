import { Component, type ReactNode } from 'react';

// A stale PWA / browser cache can hold dynamic-import chunk hashes that 404 after
// a deploy. Without a boundary, tapping such a lazy route throws and React
// unmounts the whole tree — the screen just "goes away" (blank). This boundary
// catches that (and any render error): on a chunk-load failure it reloads once to
// pick up fresh assets (rate-limited to avoid loops); otherwise it shows a retry.

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|error loading dynamically imported module|Unable to preload/i;
const RELOAD_TS_KEY = 'route-chunk-reload-ts';
const RELOAD_COOLDOWN_MS = 10_000;

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (CHUNK_ERROR.test(error?.message || '')) {
      const last = Number(sessionStorage.getItem(RELOAD_TS_KEY) || 0);
      // Reload at most once per cooldown: recovers from a stale chunk without
      // looping if the reload doesn't fix it.
      if (Date.now() - last > RELOAD_COOLDOWN_MS) {
        sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now()));
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100dvh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
          background: 'var(--rd-bg)', color: 'var(--rd-ink-soft)', padding: 24, textAlign: 'center',
        }}>
          <div style={{ fontSize: 15, opacity: 0.85 }}>This screen hit a snag loading.</div>
          <button
            onClick={() => { sessionStorage.removeItem(RELOAD_TS_KEY); window.location.reload(); }}
            style={{
              background: 'var(--rd-accent)', color: '#06121c', border: 'none', borderRadius: 10,
              padding: '10px 18px', fontSize: 14, fontWeight: 600,
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
