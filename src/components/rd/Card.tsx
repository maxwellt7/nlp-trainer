export default function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={className} style={{
      background: 'var(--rd-surface)', border: '1px solid var(--rd-border)',
      borderRadius: 'var(--rd-radius-card)', padding: 20,
    }}>
      {children}
    </div>
  );
}
