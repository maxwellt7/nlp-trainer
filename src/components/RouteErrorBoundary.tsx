import { Component, type ReactNode } from 'react';
import { recoverFromStalePwa } from '../lib/pwaRecovery';

// A stale PWA / browser cache can hold dynamic-import chunk hashes that 404 after
// a deploy. Without a boundary, tapping such a lazy route throws and React
// unmounts the whole tree — the screen just "goes away" (blank). This boundary
// catches that (and any render error): on a chunk-load failure it clears the
// stale service worker + caches and reloads (loop-guarded) to pick up fresh
// assets; otherwise it shows a retry.

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|error loading dynamically imported module|Unable to preload/i;

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (CHUNK_ERROR.test(error?.message || '')) {
      // Clear the stale SW + caches, then reload (both loop-guarded inside).
      void recoverFromStalePwa();
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
            onClick={() => { void recoverFromStalePwa({ force: true }); }}
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
