import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import XpBar from '../components/XpBar';
import MysteryBox from '../components/MysteryBox';
import LivingAvatar from '../components/LivingAvatar';
import AchievementBadge from '../components/AchievementBadge';

interface ProfileData {
  userId: string;
  profile: any;
  streak: { current_streak: number; longest_streak: number; total_sessions: number; last_session_date: string | null };
  hasSessionToday: boolean;
  todaySessionId: string | null;
  xp: any;
  unopenedBoxes: number;
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
  suppression: { label: 'Suppression', color: 'var(--color-status-warning)' },
  discharge: { label: 'Discharge', color: 'var(--color-status-error)' },
  capacity: { label: 'Capacity', color: 'var(--color-status-success)' },
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
  const [unopenedBoxes, setUnopenedBoxes] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
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

        // Load gamification data
        try {
          const [boxData, achData] = await Promise.all([
            api.getUnopenedBoxes(),
            api.getAchievements(),
          ]);
          setUnopenedBoxes(boxData.boxes || []);
          setAchievements(achData.achievements || []);
        } catch { /* gamification optional */ }
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleBoxOpened = (openedBox: any) => {
    setUnopenedBoxes(prev => prev.filter(b => b.id !== openedBox.id));
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center" style={{ height: '100%' }}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--color-accent-cyan)', borderTopColor: 'transparent' }} />
          <span style={{ color: 'var(--color-text-muted)' }}>Loading...</span>
        </div>
      </div>
    );
  }

  const profile = data?.profile;
  const streak = data?.streak;
  const xp = data?.xp;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto pb-24">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1 text-white">{getGreeting()}</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          {data?.hasSessionToday
            ? "You've already checked in today. You can continue your session or review your insights."
            : "Ready for today's session? Let's explore what's alive for you."}
        </p>
      </div>

      {/* XP Bar */}
      {xp && (
        <div className="mb-6">
          <XpBar
            level={xp.level}
            title={xp.title}
            totalXp={xp.total_xp}
            progressToNext={xp.progressToNext}
            maxLevel={xp.maxLevel}
          />
        </div>
      )}

      {/* CTA Button with breathing animation */}
      <Link
        to="/hypnosis"
        className={`block w-full rounded-2xl p-5 mb-6 text-center font-semibold text-lg transition-all haptic-tap ${
          data?.hasSessionToday ? '' : 'animate-breathe'
        }`}
        style={{
          background: data?.hasSessionToday
            ? 'var(--color-brand-card)'
            : 'linear-gradient(135deg, var(--color-accent-cyan-dim), var(--color-accent-cyan))',
          border: `1px solid ${data?.hasSessionToday ? 'var(--color-brand-border)' : 'transparent'}`,
          color: 'white',
        }}
      >
        {data?.hasSessionToday ? 'Continue Today\'s Session' : 'Start Today\'s Session'}
      </Link>

      {/* Unopened Mystery Boxes */}
      {unopenedBoxes.length > 0 && (
        <div className="mb-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
            Sealed Insights ({unopenedBoxes.length})
          </h2>
          {unopenedBoxes.map(box => (
            <MysteryBox key={box.id} box={box} onOpened={handleBoxOpened} />
          ))}
        </div>
      )}

      {/* Stats Row + Living Avatar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card p-3 text-center">
            <div className="text-2xl font-bold" style={{ color: 'var(--color-accent-cyan)' }}>
              {streak?.current_streak || 0}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-text-dim)' }}>Day Streak</div>
          </div>
          <div className="glass-card p-3 text-center">
            <div className="text-2xl font-bold" style={{ color: 'var(--color-status-success)' }}>
              {streak?.total_sessions || 0}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-text-dim)' }}>Sessions</div>
          </div>
          <div className="glass-card p-3 text-center">
            <div className="text-2xl font-bold" style={{ color: 'var(--color-accent-violet)' }}>
              {streak?.longest_streak || 0}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-text-dim)' }}>Best Streak</div>
          </div>

          {/* Streak multiplier */}
          {xp && xp.streak_multiplier > 1 && (
            <div className="col-span-3 glass-card p-3 text-center">
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm font-bold" style={{ color: 'var(--color-accent-gold)' }}>
                  {xp.streak_multiplier}x XP Multiplier
                </span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Active</span>
              </div>
            </div>
          )}
        </div>

        {/* Living Avatar */}
        {profile?.congruence && (
          <div className="glass-card p-4 flex items-center justify-center">
            <LivingAvatar
              congruence={profile.congruence}
              level={xp?.level || 1}
              size={160}
            />
          </div>
        )}
      </div>

      {/* Profile Insights */}
      {profile && profile.capacity_index && (
        <div className="glass-card p-5 mb-6">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Your Profile Insights
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Capacity Index */}
            <div>
              <div className="text-xs mb-2" style={{ color: 'var(--color-text-dim)' }}>Emotional Capacity</div>
              <div className="space-y-2">
                {(['suppression', 'discharge', 'capacity'] as const).map(key => {
                  const val = profile.capacity_index[key] || 5;
                  const colors: Record<string, string> = {
                    suppression: 'var(--color-status-warning)',
                    discharge: 'var(--color-status-error)',
                    capacity: 'var(--color-status-success)',
                  };
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs w-24 capitalize" style={{ color: 'var(--color-text-muted)' }}>{key}</span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-brand-surface)' }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${val * 10}%`, background: colors[key] }} />
                      </div>
                      <span className="text-xs w-6 text-right" style={{ color: 'var(--color-text-dim)' }}>{val.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Meta-Programs */}
            <div>
              <div className="text-xs mb-2" style={{ color: 'var(--color-text-dim)' }}>Detected Patterns</div>
              <div className="space-y-1">
                {profile.meta_programs && Object.entries(profile.meta_programs)
                  .filter(([, v]) => v && v !== 'unknown')
                  .map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs capitalize" style={{ color: 'var(--color-text-dim)' }}>{key.replace('_', ' ')}:</span>
                      <span className="text-xs capitalize" style={{ color: 'var(--color-accent-cyan)' }}>{String(value)}</span>
                    </div>
                  ))
                }
                {profile.meta_programs && Object.values(profile.meta_programs).every(v => !v || v === 'unknown') && (
                  <div className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Patterns will emerge as you chat daily</div>
                )}
              </div>
            </div>

            {/* Victim-Healer */}
            <div>
              <div className="text-xs mb-2" style={{ color: 'var(--color-text-dim)' }}>Victim-Healer Spectrum</div>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--color-status-error)' }}>Victim</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden relative" style={{ background: 'var(--color-brand-surface)' }}>
                  <div
                    className="absolute top-0 h-full w-1.5 rounded-full bg-white"
                    style={{ left: `${((profile.victim_healer?.score || 0) + 5) * 10}%` }}
                  />
                </div>
                <span className="text-xs" style={{ color: 'var(--color-status-success)' }}>Healer</span>
              </div>
              {profile.victim_healer?.trending && profile.victim_healer.trending !== 'stable' && (
                <div className="text-xs mt-1" style={{
                  color: profile.victim_healer.trending === 'improving' ? 'var(--color-status-success)' : 'var(--color-status-warning)'
                }}>
                  Trending: {profile.victim_healer.trending}
                </div>
              )}
            </div>

            {/* Force Audit */}
            <div>
              <div className="text-xs mb-2" style={{ color: 'var(--color-text-dim)' }}>Force vs. Influence</div>
              <div className="space-y-2">
                {(['subtle', 'clean'] as const).map(key => {
                  const val = profile.force_audit?.[key] || 5;
                  const colors: Record<string, string> = {
                    subtle: 'var(--color-status-warning)',
                    clean: 'var(--color-status-success)',
                  };
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs w-20 capitalize" style={{ color: 'var(--color-text-muted)' }}>
                        {key === 'subtle' ? 'Subtle Force' : 'Clean Influence'}
                      </span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-brand-surface)' }}>
                        <div className="h-full rounded-full" style={{ width: `${val * 10}%`, background: colors[key] }} />
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
        <div className="glass-card p-5 mb-6">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-secondary)' }}>Life Congruence</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(profile.congruence).map(([domain, score]) => (
              <div key={domain} className="text-center">
                <div className="relative w-12 h-12 mx-auto mb-1">
                  <svg viewBox="0 0 36 36" className="w-12 h-12">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="var(--color-brand-surface)"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="var(--color-accent-cyan)"
                      strokeWidth="3"
                      strokeDasharray={`${(Number(score) / 10) * 100}, 100`}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                    {Number(score).toFixed(0)}
                  </span>
                </div>
                <div className="text-xs capitalize" style={{ color: 'var(--color-text-dim)' }}>{domain.replace('_', ' ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Achievements */}
      {achievements.length > 0 && (
        <div className="glass-card p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Achievements</h2>
            <span className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
              {achievements.filter(a => a.unlocked).length}/{achievements.length}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {achievements.slice(0, 9).map(ach => (
              <AchievementBadge key={ach.key} achievement={ach} compact />
            ))}
          </div>
          {achievements.length > 9 && (
            <button className="w-full text-center text-xs mt-3 py-2 rounded-lg transition-colors"
              style={{ color: 'var(--color-accent-cyan)' }}>
              View all {achievements.length} achievements
            </button>
          )}
        </div>
      )}

      {/* Recent Sessions */}
      {sessions.length > 0 && (
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-secondary)' }}>Recent Sessions</h2>
          <div className="space-y-3">
            {sessions.map(s => (
              <div key={s.id} className="flex items-start gap-3 p-3 rounded-xl transition-colors"
                style={{ background: 'var(--color-brand-surface)' }}>
                <div className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{ background: 'var(--color-accent-cyan-glow)', color: 'var(--color-accent-cyan)' }}>
                  {new Date(s.date_key + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                </div>
                <div className="flex-1 min-w-0">
                  {s.chat_summary && (
                    <p className="text-sm line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>{s.chat_summary}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {s.detected_map && (
                      <span className="text-xs px-2 py-0.5 rounded"
                        style={{ background: 'var(--color-brand-card)', color: 'var(--color-text-muted)' }}>
                        {mapLabels[s.detected_map] || s.detected_map}
                      </span>
                    )}
                    {s.detected_state && stateLabels[s.detected_state] && (
                      <span className="text-xs" style={{ color: stateLabels[s.detected_state].color }}>
                        {stateLabels[s.detected_state].label}
                      </span>
                    )}
                    {s.key_themes?.length > 0 && s.key_themes.slice(0, 2).map((t, i) => (
                      <span key={i} className="text-xs" style={{ color: 'var(--color-text-dim)' }}>#{t}</span>
                    ))}
                    {s.user_rating && (
                      <span className="text-xs" style={{ color: 'var(--color-accent-gold)' }}>{'★'.repeat(s.user_rating)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {sessions.length >= 7 && (
            <Link to="/sessions" className="block text-center text-sm mt-3 transition-colors"
              style={{ color: 'var(--color-accent-cyan)' }}>
              View all sessions
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
