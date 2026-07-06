export default function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: 'var(--rd-ink)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: 'calc(env(safe-area-inset-top) + 20px) 20px 40px' }}>
        {children}
      </div>
    </div>
  );
}
