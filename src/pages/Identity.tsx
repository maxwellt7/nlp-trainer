import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface Value {
  id: string;
  value_name: string;
  rank: number;
  raw_items: string[];
  pure_expression: string;
  distorted_expression: string;
  origin_story: string;
  behavioral_commitment: string;
  purity_score: number;
  confidence: number;
  source: string;
}

interface IdentityScore {
  value_clarity: number;
  value_alignment: number;
  hierarchy_stability: number;
  purity_ratio: number;
  conflict_awareness: number;
  worthiness_independence: number;
  decision_speed: number;
  congruence_score: number;
  overall_identity_score: number;
  values_discovered: number;
  high_confidence_values: number;
  total_evidence: number;
  total_conflicts: number;
  resolved_conflicts: number;
}

interface Conflict {
  id: string;
  value_a_name: string;
  value_b_name: string;
  conflict_type: string;
  description: string;
  resolved: number;
}

interface Statement {
  id: string;
  statement_type: string;
  content: string;
  confidence: number;
  version: number;
}

const scoreDimensions = [
  { key: 'value_clarity', label: 'Value Clarity', desc: 'How clearly your values are identified', color: 'bg-indigo-500' },
  { key: 'value_alignment', label: 'Value Alignment', desc: 'Behavior matches stated values', color: 'bg-emerald-500' },
  { key: 'hierarchy_stability', label: 'Hierarchy Stability', desc: 'Consistency of your value ranking', color: 'bg-blue-500' },
  { key: 'purity_ratio', label: 'Purity Ratio', desc: 'Pure vs distorted value expression', color: 'bg-purple-500' },
  { key: 'conflict_awareness', label: 'Conflict Awareness', desc: 'Ability to see value conflicts', color: 'bg-amber-500' },
  { key: 'worthiness_independence', label: 'Worthiness Independence', desc: 'Internal vs external validation', color: 'bg-rose-500' },
  { key: 'decision_speed', label: 'Decision Speed', desc: 'How quickly you resolve decisions', color: 'bg-cyan-500' },
  { key: 'congruence_score', label: 'Overall Congruence', desc: 'Total alignment composite', color: 'bg-white' },
];

export default function Identity() {
  const [values, setValues] = useState<Value[]>([]);
  const [score, setScore] = useState<IdentityScore | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedValue, setExpandedValue] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getIdentity();
        setValues(data.values || []);
        setScore(data.score || null);
        setConflicts(data.conflicts || []);
        setStatements(data.statements || []);
      } catch (err) {
        console.error('Failed to load identity:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-gray-500 text-sm">Loading identity profile...</div>
      </div>
    );
  }

  const hasData = values.length > 0 || (score && score.overall_identity_score > 0);

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 max-w-3xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold mb-1">Identity & Values</h1>
      <p className="text-gray-500 text-sm mb-6">
        Your value hierarchy and identity profile, built progressively from your daily sessions.
      </p>

      {!hasData ? (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 text-center">
          <div className="text-4xl mb-3 opacity-30">◇</div>
          <h2 className="text-lg font-medium mb-2">Your Identity Profile is Building</h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            As you complete daily coaching sessions, the system passively detects your values, patterns, and identity markers from what you discuss. After 3-5 sessions, your value hierarchy will begin to emerge here.
          </p>
          <div className="mt-4 text-xs text-gray-600">
            The system listens for: what matters to you, what frustrates you, what excites you, what you choose and why, and the language you use to describe your experience.
          </div>
        </div>
      ) : (
        <>
          {/* Identity Score Overview */}
          {score && (
            <div className="bg-gray-900 rounded-xl p-4 sm:p-5 border border-gray-800 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-300">Identity Score</h2>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-indigo-400">{score.overall_identity_score.toFixed(1)}</span>
                  <span className="text-xs text-gray-500">/10</span>
                </div>
              </div>
              <div className="space-y-2.5">
                {scoreDimensions.map(dim => {
                  const val = (score as any)[dim.key] || 0;
                  return (
                    <div key={dim.key}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-gray-400">{dim.label}</span>
                        <span className="text-xs text-gray-500">{val.toFixed(1)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${dim.color} transition-all duration-500`} style={{ width: `${val * 10}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-gray-800">
                <div className="text-center">
                  <div className="text-lg font-bold text-indigo-400">{score.values_discovered}</div>
                  <div className="text-[10px] text-gray-500">Values Found</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-emerald-400">{score.high_confidence_values}</div>
                  <div className="text-[10px] text-gray-500">High Confidence</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-400">{score.total_evidence}</div>
                  <div className="text-[10px] text-gray-500">Evidence Points</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-amber-400">{score.total_conflicts}</div>
                  <div className="text-[10px] text-gray-500">Conflicts</div>
                </div>
              </div>
            </div>
          )}

          {/* Value Hierarchy */}
          {values.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-4 sm:p-5 border border-gray-800 mb-4">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">Value Hierarchy</h2>
              <div className="space-y-2">
                {values.map(v => (
                  <div key={v.id}>
                    <button
                      onClick={() => setExpandedValue(expandedValue === v.id ? null : v.id)}
                      className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors"
                    >
                      <span className="shrink-0 w-7 h-7 rounded-lg bg-indigo-600/20 flex items-center justify-center text-indigo-400 text-xs font-bold">
                        {v.rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-200 capitalize">{v.value_name}</span>
                          {v.source === 'explicit' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400">confirmed</span>
                          )}
                          {v.source === 'inferred' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">inferred</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-500">confidence: {v.confidence.toFixed(1)}</span>
                          <span className="text-[10px] text-gray-500">purity: {v.purity_score.toFixed(1)}</span>
                        </div>
                      </div>
                      <svg
                        className={`w-4 h-4 text-gray-500 transition-transform ${expandedValue === v.id ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {expandedValue === v.id && (
                      <div className="ml-10 mt-1 p-3 rounded-lg bg-gray-800/30 space-y-2 text-xs">
                        {v.pure_expression && (
                          <div>
                            <span className="text-emerald-400 font-medium">Pure expression: </span>
                            <span className="text-gray-300">{v.pure_expression}</span>
                          </div>
                        )}
                        {v.distorted_expression && (
                          <div>
                            <span className="text-amber-400 font-medium">Distorted expression: </span>
                            <span className="text-gray-300">{v.distorted_expression}</span>
                          </div>
                        )}
                        {v.behavioral_commitment && (
                          <div>
                            <span className="text-indigo-400 font-medium">Commitment: </span>
                            <span className="text-gray-300">{v.behavioral_commitment}</span>
                          </div>
                        )}
                        {v.origin_story && (
                          <div>
                            <span className="text-purple-400 font-medium">Origin: </span>
                            <span className="text-gray-300">{v.origin_story}</span>
                          </div>
                        )}
                        {/* Purity bar */}
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-gray-500">Purity</span>
                          <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${v.purity_score >= 7 ? 'bg-emerald-500' : v.purity_score >= 4 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${v.purity_score * 10}%` }}
                            />
                          </div>
                          <span className="text-gray-500">{v.purity_score.toFixed(1)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Value Conflicts */}
          {conflicts.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-4 sm:p-5 border border-gray-800 mb-4">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">Value Conflicts</h2>
              <div className="space-y-2">
                {conflicts.map(c => (
                  <div key={c.id} className="p-3 rounded-lg bg-gray-800/50">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-amber-400 capitalize">{c.value_a_name}</span>
                      <span className="text-[10px] text-gray-600">vs</span>
                      <span className="text-xs font-medium text-amber-400 capitalize">{c.value_b_name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">{c.conflict_type}</span>
                      {c.resolved ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400">resolved</span>
                      ) : null}
                    </div>
                    {c.description && (
                      <p className="text-xs text-gray-400">{c.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Identity Statements */}
          {statements.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-4 sm:p-5 border border-gray-800 mb-4">
              <h2 className="text-sm font-semibold text-gray-300 mb-3">Identity Statements</h2>
              <div className="space-y-2">
                {statements.map(s => (
                  <div key={s.id} className="p-3 rounded-lg bg-gray-800/50">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-900/50 text-indigo-300 capitalize">{s.statement_type.replace('_', ' ')}</span>
                      <span className="text-[10px] text-gray-600">v{s.version}</span>
                    </div>
                    <p className="text-sm text-gray-200 italic">"{s.content}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
