import { Link } from 'react-router-dom';

export default function PublicFooter() {
  return (
    <footer style={{
      position: 'relative',
      zIndex: 1,
      borderTop: '1px solid rgba(36, 51, 82, 0.6)',
      padding: '32px 20px 28px',
      textAlign: 'center',
      color: '#64748B',
      fontFamily: "'Inter', sans-serif",
      fontSize: 12,
      lineHeight: 1.6,
    }}>
      <div style={{
        maxWidth: 720,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        alignItems: 'center',
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px 20px',
          justifyContent: 'center',
        }}>
          <Link to="/privacy" style={{
            color: '#94A3B8',
            textDecoration: 'none',
            fontWeight: 500,
          }}>
            Privacy Policy
          </Link>
          <Link to="/terms" style={{
            color: '#94A3B8',
            textDecoration: 'none',
            fontWeight: 500,
          }}>
            Terms of Service
          </Link>
        </div>
        <div style={{ color: '#475569' }}>
          GrowthGods, LLC &middot; 95067 Rainbow Acres Rd, Fernandina Beach, FL 32034
        </div>
        <div style={{ color: '#334155', fontSize: 11 }}>
          &copy; {new Date().getFullYear()} GrowthGods, LLC. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
