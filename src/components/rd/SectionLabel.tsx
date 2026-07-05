export default function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
      color: 'var(--rd-muted-2)', marginBottom: 12,
    }}>{children}</div>
  );
}
