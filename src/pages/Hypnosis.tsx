import { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
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

export default function Hypnosis() {
  const [phase, setPhase] = useState<'loading' | 'chat' | 'generating' | 'complete'>('loading');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [readyToGenerate, setReadyToGenerate] = useState(false);
  const [scriptResult, setScriptResult] = useState<ScriptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [profileInsights, setProfileInsights] = useState<ProfileUpdates>({});
  const [sessionRating, setSessionRating] = useState<number>(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [savedScriptId, setSavedScriptId] = useState<string | null>(null);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [audioGenerated, setAudioGenerated] = useState(false);
  const [musicTracks, setMusicTracks] = useState<any[]>([]);
  const [selectedMusic, setSelectedMusic] = useState<string>('');
  const [musicVolume, setMusicVolume] = useState(0.15);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  // Initialize: check for existing session or start fresh with agent greeting
  useEffect(() => {
    async function init() {
      try {
        const profileData = await api.getProfile();

        // If there's an existing session today, resume it
        if (profileData.hasSessionToday && profileData.todaySessionId) {
          const session = await api.getSession(profileData.todaySessionId);
          if (session?.chat_messages) {
            const msgs = JSON.parse(
              typeof session.chat_messages === 'string'
                ? session.chat_messages
                : JSON.stringify(session.chat_messages)
            );
            if (msgs.length > 0) {
              setMessages(msgs);
              setSessionId(session.id);
              setPhase('chat');
              return;
            }
          }
        }

        // No session today — agent initiates the conversation
        const greeting = buildGreeting(profileData);
        setMessages([{ role: 'assistant', content: greeting }]);
        setPhase('chat');
      } catch {
        // First visit or API not ready — use a default greeting
        setMessages([{
          role: 'assistant',
          content: "Hey — welcome. I'm here for your daily check-in. What's on your mind today? Could be something you're working through, something that happened, or just how you're feeling right now.",
        }]);
        setPhase('chat');
      }
    }
    init();
  }, []);

  function buildGreeting(profileData: any): string {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const streak = profileData?.streak?.current_streak || 0;
    const totalSessions = profileData?.streak?.total_sessions || 0;

    if (totalSessions === 0) {
      return `${timeGreeting}. This is your first session — I'm glad you're here. I'm your daily coach. We'll have a brief conversation about what's going on in your life, and then I'll create a personalized hypnosis audio just for you based on what we discuss.\n\nSo — what's alive for you today? What's taking up space in your mind?`;
    }

    if (streak > 3) {
      return `${timeGreeting}. ${streak} days in a row — that consistency is building real momentum. What's showing up for you today?`;
    }

    return `${timeGreeting}. Good to have you back. What's on your mind today?`;
  }

  // Send a message
  const sendMessage = useCallback(async () => {
    const content = input.trim();
    if (!content || loading) return;

    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    const userMsg: Message = { role: 'user', content };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);
    setError(null);

    try {
      // Build the API messages — include the agent's initial greeting as first assistant message
      const apiMessages = updated
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }));

      const data = await api.hypnosisChat(
        apiMessages,
        sessionId || undefined,
        messages.length <= 1 ? undefined : undefined // mood is now implicit
      );

      setMessages([...updated, { role: 'assistant', content: data.reply }]);
      if (data.sessionId) setSessionId(data.sessionId);
      if (data.readyToGenerate) setReadyToGenerate(true);
      if (data.profileUpdates) {
        setProfileInsights(prev => ({ ...prev, ...data.profileUpdates }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to get response');
      setMessages(updated); // keep user message, remove failed response
    } finally {
      setLoading(false);
    }
  }, [input, messages, sessionId, loading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Generate the hypnosis script
  const generateScript = async () => {
    setPhase('generating');
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
      } catch { /* music optional */ }

      setPhase('complete');
    } catch (err: any) {
      setError(err.message || 'Failed to generate script');
      setPhase('chat');
    }
  };

  const generateAudio = async () => {
    if (!savedScriptId) return;
    setGeneratingAudio(true);
    setError(null);
    try {
      await api.generateAudio(savedScriptId, selectedMusic || undefined, selectedMusic ? musicVolume : undefined);
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

  // ── Loading State ──
  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-gray-500 text-sm">Starting your session...</div>
      </div>
    );
  }

  // ── Generating State ──
  if (phase === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-6">
        <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <div className="text-gray-300 text-center">Creating your personalized hypnosis audio...</div>
        <div className="text-gray-500 text-sm mt-2 text-center">This takes about 15-30 seconds</div>
      </div>
    );
  }

  // ── Complete State (Script + Audio) ──
  if (phase === 'complete' && scriptResult) {
    return (
      <div className="flex flex-col h-full overflow-auto">
        <div className="px-4 py-4 sm:px-6 max-w-2xl mx-auto w-full">
          {/* Header */}
          <h1 className="text-xl sm:text-2xl font-bold mb-1">{scriptResult.title}</h1>
          {scriptResult.sessionSummary && (
            <p className="text-gray-400 text-sm mb-4">{scriptResult.sessionSummary}</p>
          )}

          {/* Tags */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="px-2.5 py-1 rounded-full text-xs bg-indigo-900/50 text-indigo-300">
              ~{scriptResult.estimatedMinutes} min
            </span>
            {scriptResult.keyThemes?.map((t, i) => (
              <span key={i} className="px-2 py-1 rounded-full text-xs bg-gray-800 text-gray-400">#{t}</span>
            ))}
          </div>

          {/* Audio Generation */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4">
            {!audioGenerated ? (
              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-200">Generate Your Audio</div>
                {musicTracks.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <select
                      value={selectedMusic}
                      onChange={e => setSelectedMusic(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100"
                    >
                      <option value="">No background music</option>
                      {musicTracks.map((t: any) => (
                        <option key={t.filename} value={t.filename}>{t.name}</option>
                      ))}
                    </select>
                    {selectedMusic && (
                      <label className="flex items-center gap-2 text-xs text-gray-400">
                        Volume
                        <input
                          type="range" min="0.05" max="0.4" step="0.05"
                          value={musicVolume}
                          onChange={e => setMusicVolume(parseFloat(e.target.value))}
                          className="flex-1 accent-purple-500"
                        />
                        {Math.round(musicVolume * 100)}%
                      </label>
                    )}
                  </div>
                )}
                <button
                  onClick={generateAudio}
                  disabled={generatingAudio}
                  className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl px-4 py-3 text-sm font-medium transition-colors"
                >
                  {generatingAudio ? 'Generating Audio...' : 'Generate Audio'}
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-emerald-400 text-sm font-medium mb-2">Audio generated successfully</div>
                <Link
                  to="/audios"
                  className="inline-block bg-emerald-600 hover:bg-emerald-500 rounded-xl px-6 py-2.5 text-sm font-medium transition-colors"
                >
                  Listen Now
                </Link>
              </div>
            )}
          </div>

          {/* Session Rating */}
          {!ratingSubmitted ? (
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4">
              <div className="text-sm text-gray-300 mb-2">How was this session?</div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setSessionRating(n)}
                    className={`text-2xl transition-all ${n <= sessionRating ? 'text-amber-400' : 'text-gray-700'}`}
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
          ) : (
            <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-xl px-4 py-2 text-sm text-emerald-400 mb-4">
              Thank you for your feedback!
            </div>
          )}

          {/* Session Insights */}
          {(profileInsights.detected_map || profileInsights.key_themes) && (
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-4">
              <div className="text-xs font-semibold text-gray-400 mb-2">Session Insights</div>
              <div className="flex gap-2 flex-wrap">
                {profileInsights.detected_map && (
                  <span className="text-xs px-2 py-1 rounded bg-indigo-900/30 text-indigo-300">
                    {profileInsights.detected_map === 'map1' ? 'Work / Adult' :
                     profileInsights.detected_map === 'map2' ? 'Social / Adolescent' :
                     profileInsights.detected_map === 'map3' ? 'Home / Childhood' : profileInsights.detected_map}
                  </span>
                )}
                {profileInsights.detected_state && (
                  <span className="text-xs px-2 py-1 rounded bg-emerald-900/30 text-emerald-300 capitalize">
                    {profileInsights.detected_state}
                  </span>
                )}
                {profileInsights.key_themes?.map((t, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400">#{t}</span>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-2 text-sm text-red-300 mb-4">
              {error}
            </div>
          )}

          <Link
            to="/"
            className="block text-center text-sm text-gray-500 hover:text-gray-300 py-3"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ── Chat State (Main Experience) ──
  const userMessageCount = messages.filter(m => m.role === 'user').length;

  return (
    <div className="flex flex-col h-[100dvh] md:h-full">
      {/* Minimal top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium truncate">Daily Check-in</span>
          {profileInsights.detected_state && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
              profileInsights.detected_state === 'capacity' ? 'bg-emerald-900/50 text-emerald-400' :
              profileInsights.detected_state === 'discharge' ? 'bg-red-900/50 text-red-400' :
              'bg-amber-900/50 text-amber-400'
            }`}>
              {profileInsights.detected_state}
            </span>
          )}
        </div>
        {(readyToGenerate || userMessageCount >= 4) && (
          <button
            onClick={generateScript}
            className={`text-xs font-medium rounded-lg px-3 py-1.5 transition-all shrink-0 ${
              readyToGenerate
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white animate-pulse'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {readyToGenerate ? 'Create Audio' : 'Create Audio'}
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 overscroll-contain"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-md'
                  : 'bg-gray-800 text-gray-100 rounded-bl-md'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error bar */}
      {error && (
        <div className="px-4 py-2 bg-red-900/30 border-t border-red-800 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Input area — fixed to bottom on mobile */}
      <div className="shrink-0 border-t border-gray-800 bg-gray-900/80 backdrop-blur-sm px-3 py-2 pb-[env(safe-area-inset-bottom,8px)]">
        <div className="flex items-end gap-2 max-w-2xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={loading}
            rows={1}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50 resize-none max-h-[120px] leading-snug"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl w-10 h-10 flex items-center justify-center transition-colors"
            aria-label="Send"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
