import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import Screen from '../../components/rd/Screen';
import Card from '../../components/rd/Card';
import SectionLabel from '../../components/rd/SectionLabel';
import { capacityBars, alignmentRings, buildPatterns } from './insightsLogic';

const ARC = 'M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831';

export default function Insights() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getProfile()
      .then((d: any) => setProfile(d?.profile || null))
      .catch((err: any) => setError(err?.message || 'Could not load your insights.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Screen>
        <div style={{ color: 'var(--rd-muted)', fontSize: 14, marginTop: 40 }}>Gathering what we've noticed…</div>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 400, margin: '0 0 8px' }}>How you're doing</h1>
        <div style={{ color: 'var(--rd-muted)', fontSize: 14, marginBottom: 18 }}>We couldn't reach your insights just now.</div>
        <button onClick={() => window.location.reload()} style={{
          background: 'var(--rd-accent)', color: '#06121c', border: 'none', borderRadius: 999,
          padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>Try again</button>
      </Screen>
    );
  }

  const bars = capacityBars(profile?.capacity_index);
  const rings = alignmentRings(profile?.congruence);
  const patterns = buildPatterns(profile);

  return (
    <Screen>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 400, margin: '0 0 6px' }}>How you're doing</h1>
      <div style={{ fontSize: 14, color: 'var(--rd-muted)', lineHeight: 1.55, marginBottom: 26 }}>
        A gentle read on what your recent conversations reveal.
      </div>

      {/* Section 1 — Emotional capacity */}
      <Card>
        <SectionLabel>Emotional Capacity</SectionLabel>
        {!bars && (
          <div style={{ fontSize: 14, color: 'var(--rd-muted)', lineHeight: 1.55 }}>
            Your emotional patterns will come into focus after a few more conversations.
          </div>
        )}
        {bars && bars.map((b, i) => (
          <div key={b.key} style={{ marginTop: i === 0 ? 0 : 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 14, color: 'var(--rd-ink-soft)' }}>{b.label}</span>
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--rd-muted-2)' }}>{b.qualifier}</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: 'var(--rd-border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${b.pct}%`, borderRadius: 999, background: `var(${b.colorVar})` }} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--rd-muted-2)', marginTop: 6, lineHeight: 1.5 }}>{b.desc}</div>
          </div>
        ))}
      </Card>

      {/* Section 2 — Alignment */}
      <div style={{ marginTop: 20 }}>
        <Card>
          <SectionLabel>Alignment</SectionLabel>
          {rings.length === 0 && (
            <div style={{ fontSize: 14, color: 'var(--rd-muted)', lineHeight: 1.55 }}>
              As different areas of your life come up, you'll see how aligned they feel here.
            </div>
          )}
          {rings.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 12 }}>
              {rings.map(r => (
                <div key={r.label} style={{ textAlign: 'center' }}>
                  <div style={{ position: 'relative', width: 60, height: 60, margin: '0 auto 8px' }}>
                    <svg viewBox="0 0 36 36" style={{ width: 60, height: 60, transform: 'rotate(0deg)' }}>
                      <path d={ARC} fill="none" stroke="var(--rd-border)" strokeWidth={3} />
                      <path d={ARC} fill="none" stroke="var(--rd-accent-bright)" strokeWidth={3} strokeLinecap="round" strokeDasharray={r.dash} />
                    </svg>
                    <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--rd-ink)' }}>
                      {Math.round(r.score)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--rd-muted)' }}>{r.label}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Section 3 — Patterns we've noticed */}
      <div style={{ marginTop: 28 }}>
        <SectionLabel>Patterns We've Noticed</SectionLabel>
        {patterns.length === 0 && (
          <div style={{ fontSize: 14, color: 'var(--rd-muted)', lineHeight: 1.55 }}>
            As we talk more, the patterns in how you think will show up here.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {patterns.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: `var(${p.colorVar})`, marginTop: 6, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 15, color: 'var(--rd-ink-soft)', marginBottom: 3 }}>{p.title}</div>
                <div style={{ fontSize: 13, color: 'var(--rd-muted-2)', lineHeight: 1.55 }}>{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}
