import { useState } from 'react';

declare const __BUILD_TS__: string;

export type SessionKind = 'daily' | 'general' | 'voice' | 'library';

// Tap the build stamp to print on-device viewport geometry — added to debug the
// dead band under the bottom nav on the installed iOS PWA. Each line pins down
// one layer: OS screen vs webview vs CSS viewport units vs our shell.
function readViewportDiagnostics(): string[] {
  try {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;';
    document.body.appendChild(probe);
    const m = (h: string) => {
      probe.style.height = h;
      return Math.round(probe.getBoundingClientRect().height * 10) / 10;
    };
    const dvh = m('100dvh');
    const lvh = m('100lvh');
    const svh = m('100svh');
    const sat = m('env(safe-area-inset-top)');
    const sab = m('env(safe-area-inset-bottom)');
    probe.remove();
    const vv = window.visualViewport;
    const nav = document.querySelector('nav');
    const navBottom = nav ? Math.round(nav.getBoundingClientRect().bottom) : -1;
    const rootRect = document.getElementById('root')?.getBoundingClientRect();
    const htmlRect = document.documentElement.getBoundingClientRect();
    const below = document.elementFromPoint(Math.floor(window.innerWidth / 2), window.innerHeight - 2);
    return [
      `screen ${screen.height} avail ${screen.availHeight} inner ${window.innerHeight} outer ${window.outerHeight}`,
      `visualViewport ${vv ? `${Math.round(vv.height)} offTop ${Math.round(vv.offsetTop)} pageTop ${Math.round(vv.pageTop)} scale ${vv.scale}` : 'n/a'}`,
      `dvh ${dvh} · lvh ${lvh} · svh ${svh} · safeTop ${sat} · safeBot ${sab}`,
      `html ${Math.round(htmlRect.height)} root ${rootRect ? `${Math.round(rootRect.height)} bot ${Math.round(rootRect.bottom)}` : '?'} navBot ${navBottom}`,
      `scrollY ${Math.round(window.scrollY)} dpr ${window.devicePixelRatio} standalone ${window.matchMedia('(display-mode: standalone)').matches ? 'y' : 'n'}/${(navigator as { standalone?: boolean }).standalone ? 'y' : 'n'}`,
      `@bottom <${below?.tagName.toLowerCase() || '?'}> ${below ? getComputedStyle(below).backgroundColor : ''}`,
    ];
  } catch (e) {
    return [`diag error: ${(e as Error)?.message}`];
  }
}

export default function ChooserSheet({ open, onClose, onPick }: {
  open: boolean; onClose: () => void; onPick: (kind: SessionKind) => void;
}) {
  const [diag, setDiag] = useState<string[] | null>(null);
  if (!open) return null;
  const row = (label: string, sub: string, kind: SessionKind) => (
    <button onClick={() => onPick(kind)} style={{
      display: 'block', width: '100%', textAlign: 'left', background: 'var(--rd-surface)',
      border: '1px solid var(--rd-border)', borderRadius: 16, padding: 16, marginBottom: 12, color: 'var(--rd-ink)',
    }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--rd-muted)' }}>{sub}</div>
    </button>
  );
  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 'var(--app-height, 100dvh)', background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 440, margin: '0 auto', background: 'var(--rd-bg-deep)',
        borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
      }}>
        <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--rd-muted-2)', marginBottom: 14 }}>Start a session</div>
        {row('Daily Session', 'Your evening ritual', 'daily')}
        {row('General Chat', 'An open-ended conversation', 'general')}
        {row('Voice Session', 'Talk it through, out loud', 'voice')}
        {row('Library', 'Browse hypnosis recordings', 'library')}
        <div
          onClick={() => setDiag(diag ? null : readViewportDiagnostics())}
          style={{ fontSize: 10, color: 'var(--rd-dim)', textAlign: 'center', marginTop: 6, cursor: 'pointer' }}
        >
          build {__BUILD_TS__}
        </div>
        {diag && (
          <div style={{ fontFamily: 'monospace', fontSize: 9.5, lineHeight: 1.7, color: 'var(--rd-muted)', marginTop: 8, wordBreak: 'break-all' }}>
            {diag.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}
