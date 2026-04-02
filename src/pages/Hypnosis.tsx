import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import Chat from '../components/Chat';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  hidden?: boolean;
}

interface ScriptResult {
  title: string;
  duration: string;
  estimatedMinutes: number;
  script: string;
  sessionSummary?: string;
  keyThemes?: string[];
}

interface ProfileUpdates {
  detected_map?: string | null;
  detected_state?: string | null;
  meta_programs?: Record<string, string | null>;
  key_themes?: string[];
  force_pattern?: string | null;
  victim_healer?: string | null;
}

const mapLabels: Record<string, string> = {
  map1: 'Work / Adult',
  map2: 'Social / Adolescent',
  map3: 'Home / Childhood',
};

function renderScript(script: string) {
  const parts = script.split(/<break\s+time="([\d.]+)s"\s*\/>/g);
  const elements: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      const text = parts[i];
      if (text && text.trim()) {
        elements.push(
          <p key={`t${i}`} className="leading-loose mb-0">{text.trim()}</p>
        );
      }
    } else {
      const seconds = parts[i];
      elements.push(
        <div key={`b${i}`} className="flex items-center gap-2 my-2">
          <span className="flex-1 border-t border-gray-700/50" />
          <span className="text-[10px] text-gray-600 shrink-0">{seconds}s</span>
          <span className="flex-1 border-t border-gray-700/50" />
        </div>
      );
    }
  }
  return elements;
}

export default function Hypnosis() {
  const [state, setState] = useState<'welcome' | 'mood' | 'coaching' | 'script'>('welcome');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [readyToGenerate, setReadyToGenerate] = useState(false);
  const [scriptResult, setScriptResult] = useState<ScriptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedScriptId, setSavedScriptId] = useState<string | null>(null);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [audioGenerated, setAudioGenerated] = useState(false);
  const [musicTracks, setMusicTracks] = useState<any[]>([]);
  const [selectedMusic, setSelectedMusic] = useState<string>('');
  const [musicVolume, setMusicVolume] = useState(0.15);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [moodBefore, setMoodBefore] = useState<number>(5);
  const [profileInsights, setProfileInsights] = useState<ProfileUpdates>({});
  const [sessionRating, setSessionRating] = useState<number>(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  // Check if there's an existing session today
  useEffect(() => {
    async function checkToday() {
      try {
        const profileData = await api.getProfile();
        if (profileData.hasSessionToday && profileData.todaySessionId) {
          // Resume today's session
          const session = await api.getSession(profileData.todaySessionId);
          if (session?.chat_messages) {
            const msgs = JSON.parse(typeof session.chat_messages === 'string' ? session.chat_messages : JSON.stringify(session.chat_messages));
            if (msgs.length > 0) {
              setMessages(msgs);
              setSessionId(session.id);
              setState('coaching');
              return;
            }
          }
        }
      } catch { /* first visit */ }
    }
    checkToday();
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    const userMsg: Message = { role: 'user', content };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);
    setError(null);

    try {
      const data = await api.hypnosisChat(
        updated.map(m => ({ role: m.role, content: m.content })),
        sessionId || undefined,
        messages.length === 0 ? moodBefore : undefined
      );
      setMessages([...updated, { role: 'assistant', content: data.reply }]);
      if (data.sessionId) setSessionId(data.sessionId);
      if (data.readyToGenerate) setReadyToGenerate(true);
      if (data.profileUpdates) {
        setProfileInsights(prev => ({
          ...prev,
          ...data.profileUpdates,
        }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to get response');
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  }, [messages, sessionId, moodBefore]);

  const generateScript = async () => {
    setGenerating(true);
    setError(null);

    try {
      const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));
      const data = await api.hypnosisGenerate(apiMessages, sessionId || undefined);
      setScriptResult(data);

      const saved = await api.saveScript({
        title: data.title,
        duration: data.duration,
        estimatedMinutes: data.estimatedMinutes,
        script: data.script,
      });
      setSavedScriptId(saved.id);

      try {
        const musicData = await api.listMusic();
        setMusicTracks(musicData.tracks || []);
        if (musicData.tracks?.length > 0) {
          setSelectedMusic(musicData.tracks[0].filename);
        }
      } catch { /* music is optional */ }

      setState('script');
    } catch (err: any) {
      setError(err.message || 'Failed to generate script');
    } finally {
      setGenerating(false);
    }
  };

  const generateAudio = async () => {
    if (!savedScriptId) return;
    setGeneratingAudio(true);
    setError(null);

    try {
      await api.generateAudio(
        savedScriptId,
        selectedMusic || undefined,
        selectedMusic ? musicVolume : undefined
      );
      setAudioGenerated(true);
    } catch (err: any) {
      setError(err.message || 'Failed to generate audio');
    } finally {
      setGeneratingAudio(false);
    }
  };

  const submitRating = async () => {
    if (!sessionId || sessionRating === 0) return;
    try {
      await api.rateSession(sessionId, sessionRating);
      setRatingSubmitted(true);
    } catch { /* non-critical */ }
  };

  const copyScript = async () => {
    if (!scriptResult) return;
    try {
      await navigator.clipboard.writeText(scriptResult.script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = scriptResult.script;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const reset = () => {
    setState('welcome');
    setMessages([]);
    setReadyToGenerate(false);
    setScriptResult(null);
    setError(null);
    setGenerating(false);
    setSavedScriptId(null);
    setGeneratingAudio(false);
    setAudioGenerated(false);
    setSessionId(null);
    setMoodBefore(5);
    setProfileInsights({});
    setSessionRating(0);
    setRatingSubmitted(false);
  };

  // ── Welcome State ──
  if (state === 'welcome') {
    return (
      <div className="p-4 sm:p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Daily Alignment Session</h1>
        <p className="text-gray-400 mb-8">
          Your personal coaching conversation that leads to a custom hypnosis audio.
          Share what's alive for you today, and the AI will guide you through a powerful
          exploration before generating a personalized script.
        </p>

        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-6">
          <h2 className="font-semibold mb-3">How it works</h2>
          <div className="text-sm text-gray-400 space-y-2">
            <div className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-xs font-bold">1</span>
              <span>Check in with how you're feeling right now</span>
            </div>
            <div className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-xs font-bold">2</span>
              <span>Have a coaching conversation about what matters most today</span>
            </div>
            <div className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-xs font-bold">3</span>
              <span>Receive a personalized hypnosis script tailored to your session</span>
            </div>
            <div className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-xs font-bold">4</span>
              <span>Generate audio and listen to your custom session</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setState('mood')}
          className="w-full bg-indigo-600 hover:bg-indigo-500 rounded-xl px-6 py-4 font-medium text-lg transition-colors"
        >
          Begin Today's Session
        </button>
      </div>
    );
  }

  // ── Mood Check-In ──
  if (state === 'mood') {
    return (
      <div className="p-4 sm:p-8 max-w-md mx-auto">
        <h2 className="text-xl font-bold mb-2">How are you feeling right now?</h2>
        <p className="text-gray-400 text-sm mb-6">Rate your current state from 1 (struggling) to 10 (thriving)</p>

        <div className="flex items-center justify-between mb-4 px-2">
          <span className="text-xs text-gray-500">Struggling</span>
          <span className="text-xs text-gray-500">Thriving</span>
        </div>

        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <button
              key={n}
              onClick={() => setMoodBefore(n)}
              className={`flex-1 aspect-square rounded-lg text-sm font-medium transition-all ${
                moodBefore === n
                  ? 'bg-indigo-600 text-white scale-110 shadow-lg shadow-indigo-600/30'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <button
          onClick={() => setState('coaching')}
          className="w-full bg-indigo-600 hover:bg-indigo-500 rounded-xl px-6 py-3 font-medium transition-colors"
        >
          Start Coaching Chat
        </button>
      </div>
    );
  }

  // ── Script Display ──
  if (state === 'script' && scriptResult) {
    return (
      <div className="p-4 sm:p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">{scriptResult.title}</h1>

        {scriptResult.sessionSummary && (
          <p className="text-gray-400 text-sm mb-4">{scriptResult.sessionSummary}</p>
        )}

        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-sm ${
            scriptResult.duration === 'full'
              ? 'bg-indigo-900/50 text-indigo-300'
              : 'bg-emerald-900/50 text-emerald-300'
          }`}>
            {scriptResult.duration === 'full' ? 'Full Session' : 'Short Script'} &mdash; ~{scriptResult.estimatedMinutes} min
          </span>
          {scriptResult.keyThemes?.map((t, i) => (
            <span key={i} className="px-2 py-1 rounded-full text-xs bg-gray-800 text-gray-400">#{t}</span>
          ))}
        </div>

        {/* Profile insights from this session */}
        {(profileInsights.detected_map || profileInsights.detected_state) && (
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-6">
            <div className="text-xs font-semibold text-gray-400 mb-2">Session Insights</div>
            <div className="flex gap-3 flex-wrap">
              {profileInsights.detected_map && (
                <span className="text-xs px-2 py-1 rounded bg-indigo-900/30 text-indigo-300">
                  Active Map: {mapLabels[profileInsights.detected_map] || profileInsights.detected_map}
                </span>
              )}
              {profileInsights.detected_state && (
                <span className="text-xs px-2 py-1 rounded bg-emerald-900/30 text-emerald-300">
                  State: {profileInsights.detected_state}
                </span>
              )}
              {profileInsights.force_pattern && (
                <span className="text-xs px-2 py-1 rounded bg-amber-900/30 text-amber-300">
                  Pattern: {profileInsights.force_pattern} force
                </span>
              )}
            </div>
          </div>
        )}

        <div className="bg-gray-900 rounded-xl p-4 sm:p-8 border border-gray-800 mb-6 text-gray-200 text-sm sm:text-base leading-loose font-serif">
          {renderScript(scriptResult.script)}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-xl px-6 py-3 text-sm text-red-300 mb-4">
            {error}
          </div>
        )}

        {/* Session Rating */}
        {!ratingSubmitted && (
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-6">
            <div className="text-sm text-gray-300 mb-2">How was this session?</div>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setSessionRating(n)}
                  className={`text-2xl transition-all ${
                    n <= sessionRating ? 'text-amber-400' : 'text-gray-700'
                  }`}
                >
                  ★
                </button>
              ))}
              {sessionRating > 0 && (
                <button
                  onClick={submitRating}
                  className="ml-3 text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg px-3 py-1 transition-colors"
                >
                  Submit
                </button>
              )}
            </div>
          </div>
        )}
        {ratingSubmitted && (
          <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-xl px-4 py-2 text-sm text-emerald-400 mb-6">
            Thank you for your feedback!
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={copyScript}
            className={`rounded-xl px-6 py-3 font-medium transition-colors ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            {copied ? 'Copied!' : 'Copy Script'}
          </button>
          {savedScriptId && !audioGenerated && (
            <div className="flex items-center gap-3 flex-wrap">
              {musicTracks.length > 0 && (
                <>
                  <select
                    value={selectedMusic}
                    onChange={e => setSelectedMusic(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100"
                  >
                    <option value="">No background music</option>
                    {musicTracks.map((t: any) => (
                      <option key={t.filename} value={t.filename}>{t.name}</option>
                    ))}
                  </select>
                  {selectedMusic && (
                    <label className="flex items-center gap-2 text-xs text-gray-400">
                      Vol
                      <input
                        type="range"
                        min="0.05"
                        max="0.4"
                        step="0.05"
                        value={musicVolume}
                        onChange={e => setMusicVolume(parseFloat(e.target.value))}
                        className="w-20 accent-purple-500"
                      />
                      {Math.round(musicVolume * 100)}%
                    </label>
                  )}
                </>
              )}
              <button
                onClick={generateAudio}
                disabled={generatingAudio}
                className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl px-6 py-3 font-medium transition-colors"
              >
                {generatingAudio ? 'Generating Audio...' : 'Generate Audio'}
              </button>
            </div>
          )}
          {audioGenerated && (
            <Link
              to="/audios"
              className="bg-emerald-600 hover:bg-emerald-500 rounded-xl px-6 py-3 font-medium transition-colors inline-block"
            >
              View in Audios
            </Link>
          )}
          <button
            onClick={reset}
            className="bg-gray-800 hover:bg-gray-700 rounded-xl px-6 py-3 font-medium transition-colors"
          >
            New Session
          </button>
        </div>
      </div>
    );
  }

  // ── Coaching Chat ──
  return (
    <div className="h-screen flex flex-col">
      {/* Minimal header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm sm:text-base">Daily Coaching</span>
          {profileInsights.detected_map && (
            <span className="text-xs bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded hidden sm:inline">
              {mapLabels[profileInsights.detected_map] || profileInsights.detected_map}
            </span>
          )}
        </div>
        <button
          onClick={reset}
          className="bg-gray-800 hover:bg-gray-700 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-hidden">
        <Chat
          messages={messages}
          onSend={sendMessage}
          loading={loading}
          coached={false}
          disabled={generating || readyToGenerate}
        />
      </div>

      {/* Create Audio CTA — appears when coaching is complete */}
      {readyToGenerate && !generating && (
        <div className="border-t border-indigo-800 bg-gradient-to-r from-indigo-950 to-purple-950 px-4 sm:px-6 py-4 shrink-0">
          <button
            onClick={generateScript}
            className="w-full bg-indigo-600 hover:bg-indigo-500 rounded-xl px-6 py-4 font-semibold text-base sm:text-lg transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/30 active:scale-[0.98]"
          >
            Create Audio
          </button>
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div className="border-t border-gray-800 bg-gray-900 px-4 sm:px-6 py-4 shrink-0">
          <div className="flex items-center justify-center gap-3 text-gray-300">
            <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Creating your personalized hypnosis script...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border-t border-red-800 px-6 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
