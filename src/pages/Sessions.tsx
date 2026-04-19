import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

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
  created_at: string;
}

const mapLabels: Record<string, string> = {
  map1: 'Work / Adult',
  map2: 'Social / Adolescent',
  map3: 'Home / Childhood',
};

export default function Sessions() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getSessions(50);
        setSessions(data.sessions || []);
      } catch (err) {
        console.error('Failed to load sessions:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="p-8 text-gray-500">Loading sessions...</div>;
  }

  if (sessions.length === 0) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center">
        <h1 className="text-2xl font-bold mb-4">Session History</h1>
        <p className="text-gray-500">No sessions yet. Start your first daily session to begin building your history.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Session History</h1>
      <div className="space-y-3">
        {sessions.map(s => (
          <div
            key={s.id}
            className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"
          >
            <div className="flex items-start gap-3 p-4 hover:bg-gray-800/50 transition-colors">
              <Link
                to={`/hypnosis?sessionId=${s.id}`}
                className="flex flex-1 min-w-0 items-start gap-3 text-left"
              >
                <div className="shrink-0 w-12 h-12 rounded-lg bg-indigo-600/20 flex flex-col items-center justify-center text-indigo-400">
                  <span className="text-xs font-bold">
                    {new Date(s.date_key + 'T12:00:00').toLocaleDateString('en', { month: 'short' })}
                  </span>
                  <span className="text-lg font-bold leading-none">
                    {new Date(s.date_key + 'T12:00:00').getDate()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  {s.chat_summary ? (
                    <p className="text-sm text-gray-300 line-clamp-2">{s.chat_summary}</p>
                  ) : (
                    <p className="text-sm text-gray-500 italic">Session in progress...</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {s.detected_map && (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-400">
                        {mapLabels[s.detected_map] || s.detected_map}
                      </span>
                    )}
                    {s.detected_state && (
                      <span className={`text-xs capitalize ${
                        s.detected_state === 'capacity' ? 'text-emerald-400' :
                        s.detected_state === 'discharge' ? 'text-red-400' :
                        'text-amber-400'
                      }`}>
                        {s.detected_state}
                      </span>
                    )}
                    {s.key_themes?.slice(0, 3).map((t, i) => (
                      <span key={i} className="text-xs text-gray-500">#{t}</span>
                    ))}
                    {s.user_rating && (
                      <span className="text-xs text-amber-400">{'★'.repeat(s.user_rating)}</span>
                    )}
                    {s.audio_file && (
                      <span className="text-xs text-purple-400">Audio</span>
                    )}
                  </div>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                aria-label={expanded === s.id ? 'Collapse session details' : 'Expand session details'}
                className="shrink-0 rounded-lg px-2 py-1 text-gray-600 text-sm hover:bg-gray-800"
              >
                {expanded === s.id ? '▲' : '▼'}
              </button>
            </div>

            {expanded === s.id && (
              <div className="px-4 pb-4 border-t border-gray-800 pt-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {s.mood_before !== null && (
                    <div>
                      <span className="text-gray-500">Mood Before:</span>{' '}
                      <span className="text-gray-300">{s.mood_before}/10</span>
                    </div>
                  )}
                  {s.mood_after !== null && (
                    <div>
                      <span className="text-gray-500">Mood After:</span>{' '}
                      <span className="text-gray-300">{s.mood_after}/10</span>
                    </div>
                  )}
                </div>
                {s.chat_summary && (
                  <p className="text-sm text-gray-400 mt-3">{s.chat_summary}</p>
                )}
                <Link
                  to={`/hypnosis?sessionId=${s.id}`}
                  className="inline-flex mt-3 rounded-lg px-3 py-2 text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                >
                  {s.script_id ? 'Review Session' : 'Continue Session'}
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
