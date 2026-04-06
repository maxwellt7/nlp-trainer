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
  sessionCompleted: boolean;
  sessionInProgress: boolean;
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

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="brand-card p-3 text-center">
      <div className="stat-value text-xl">{value}</div>
      <div className="stat-label mt-0.5">{label}</div>
    </div>
  );
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
      <div className="flex items-center justify-center" style={{ height: '100%' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--color-accent-gold)', borderTopColor: 'transparent' }} />
          <span className="text-xs font-mono-brand" style={{ color: 'var(--color-text-dim)' }}>LOADING</span>
        </div>
      </div>
    );
  }

  const profile = data?.profile;
  const streak = data?.streak;
  const xp = data?.xp;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto pb-24">
      {/* ── Hero Section ── */}
      <div className="relative rounded-xl overflow-hidden mb-4" style={{ minHeight: 150 }}>
        <div className="absolute inset-0"
          style={{
            backgroundImage: 'url(/brand/session-card-bg.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center 30%',
            opacity: 0.4,
          }} />
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(180deg, rgba(11,15,25,0.3) 0%, rgba(11,15,25,0.95) 100%)',
        }} />
        <div className="relative p-5 sm:p-6 flex flex-col justify-end" style={{ minHeight: 150 }}>
          <p className="text-uppercase-spaced mb-1" style={{ color: 'var(--color-accent-gold)' }}>
            {new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl text-white mb-1">{getGreeting()}</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {data?.sessionCompleted
              ? "Session complete. Review your intel or continue exploring."
              : data?.sessionInProgress
                ? "You have an open session. Pick up where you left off."
                : "Your next session awaits. Step into the work."}
          </p>
        </div>
      </div>

      {/* ── XP Bar ── */}
      {xp && (
        <div className="mb-4">
          <XpBar
            level={xp.level}
            title={xp.title}
            totalXp={xp.total_xp}
            progressToNext={xp.progressToNext}
            maxLevel={xp.maxLevel}
          />
        </div>
      )}

      {/* ── CTA Button ── */}
      <Link
        to="/hypnosis"
        className={`block w-full rounded-xl p-4 mb-4 text-center font-bold text-base transition-all haptic-tap ${
          data?.sessionCompleted ? '' : 'animate-breathe'
        }`}
        style={{
          background: data?.sessionCompleted
            ? 'var(--color-brand-card)'
            : 'linear-gradient(135deg, var(--color-accent-gold-dim), var(--color-accent-gold))',
          border: data?.sessionCompleted
            ? '1px solid var(--color-brand-border-light)'
            : '1px solid rgba(212,168,83,0.3)',
          color: data?.sessionCompleted
            ? 'var(--color-text-secondary)'
            : 'var(--color-brand-midnight)',
          letterSpacing: '0.03em',
          boxShadow: data?.sessionCompleted ? 'none' : '0 4px 20px rgba(212, 168, 83, 0.25)',
        }}
      >
        {data?.sessionCompleted ? 'Review Session' : data?.sessionInProgress ? 'Continue Session' : 'Begin Session'}
      </Link>

      {/* ── Unopened Mystery Boxes ── */}
      {unopenedBoxes.length > 0 && (
        <div className="mb-6 space-y-3">
          <h2 className="text-uppercase-spaced" style={{ color: 'var(--color-text-dim)' }}>
            Sealed Intel ({unopenedBoxes.length})
          </h2>
          {unopenedBoxes.map(box => (
            <MysteryBox key={box.id} box={box} onOpened={handleBoxOpened} />
          ))}
        </div>
      )}

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard value={streak?.current_streak || 0} label="Streak" />
        <StatCard value={streak?.total_sessions || 0} label="Sessions" />
        <StatCard value={streak?.longest_streak || 0} label="Record" />
      </div>

      {xp && xp.streak_multiplier > 1 && (
        <div className="brand-card-gold p-3 text-center mb-4">
          <div className="flex items-center justify-center gap-2">
            <span className="font-mono-brand text-sm font-bold" style={{ color: 'var(--color-accent-gold)' }}>
              {xp.streak_multiplier}x
            </span>
            <span className="text-uppercase-spaced" style={{ color: 'var(--color-text-muted)' }}>XP Multiplier</span>
          </div>
        </div>
      )}

      {/* ── Living Avatar ── */}
      {profile?.congruence && (
        <div className="brand-card p-4 mb-6 flex items-center justify-center">
          <LivingAvatar congruence={profile.congruence} level={xp?.level || 1} size={140} />
        </div>
      )}

      {/* ── Profile Insights ── */}
      {profile && profile.capacity_index && (
        <div className="brand-card p-5 mb-6">
          <h2 className="text-uppercase-spaced mb-4" style={{ color: 'var(--color-text-dim)' }}>Operational Profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Capacity Index */}
            <div>
              <div className="text-xs font-semibold mb-2.5" style={{ color: 'var(--color-text-muted)' }}>Emotional Capacity</div>
              <div className="space-y-2.5">
                {(['suppression', 'discharge', 'capacity'] as const).map(key => {
                  const val = profile.capacity_index[key] || 5;
                  const colors: Record<string, string> = {
                    suppression: 'var(--color-status-warning)',
                    discharge: 'var(--color-status-error)',
                    capacity: 'var(--color-status-success)',
                  };
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs capitalize" style={{ color: 'var(--color-text-muted)' }}>{key}</span>
                        <span className="font-mono-brand text-xs" style={{ color: colors[key] }}>{val.toFixed(1)}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-brand-surface)' }}>
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${val * 10}%`, background: colors[key] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Meta-Programs */}
            <div>
              <div className="text-xs font-semibold mb-2.5" style={{ color: 'var(--color-text-muted)' }}>Detected Patterns</div>
              <div className="space-y-1.5">
                {profile.meta_programs && Object.entries(profile.meta_programs)
                  .filter(([, v]) => v && v !== 'unknown')
                  .map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between py-1 border-b" style={{ borderColor: 'var(--color-brand-border)' }}>
                      <span className="text-xs capitalize" style={{ color: 'var(--color-text-dim)' }}>{key.replace('_', ' ')}</span>
                      <span className="text-xs font-semibold capitalize" style={{ color: 'var(--color-accent-gold)' }}>{String(value)}</span>
                    </div>
                  ))
                }
                {profile.meta_programs && Object.values(profile.meta_programs).every(v => !v || v === 'unknown') && (
                  <div className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Patterns emerge through daily sessions</div>
                )}
              </div>
            </div>

            {/* Victim-Healer */}
            <div>
              <div className="text-xs font-semibold mb-2.5" style={{ color: 'var(--color-text-muted)' }}>Victim-Healer Spectrum</div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono-brand" style={{ color: 'var(--color-status-error)' }}>V</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden relative" style={{ background: 'var(--color-brand-surface)' }}>
                  <div className="absolute inset-0 rounded-full"
                    style={{ background: 'linear-gradient(90deg, var(--color-status-error), var(--color-status-warning), var(--color-status-success))' , opacity: 0.3 }} />
                  <div
                    className="absolute top-0 h-full w-2 rounded-full"
                    style={{ left: `${((profile.victim_healer?.score || 0) + 5) * 10}%`, background: 'var(--color-accent-gold)' }}
                  />
                </div>
                <span className="text-[10px] font-mono-brand" style={{ color: 'var(--color-status-success)' }}>H</span>
              </div>
              {profile.victim_healer?.trending && (
                <div className="text-[10px] mt-1.5 font-mono-brand" style={{
                  color: profile.victim_healer.trending === 'improving' ? 'var(--color-status-success)' : 'var(--color-status-warning)'
                }}>
                  TREND: {profile.victim_healer.trending.toUpperCase()}
                </div>
              )}
            </div>

            {/* Force Audit */}
            <div>
              <div className="text-xs font-semibold mb-2.5" style={{ color: 'var(--color-text-muted)' }}>Force vs. Influence</div>
              <div className="space-y-2.5">
                {(['subtle', 'clean'] as const).map(key => {
                  const val = profile.force_audit?.[key] || 5;
                  const colors: Record<string, string> = {
                    subtle: 'var(--color-status-warning)',
                    clean: 'var(--color-status-success)',
                  };
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {key === 'subtle' ? 'Subtle Force' : 'Clean Influence'}
                        </span>
                        <span className="font-mono-brand text-xs" style={{ color: colors[key] }}>{val.toFixed(1)}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-brand-surface)' }}>
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

      {/* ── Congruence Wheel ── */}
      {profile?.congruence && (
        <div className="brand-card p-5 mb-6">
          <h2 className="text-uppercase-spaced mb-4" style={{ color: 'var(--color-text-dim)' }}>Congruence Index</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(profile.congruence).map(([domain, score]) => (
              <div key={domain} className="text-center">
                <div className="relative w-14 h-14 mx-auto mb-2">
                  <svg viewBox="0 0 36 36" className="w-14 h-14">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke="var(--color-brand-surface)" strokeWidth="2.5"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke="var(--color-accent-gold)" strokeWidth="2.5"
                      strokeDasharray={`${(Number(score) / 10) * 100}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center font-mono-brand text-sm font-bold text-white">
                    {Number(score).toFixed(0)}
                  </span>
                </div>
                <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-text-dim)' }}>
                  {domain.replace('_', ' ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Achievements ── */}
      {achievements.length > 0 && (
        <div className="brand-card p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-uppercase-spaced" style={{ color: 'var(--color-text-dim)' }}>Achievements</h2>
            <span className="font-mono-brand text-xs" style={{ color: 'var(--color-text-dim)' }}>
              {achievements.filter(a => a.unlocked).length}/{achievements.length}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {achievements.slice(0, 9).map(ach => (
              <AchievementBadge key={ach.key} achievement={ach} compact />
            ))}
          </div>
          {achievements.length > 9 && (
            <button className="w-full text-center text-xs mt-3 py-2 rounded-lg transition-colors font-semibold"
              style={{ color: 'var(--color-accent-gold)' }}>
              View all {achievements.length} achievements
            </button>
          )}
        </div>
      )}

      {/* ── Recent Sessions ── */}
      {sessions.length > 0 && (
        <div className="brand-card p-5">
          <h2 className="text-uppercase-spaced mb-4" style={{ color: 'var(--color-text-dim)' }}>Session Log</h2>
          <div className="space-y-2">
            {sessions.map(s => (
              <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg transition-colors"
                style={{ background: 'var(--color-brand-surface)', border: '1px solid var(--color-brand-border)' }}>
                <div className="shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center"
                  style={{ background: 'var(--color-accent-gold-deep)', border: '1px solid rgba(212,168,83,0.15)' }}>
                  <span className="font-mono-brand text-[10px] font-bold" style={{ color: 'var(--color-accent-gold)' }}>
                    {new Date(s.date_key + 'T12:00:00').toLocaleDateString('en', { day: 'numeric' })}
                  </span>
                  <span className="text-[8px] uppercase" style={{ color: 'var(--color-text-dim)' }}>
                    {new Date(s.date_key + 'T12:00:00').toLocaleDateString('en', { month: 'short' })}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  {s.chat_summary && (
                    <p className="text-sm line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>{s.chat_summary}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {s.detected_map && (
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium"
                        style={{ background: 'var(--color-brand-card)', color: 'var(--color-text-muted)', border: '1px solid var(--color-brand-border)' }}>
                        {mapLabels[s.detected_map] || s.detected_map}
                      </span>
                    )}
                    {s.detected_state && stateLabels[s.detected_state] && (
                      <span className="text-[10px] font-semibold" style={{ color: stateLabels[s.detected_state].color }}>
                        {stateLabels[s.detected_state].label}
                      </span>
                    )}
                    {s.key_themes?.length > 0 && s.key_themes.slice(0, 2).map((t, i) => (
                      <span key={i} className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>#{t}</span>
                    ))}
                    {s.user_rating && (
                      <span className="text-[10px]" style={{ color: 'var(--color-accent-gold)' }}>{'★'.repeat(s.user_rating)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {sessions.length >= 7 && (
            <Link to="/sessions" className="block text-center text-xs mt-3 font-semibold transition-colors"
              style={{ color: 'var(--color-accent-gold)' }}>
              View full session log
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
