import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function Insights() {
  const [profile, setProfile] = useState<any>(null);
  const [streak, setStreak] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getProfile();
        setProfile(data.profile);
        setStreak(data.streak);
      } catch (err) {
        console.error('Failed to load insights:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="p-8 text-gray-500">Loading insights...</div>;
  }

  if (!profile) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center">
        <h1 className="text-2xl font-bold mb-4">Insights</h1>
        <p className="text-gray-500">Complete a few sessions to start seeing your patterns and progress.</p>
      </div>
    );
  }

  const fourStages = [
    { label: 'Unconscious Unskilled', desc: "Don't know what you don't know", color: 'bg-gray-600' },
    { label: 'Conscious Unskilled', desc: 'Aware of gaps — danger zone', color: 'bg-amber-600' },
    { label: 'Conscious Skilled', desc: 'Adopting through repetition', color: 'bg-indigo-600' },
    { label: 'Unconscious Skilled', desc: 'Mastery — exponential results', color: 'bg-emerald-600' },
  ];

  // Estimate competence stage from total sessions
  const totalSessions = streak?.total_sessions || 0;
  let stageIndex = 0;
  if (totalSessions >= 60) stageIndex = 3;
  else if (totalSessions >= 21) stageIndex = 2;
  else if (totalSessions >= 5) stageIndex = 1;

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Your Insights</h1>

      {/* Four Stages of Competence */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Four Stages of Competence</h2>
        <div className="space-y-3">
          {fourStages.map((stage, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${i <= stageIndex ? stage.color : 'bg-gray-700'}`} />
              <div className="flex-1">
                <div className={`text-sm font-medium ${i === stageIndex ? 'text-white' : 'text-gray-500'}`}>
                  {stage.label}
                </div>
                <div className="text-xs text-gray-600">{stage.desc}</div>
              </div>
              {i === stageIndex && (
                <span className="text-xs bg-indigo-600/30 text-indigo-300 px-2 py-0.5 rounded">You are here</span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs text-gray-500">
          Based on {totalSessions} total sessions. Consistency is the mechanism that moves you through the stages.
        </div>
      </div>

      {/* Emotional Capacity Deep Dive */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Emotional Capacity Spectrum</h2>
        <div className="space-y-4">
          {[
            { key: 'suppression', label: 'Suppression', desc: 'Hiding, minimizing, numbing feelings', color: 'bg-amber-500', textColor: 'text-amber-400' },
            { key: 'discharge', label: 'Discharge', desc: 'Spraying emotions, making others carry your regulation', color: 'bg-red-500', textColor: 'text-red-400' },
            { key: 'capacity', label: 'Capacity', desc: 'Holding feelings with ownership and responsibility', color: 'bg-emerald-500', textColor: 'text-emerald-400' },
          ].map(item => {
            const val = profile.capacity_index?.[item.key] || 5;
            return (
              <div key={item.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${item.textColor}`}>{item.label}</span>
                  <span className="text-xs text-gray-500">{val.toFixed(1)} / 10</span>
                </div>
                <div className="h-3 bg-gray-800 rounded-full overflow-hidden mb-1">
                  <div className={`h-full rounded-full ${item.color} transition-all`} style={{ width: `${val * 10}%` }} />
                </div>
                <div className="text-xs text-gray-600">{item.desc}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
          <div className="text-xs text-gray-400">
            <strong className="text-gray-300">Goal:</strong> The opposite of suppression is NOT expression — it's capacity.
            As you build capacity, suppression and discharge naturally decrease.
          </div>
        </div>
      </div>

      {/* Context Maps */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Context Maps Health</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'map1_health', label: 'Work / Adult', desc: 'Belonging through contribution', icon: '💼' },
            { key: 'map2_health', label: 'Social / Adolescent', desc: 'Belonging through performing', icon: '🎭' },
            { key: 'map3_health', label: 'Home / Childhood', desc: 'Belonging through being', icon: '🏠' },
          ].map(map => {
            const val = profile.context_maps?.[map.key] || 5;
            return (
              <div key={map.key} className="text-center p-3 bg-gray-800/50 rounded-lg">
                <div className="text-2xl mb-1">{map.icon}</div>
                <div className="text-xs font-medium text-gray-300 mb-1">{map.label}</div>
                <div className="text-lg font-bold text-indigo-400">{val.toFixed(0)}/10</div>
                <div className="text-xs text-gray-600 mt-1">{map.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Victim-Healer Spectrum */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Victim — Healer Spectrum</h2>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm text-red-400 w-16 text-right">Victim</span>
          <div className="flex-1 h-4 bg-gray-800 rounded-full overflow-hidden relative">
            <div
              className="absolute top-0 h-full w-2 bg-white rounded-full shadow-lg shadow-white/30 transition-all"
              style={{ left: `${Math.max(2, Math.min(98, ((profile.victim_healer?.score || 0) + 5) * 10))}%` }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 via-transparent to-emerald-600/20" />
          </div>
          <span className="text-sm text-emerald-400 w-16">Healer</span>
        </div>
        <div className="text-center">
          <span className="text-xs text-gray-500">
            Score: {(profile.victim_healer?.score || 0).toFixed(1)} / 5
            {profile.victim_healer?.trending && profile.victim_healer.trending !== 'stable' && (
              <span className={profile.victim_healer.trending === 'improving' ? ' text-emerald-400' : ' text-amber-400'}>
                {' '}({profile.victim_healer.trending})
              </span>
            )}
          </span>
        </div>
        <div className="mt-3 p-3 bg-gray-800/50 rounded-lg">
          <div className="text-xs text-gray-400">
            <strong className="text-gray-300">Responsibility 2.0:</strong> Not something you TAKE (heavy load) — it's a LENS for power.
            Preference vs. Judgment: "I didn't want that" vs. "that was bad."
          </div>
        </div>
      </div>

      {/* Force vs Influence */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Force vs. Clean Influence</h2>
        <div className="space-y-3">
          {[
            { key: 'subtle', label: 'Subtle Force', desc: 'Overexplaining, hinting, managing reactions', color: 'bg-amber-500' },
            { key: 'clean', label: 'Clean Influence', desc: 'Creating conditions where people want to follow', color: 'bg-emerald-500' },
          ].map(item => {
            const val = profile.force_audit?.[item.key] || 5;
            return (
              <div key={item.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-300">{item.label}</span>
                  <span className="text-xs text-gray-500">{val.toFixed(1)}</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${val * 10}%` }} />
                </div>
                <div className="text-xs text-gray-600 mt-0.5">{item.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Life Congruence */}
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Life Congruence Wheel</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {profile.congruence && Object.entries(profile.congruence).map(([domain, score]) => (
            <div key={domain} className="text-center">
              <div className="relative w-14 h-14 mx-auto mb-2">
                <svg viewBox="0 0 36 36" className="w-14 h-14">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#1f2937"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="3"
                    strokeDasharray={`${(Number(score) / 10) * 100}, 100`}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{Number(score).toFixed(0)}</span>
              </div>
              <div className="text-xs text-gray-400 capitalize">{domain.replace('_', ' ')}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Meta-Programs */}
      {profile.meta_programs && (
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Detected Meta-Programs</h2>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(profile.meta_programs).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg">
                <span className="text-xs text-gray-500 capitalize">{key.replace('_', ' ')}</span>
                <span className={`text-xs font-medium ${value && value !== 'unknown' ? 'text-indigo-300' : 'text-gray-600'}`}>
                  {String(value) === 'unknown' ? '—' : String(value)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-gray-600">
            Meta-programs are detected through your language patterns during coaching sessions.
          </div>
        </div>
      )}
    </div>
  );
}
