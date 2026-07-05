import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import Screen from '../../components/rd/Screen';
import Card from '../../components/rd/Card';
import SectionLabel from '../../components/rd/SectionLabel';
import { overallCongruence, valueBars, topTension, beliefs } from './youLogic';

export default function You() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getIdentity()
      .then((d: any) => setData(d || null))
      .catch((err: any) => setError(err?.message || 'Could not load your profile.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Screen>
        <div style={{ color: 'var(--rd-muted)', fontSize: 14, marginTop: 40 }}>Gathering what you've shared…</div>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 400, margin: '0 0 8px' }}>What you value</h1>
        <div style={{ color: 'var(--rd-muted)', fontSize: 14, marginBottom: 18 }}>We couldn't reach your profile just now.</div>
        <button onClick={() => window.location.reload()} style={{
          background: 'var(--rd-accent)', color: '#06121c', border: 'none', borderRadius: 999,
          padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>Try again</button>
      </Screen>
    );
  }

  const congruence = overallCongruence(data?.scores);
  const bars = valueBars(data?.values);
  const tension = topTension(data?.conflicts);
  const beliefList = beliefs(data?.statements);
  const congruencePct = congruence != null ? Math.round(Math.min(10, Math.max(0, congruence)) * 10) : 0;

  return (
    <Screen>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 400, margin: '0 0 6px' }}>What you value</h1>
      <div style={{ fontSize: 14, color: 'var(--rd-muted)', lineHeight: 1.55, marginBottom: 26 }}>
        Built slowly, from what you've shared — not from a quiz.
      </div>

      {/* Section 1 — Overall congruence */}
      <Card>
        {congruence == null ? (
          <div style={{ fontSize: 14, color: 'var(--rd-muted)', lineHeight: 1.55, textAlign: 'center', padding: '8px 0' }}>
            Your sense of alignment will take shape as you keep talking.
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <SectionLabel>Overall Congruence</SectionLabel>
            <div style={{ position: 'relative', width: 108, height: 108, margin: '6px auto 0' }}>
              <svg viewBox="0 0 36 36" style={{ width: 108, height: 108, transform: 'rotate(-90deg)' }}>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--rd-border)" strokeWidth={2.2} />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--rd-sage)" strokeWidth={2.2} strokeLinecap="round" strokeDasharray={`${congruencePct}, 100`} />
              </svg>
              <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--rd-ink)' }}>
                {congruence.toFixed(1)}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Section 2 — What you value */}
      <div style={{ marginTop: 20 }}>
        <Card>
          <SectionLabel>What You Value</SectionLabel>
          {bars.length === 0 && (
            <div style={{ fontSize: 14, color: 'var(--rd-muted)', lineHeight: 1.55 }}>
              Your values will appear here as they surface in conversation.
            </div>
          )}
          {bars.map((b, i) => (
            <div key={b.name || i} style={{ marginTop: i === 0 ? 0 : 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 15, color: 'var(--rd-ink-soft)' }}>{b.name}</span>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: `var(${b.badgeColorVar})` }}>{b.badge}</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'var(--rd-border)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${b.fillPct}%`, borderRadius: 999, background: `var(${b.badgeColorVar})` }} />
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--rd-muted-2)', marginTop: 6, lineHeight: 1.5 }}>{b.desc}</div>
            </div>
          ))}
        </Card>
      </div>

      {/* Section 3 — A tension worth noticing */}
      {tension && (
        <div style={{ marginTop: 20 }}>
          <Card>
            <SectionLabel>A Tension Worth Noticing</SectionLabel>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 8 }}>
              {tension.a} <span style={{ color: 'var(--rd-muted)' }}>↔</span> {tension.b}
            </div>
            {tension.desc && <div style={{ fontSize: 13.5, color: 'var(--rd-muted-2)', lineHeight: 1.55 }}>{tension.desc}</div>}
          </Card>
        </div>
      )}

      {/* Section 4 — Beliefs */}
      {beliefList.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <SectionLabel>Beliefs Surfacing</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {beliefList.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: `var(${b.colorVar})`, marginTop: 6, flexShrink: 0 }} />
                <div style={{ fontSize: 14, color: 'var(--rd-ink-soft)', fontStyle: 'italic', lineHeight: 1.5 }}>"{b.content}"</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Screen>
  );
}
