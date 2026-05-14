import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import PublicFooter from './PublicFooter';

interface LegalPageShellProps {
  title: string;
  effectiveDate: string;
  children: ReactNode;
}

export default function LegalPageShell({ title, effectiveDate, children }: LegalPageShellProps) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0B0F19',
      color: '#E2E8F0',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(212, 168, 83, 0.04) 0%, transparent 60%)',
      }} />

      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: 760, margin: '0 auto',
        padding: '40px 24px 24px',
      }}>
        <Link to="/sign-in" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: '#94A3B8', textDecoration: 'none', fontSize: 13, marginBottom: 24,
        }}>
          &larr; Back
        </Link>

        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 40px)',
          fontWeight: 700,
          color: '#F1F5F9',
          margin: '0 0 8px',
          lineHeight: 1.2,
        }}>
          {title}
        </h1>
        <p style={{
          color: '#64748B', fontSize: 13, margin: '0 0 32px',
          letterSpacing: '0.05em', textTransform: 'uppercase',
        }}>
          Effective {effectiveDate}
        </p>

        <div style={{
          fontSize: 15, lineHeight: 1.75, color: '#CBD5E1',
        }}>
          {children}
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}
