import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { api } from '../../services/api';
import Screen from '../../components/rd/Screen';
import Card from '../../components/rd/Card';
import SectionLabel from '../../components/rd/SectionLabel';
import StreakDots from '../../components/rd/StreakDots';
import { greeting, weekDots } from './homeLogic';

const HAS_CLERK = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// useUser() throws unless it is inside a <ClerkProvider>. main.tsx only wraps the
// app in ClerkProvider when VITE_CLERK_PUBLISHABLE_KEY is set, so the hook must
// only run under the same guard — otherwise the no-Clerk fallback build crashes.
function GreetingName() {
  const { user } = useUser();
  return <>{(user?.firstName || '').trim() || 'there'}</>;
}

export default function Home() {
  const navigate = useNavigate();
  const [streak, setStreak] = useState<any>(null);
  const [reflections, setReflections] = useState<any[]>([]);

  useEffect(() => {
    api.getProfile().then((d: any) => {
      setStreak(d.streak || null);
    }).catch(() => {});
    api.getSessions(5).then((d: any) => setReflections(d.sessions || d || [])).catch(() => {});
  }, []);

  const now = new Date();
  const g = greeting(now);
  const dots = weekDots(streak, now);
  const streakN = streak?.current_streak || 0;
  const totalSessions = streak?.total_sessions || 0;

  return (
    <Screen>
      <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--rd-muted-2)' }}>
        {g.dateLabel}
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, lineHeight: 1.15, margin: '4px 0 24px' }}>
        Good {g.timeOfDay},<br /><em>{HAS_CLERK ? <GreetingName /> : 'there'}</em>
      </h1>

      <Card>
        <SectionLabel>Tonight's Session</SectionLabel>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 6 }}>Ready when you are.</div>
        <div style={{ fontSize: 14, color: 'var(--rd-muted)', marginBottom: 18 }}>
          A few minutes of honest conversation, then a guided session shaped around it.
        </div>
        <button onClick={() => navigate('/hypnosis?mode=daily')} style={{
          background: 'var(--rd-accent)', color: '#06121c', border: 'none', borderRadius: 999,
          padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>Begin →</button>
      </Card>

      <div style={{ marginTop: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <SectionLabel>Your Week</SectionLabel>
          <div style={{ fontSize: 12, color: 'var(--rd-muted)' }}>{streakN} day{streakN === 1 ? '' : 's'} in a row</div>
        </div>
        <StreakDots dots={dots} />
      </div>

      <div style={{ marginTop: 28 }}>
        <SectionLabel>Recent Reflections</SectionLabel>
        {reflections.length === 0 && (
          <div style={{ fontSize: 14, color: 'var(--rd-muted)' }}>Your reflections will appear here after a few sessions.</div>
        )}
        {reflections.map((r: any) => (
          <div key={r.id} style={{ marginBottom: 12 }}>
            <Card>
              <div style={{ display: 'flex', gap: 14, cursor: 'pointer' }}
                onClick={() => navigate(`/hypnosis?sessionId=${r.id}`)}>
                <div style={{ textAlign: 'center', minWidth: 34 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--rd-accent-bright)' }}>
                    {r.created_at ? new Date(r.created_at).getDate() : ''}
                  </div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--rd-dim)' }}>
                    {r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short' }) : ''}
                  </div>
                </div>
                <div style={{ fontSize: 14, color: 'var(--rd-ink-soft)' }}>
                  {r.chat_summary?.trim() || 'A coaching conversation.'}
                </div>
              </div>
            </Card>
          </div>
        ))}
      </div>

      {totalSessions > 0 && (
        <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', textAlign: 'center', color: 'var(--rd-muted-2)', marginTop: 32, fontSize: 14 }}>
          {totalSessions} session{totalSessions === 1 ? '' : 's'} · one conversation at a time
        </div>
      )}
    </Screen>
  );
}
