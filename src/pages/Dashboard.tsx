import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

interface ProfileData {
  userId: string;
  profile: any;
  streak: { current_streak: number; longest_streak: number; total_sessions: number; last_session_date: string | null };
  hasSessionToday: boolean;
  todaySessionId: string | null;
}

interface SessionSummary {
  id: string;
  date_key: string;
  chat_summary: string;
  detected_map: string;
  detected_state: string;
  key_themes: string[];
  mood_before: number | null;
  mood_after: number | null;
  user_rating: number | null;
  script_id: string | null;
  audio_file: string | null;
}

const mapLabels: Record<string, string> = {
  map1: 'Work / Adult',
  map2: 'Social / Adolescent',
  map3: 'Home / Childhood',
};

const stateLabels: Record<string, { label: string; color: string }> = {
  suppression: { label: 'Suppression', color: 'text-amber-400' },
  discharge: { label: 'Discharge', color: 'text-red-400' },
  capacity: { label: 'Capacity', color: 'text-emerald-400' },
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [profileData, sessionData] = await Promise.all([
          api.getProfile(),
          api.getSessions(7),
        ]);
        setData(profileData);
        setSessions(sessionData.sessions || []);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const profile = data?.profile;
  const streak = data?.streak;

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">{getGreeting()}</h1>
        <p className="text-gray-400">
          {data?.hasSessionToday
            ? "You've already checked in today. You can continue your session or review your insights."
            : "Ready for today's session? Let's explore what's alive for you."}
        </p>
      </div>

      {/* CTA */}
      <Link
        to="/hypnosis"
        className={`block w-full rounded-xl p-6 mb-8 text-center font-medium text-lg transition-all ${
          data?.hasSessionToday
            ? 'bg-gray-800 hover:bg-gray-700 border border-gray-700'
            : 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20'
        }`}
      >
        {data?.hasSessionToday ? 'Continue Today\'s Session' : 'Start Today\'s Session'}
      </Link>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
          <div className="text-2xl font-bold text-indigo-400">{streak?.current_streak || 0}</div>
          <div className="text-xs text-gray-500 mt-1">Day Streak</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
          <div className="text-2xl font-bold text-emerald-400">{streak?.total_sessions || 0}</div>
          <div className="text-xs text-gray-500 mt-1">Total Sessions</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
          <div className="text-2xl font-bold text-purple-400">{streak?.longest_streak || 0}</div>
          <div className="text-xs text-gray-500 mt-1">Best Streak</div>
        </div>
      </div>

      {/* Profile Insights */}
      {profile && profile.capacity_index && (
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Your Profile Insights</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Capacity Index */}
            <div>
              <div className="text-xs text-gray-500 mb-2">Emotional Capacity</div>
              <div className="space-y-2">
                {(['suppression', 'discharge', 'capacity'] as const).map(key => {
                  const val = profile.capacity_index[key] || 5;
                  const colors: Record<string, string> = { suppression: 'bg-amber-500', discharge: 'bg-red-500', capacity: 'bg-emerald-500' };
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-24 capitalize">{key}</span>
                      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${colors[key]}`} style={{ width: `${val * 10}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-6 text-right">{val.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Meta-Programs */}
            <div>
              <div className="text-xs text-gray-500 mb-2">Detected Patterns</div>
              <div className="space-y-1">
                {profile.meta_programs && Object.entries(profile.meta_programs)
                  .filter(([, v]) => v && v !== 'unknown')
                  .map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 capitalize">{key.replace('_', ' ')}:</span>
                      <span className="text-xs text-indigo-300 capitalize">{String(value)}</span>
                    </div>
                  ))
                }
                {profile.meta_programs && Object.values(profile.meta_programs).every(v => !v || v === 'unknown') && (
                  <div className="text-xs text-gray-600">Patterns will emerge as you chat daily</div>
                )}
              </div>
            </div>

            {/* Victim-Healer */}
            <div>
              <div className="text-xs text-gray-500 mb-2">Victim-Healer Spectrum</div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400">Victim</span>
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden relative">
                  <div
                    className="absolute top-0 h-full w-1.5 bg-white rounded-full"
                    style={{ left: `${((profile.victim_healer?.score || 0) + 5) * 10}%` }}
                  />
                </div>
                <span className="text-xs text-emerald-400">Healer</span>
              </div>
              {profile.victim_healer?.trending && profile.victim_healer.trending !== 'stable' && (
                <div className={`text-xs mt-1 ${profile.victim_healer.trending === 'improving' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  Trending: {profile.victim_healer.trending}
                </div>
              )}
            </div>

            {/* Force Audit */}
            <div>
              <div className="text-xs text-gray-500 mb-2">Force vs. Influence</div>
              <div className="space-y-2">
                {(['subtle', 'clean'] as const).map(key => {
                  const val = profile.force_audit?.[key] || 5;
                  const colors: Record<string, string> = { subtle: 'bg-amber-500', clean: 'bg-emerald-500' };
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-20 capitalize">{key === 'subtle' ? 'Subtle Force' : 'Clean Influence'}</span>
                      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${colors[key]}`} style={{ width: `${val * 10}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Congruence Wheel */}
      {profile?.congruence && (
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Life Congruence</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(profile.congruence).map(([domain, score]) => (
              <div key={domain} className="text-center">
                <div className="relative w-12 h-12 mx-auto mb-1">
                  <svg viewBox="0 0 36 36" className="w-12 h-12">
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
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{Number(score).toFixed(0)}</span>
                </div>
                <div className="text-xs text-gray-500 capitalize">{domain.replace('_', ' ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      {sessions.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Recent Sessions</h2>
          <div className="space-y-3">
            {sessions.map(s => (
              <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/50">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-indigo-600/20 flex items-center justify-center text-indigo-400 text-xs font-bold">
                  {new Date(s.date_key + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                </div>
                <div className="flex-1 min-w-0">
                  {s.chat_summary && (
                    <p className="text-sm text-gray-300 line-clamp-2">{s.chat_summary}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {s.detected_map && (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-400">
                        {mapLabels[s.detected_map] || s.detected_map}
                      </span>
                    )}
                    {s.detected_state && stateLabels[s.detected_state] && (
                      <span className={`text-xs ${stateLabels[s.detected_state].color}`}>
                        {stateLabels[s.detected_state].label}
                      </span>
                    )}
                    {s.key_themes?.length > 0 && s.key_themes.slice(0, 2).map((t, i) => (
                      <span key={i} className="text-xs text-gray-500">#{t}</span>
                    ))}
                    {s.user_rating && (
                      <span className="text-xs text-amber-400">{'★'.repeat(s.user_rating)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {sessions.length >= 7 && (
            <Link to="/sessions" className="block text-center text-sm text-indigo-400 hover:text-indigo-300 mt-3">
              View all sessions
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
