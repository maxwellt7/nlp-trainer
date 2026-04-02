import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface Value { value_name: string; confidence: number; purity_score: number; expression: string; pure_expression: string; distorted_expression: string; evidence_count: number; }
interface Conflict { value_a: string; value_b: string; conflict_type: string; description: string; }
interface Statement { statement_type: string; content: string; confidence: number; }
interface Scores { value_clarity: number; value_alignment: number; hierarchy_stability: number; purity_ratio: number; conflict_awareness: number; worthiness_independence: number; decision_speed: number; overall_congruence: number; }
interface Evidence { quote: string; interpretation: string; detected_at: string; }

export default function Identity() {
  const [values, setValues] = useState<Value[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [scores, setScores] = useState<Scores | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedValue, setExpandedValue] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  useEffect(() => {
    api.getIdentity().then((data: any) => {
      setValues(data.values || []);
      setConflicts(data.conflicts || []);
      setStatements(data.statements || []);
      setScores(data.scores || null);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const loadEvidence = async (valueName: string) => {
    if (expandedValue === valueName) { setExpandedValue(null); return; }
    setExpandedValue(valueName);
    setEvidenceLoading(true);
    try {
      const data = await api.getValueEvidence(valueName);
      setEvidence(data.evidence || []);
    } catch { setEvidence([]); }
    setEvidenceLoading(false);
  };

  const scoreDimensions = scores ? [
    { label: 'Value Clarity', value: scores.value_clarity, desc: 'How clearly your core values are defined' },
    { label: 'Value Alignment', value: scores.value_alignment, desc: 'How consistently you live by your values' },
    { label: 'Hierarchy Stability', value: scores.hierarchy_stability, desc: 'How clear your value priorities are' },
    { label: 'Purity Ratio', value: scores.purity_ratio, desc: 'Pure vs distorted value expression' },
    { label: 'Conflict Awareness', value: scores.conflict_awareness, desc: 'Awareness of internal value tensions' },
    { label: 'Worthiness Independence', value: scores.worthiness_independence, desc: 'Self-worth independent of external validation' },
    { label: 'Decision Speed', value: scores.decision_speed, desc: 'Clarity and speed in value-aligned decisions' },
    { label: 'Overall Congruence', value: scores.overall_congruence, desc: 'Total alignment score across all dimensions' },
  ] : [];

  const purityColor = (s: number) => s >= 7 ? '#22c55e' : s >= 4 ? '#eab308' : '#ef4444';
  const exprBadge = (e: string) => {
    const c: Record<string, string> = { pure: '#22c55e', distorted: '#ef4444', mixed: '#eab308' };
    return <span style={{ background: c[e] || '#6b7280', color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>{e}</span>;
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><div style={{ color: '#a78bfa', fontSize: 18 }}>Loading identity profile...</div></div>;

  const hasData = values.length > 0;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '16px 16px 100px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Identity &amp; Values</h1>
      <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>
        {hasData ? 'Your value hierarchy and identity profile, built from daily conversations.' : 'Start a coaching session to begin building your identity profile.'}
      </p>

      {hasData && scores && (
        <div style={{ background: '#1e1b2e', borderRadius: 16, padding: 20, marginBottom: 24, border: '1px solid #2d2a3e' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0', marginBottom: 16 }}>Identity Score</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {scoreDimensions.map(dim => (
              <div key={dim.label} style={{ background: '#16132a', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{dim.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: dim.value >= 7 ? '#22c55e' : dim.value >= 4 ? '#eab308' : '#ef4444' }}>{dim.value.toFixed(1)}</div>
                <div style={{ height: 4, background: '#2d2a3e', borderRadius: 2, marginTop: 6 }}>
                  <div style={{ height: '100%', width: `${Math.min(100, dim.value * 10)}%`, background: dim.value >= 7 ? '#22c55e' : dim.value >= 4 ? '#eab308' : '#ef4444', borderRadius: 2, transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{dim.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasData && (
        <div style={{ background: '#1e1b2e', borderRadius: 16, padding: 20, marginBottom: 24, border: '1px solid #2d2a3e' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0', marginBottom: 16 }}>Value Hierarchy</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {values.map((v, i) => (
              <div key={v.value_name}>
                <div onClick={() => loadEvidence(v.value_name)} style={{ background: '#16132a', borderRadius: 12, padding: 14, cursor: 'pointer', border: expandedValue === v.value_name ? '1px solid #7c3aed' : '1px solid transparent', transition: 'border 0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20, fontWeight: 700, color: '#7c3aed', minWidth: 28 }}>#{i + 1}</span>
                      <span style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', textTransform: 'capitalize' }}>{v.value_name}</span>
                      {exprBadge(v.expression)}
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#94a3b8', flexWrap: 'wrap' }}>
                      <span>Confidence: {(v.confidence * 100).toFixed(0)}%</span>
                      <span style={{ color: purityColor(v.purity_score) }}>Purity: {v.purity_score.toFixed(1)}/10</span>
                      <span>{v.evidence_count} evidence</span>
                    </div>
                  </div>
                  {(v.pure_expression || v.distorted_expression) && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {v.pure_expression && <div style={{ fontSize: 12, color: '#22c55e' }}><strong>Pure:</strong> {v.pure_expression}</div>}
                      {v.distorted_expression && <div style={{ fontSize: 12, color: '#ef4444' }}><strong>Distorted:</strong> {v.distorted_expression}</div>}
                    </div>
                  )}
                </div>
                {expandedValue === v.value_name && (
                  <div style={{ background: '#0f0d1a', borderRadius: '0 0 12px 12px', padding: 14, borderTop: '1px solid #2d2a3e' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa', marginBottom: 8 }}>Evidence Trail</div>
                    {evidenceLoading ? <div style={{ color: '#64748b', fontSize: 12 }}>Loading...</div>
                      : evidence.length === 0 ? <div style={{ color: '#64748b', fontSize: 12 }}>No evidence yet. Continue coaching to build evidence.</div>
                      : evidence.map((e, j) => (
                        <div key={j} style={{ marginBottom: 8, padding: 8, background: '#16132a', borderRadius: 8 }}>
                          {e.quote && <div style={{ fontSize: 12, color: '#e2e8f0', fontStyle: 'italic' }}>"{e.quote}"</div>}
                          {e.interpretation && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{e.interpretation}</div>}
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{new Date(e.detected_at).toLocaleDateString()}</div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {conflicts.length > 0 && (
        <div style={{ background: '#1e1b2e', borderRadius: 16, padding: 20, marginBottom: 24, border: '1px solid #2d2a3e' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0', marginBottom: 16 }}>Value Conflicts</h2>
          {conflicts.map((c, i) => (
            <div key={i} style={{ background: '#16132a', borderRadius: 12, padding: 14, marginBottom: 8, borderLeft: '3px solid #ef4444' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', textTransform: 'capitalize' }}>{c.value_a}</span>
                <span style={{ color: '#ef4444', fontSize: 12 }}>vs</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', textTransform: 'capitalize' }}>{c.value_b}</span>
                <span style={{ fontSize: 11, color: '#94a3b8', background: '#2d2a3e', padding: '2px 6px', borderRadius: 6 }}>{c.conflict_type}</span>
              </div>
              {c.description && <div style={{ fontSize: 12, color: '#94a3b8' }}>{c.description}</div>}
            </div>
          ))}
        </div>
      )}

      {statements.length > 0 && (
        <div style={{ background: '#1e1b2e', borderRadius: 16, padding: 20, marginBottom: 24, border: '1px solid #2d2a3e' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0', marginBottom: 16 }}>Identity Statements</h2>
          {['limiting_belief', 'empowering_belief', 'core_identity', 'worthiness_pattern', 'root_belief'].map(type => {
            const items = statements.filter(s => s.statement_type === type);
            if (items.length === 0) return null;
            const labels: Record<string, { label: string; color: string }> = {
              limiting_belief: { label: 'Limiting Beliefs', color: '#ef4444' },
              empowering_belief: { label: 'Empowering Beliefs', color: '#22c55e' },
              core_identity: { label: 'Core Identity', color: '#a78bfa' },
              worthiness_pattern: { label: 'Worthiness Patterns', color: '#eab308' },
              root_belief: { label: 'Root Beliefs', color: '#3b82f6' },
            };
            const { label, color } = labels[type] || { label: type, color: '#94a3b8' };
            return (
              <div key={type} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                {items.map((s, i) => (
                  <div key={i} style={{ background: '#16132a', borderRadius: 8, padding: 10, marginBottom: 6, borderLeft: `3px solid ${color}` }}>
                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>"{s.content}"</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Confidence: {(s.confidence * 100).toFixed(0)}%</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {!hasData && (
        <div style={{ background: '#1e1b2e', borderRadius: 16, padding: 40, textAlign: 'center', border: '1px solid #2d2a3e' }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>Your Identity Map is Empty</div>
          <div style={{ fontSize: 14, color: '#94a3b8', maxWidth: 400, margin: '0 auto' }}>
            Start a daily coaching session. The AI will passively detect your values, beliefs, and identity patterns from your natural conversation.
          </div>
        </div>
      )}
    </div>
  );
}
