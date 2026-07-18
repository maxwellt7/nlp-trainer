export type SessionKind = 'daily' | 'general' | 'voice';

export default function ChooserSheet({ open, onClose, onPick }: {
  open: boolean; onClose: () => void; onPick: (kind: SessionKind) => void;
}) {
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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 440, margin: '0 auto', background: 'var(--rd-bg-deep)',
        borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
      }}>
        <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--rd-muted-2)', marginBottom: 14 }}>Start a session</div>
        {row('Daily Session', 'Your evening ritual', 'daily')}
        {row('General Chat', 'An open-ended conversation', 'general')}
        {row('Voice Session', 'Talk it through, out loud', 'voice')}
      </div>
    </div>
  );
}
