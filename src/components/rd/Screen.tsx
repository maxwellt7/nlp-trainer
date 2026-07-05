export default function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--rd-bg)', minHeight: '100dvh', color: 'var(--rd-ink)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '32px 20px 120px' }}>
        {children}
      </div>
    </div>
  );
}
