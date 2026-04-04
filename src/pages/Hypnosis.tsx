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
  const [state, setState] = useState<'coaching' | 'script'>('coaching');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
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
  const [profileInsights, setProfileInsights] = useState<ProfileUpdates>({});
  const [sessionRating, setSessionRating] = useState<number>(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initCalled = useRef(false);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // Auto-init: call /init on mount to get the AI's opening message
  useEffect(() => {
    if (initCalled.current) return;
    initCalled.current = true;

    async function initSession() {
      setInitializing(true);
      try {
        const data = await api.hypnosisInit();
        if (data.resumeMessages) {
          // Resume existing session
          setMessages(data.resumeMessages);
          setSessionId(data.sessionId);
        } else if (data.reply) {
          // New session with AI opening
          setMessages([{ role: 'assistant', content: data.reply }]);
          setSessionId(data.sessionId);
        }
      } catch (err: any) {
        setError('Could not start session. Please refresh.');
        console.error('Init error:', err);
      } finally {
        setInitializing(false);
      }
    }
    initSession();
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
        sessionId || undefined
      );
      setMessages([...updated, { role: 'assistant', content: data.reply }]);
      if (data.sessionId) setSessionId(data.sessionId);
      if (data.readyToGenerate) setReadyToGenerate(true);
      if (data.profileUpdates) {
        setProfileInsights(prev => ({ ...prev, ...data.profileUpdates }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to get response');
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  }, [messages, sessionId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || generating || readyToGenerate) return;
    sendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

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
        if (musicData.tracks?.length > 0) setSelectedMusic(musicData.tracks[0].filename);
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
    initCalled.current = false;
    setState('coaching');
    setMessages([]);
    setReadyToGenerate(false);
    setScriptResult(null);
    setError(null);
    setGenerating(false);
    setSavedScriptId(null);
    setGeneratingAudio(false);
    setAudioGenerated(false);
    setSessionId(null);
    setProfileInsights({});
    setSessionRating(0);
    setRatingSubmitted(false);
    setInput('');
    setInitializing(true);
    // Re-init
    setTimeout(async () => {
      try {
        const data = await api.hypnosisInit();
        if (data.resumeMessages) {
          setMessages(data.resumeMessages);
          setSessionId(data.sessionId);
        } else if (data.reply) {
          setMessages([{ role: 'assistant', content: data.reply }]);
          setSessionId(data.sessionId);
        }
      } catch { /* ignore */ }
      setInitializing(false);
    }, 100);
  };

  // ── Script Display ──
  if (state === 'script' && scriptResult) {
    return (
      <div className="p-4 sm:p-8 max-w-3xl mx-auto pb-24">
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

        {!ratingSubmitted && (
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-6">
            <div className="text-sm text-gray-300 mb-2">How was this session?</div>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setSessionRating(n)}
                  className={`text-2xl transition-all ${n <= sessionRating ? 'text-amber-400' : 'text-gray-700'}`}>
                  ★
                </button>
              ))}
              {sessionRating > 0 && (
                <button onClick={submitRating}
                  className="ml-3 text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg px-3 py-1 transition-colors">
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
          <button onClick={copyScript}
            className={`rounded-xl px-6 py-3 font-medium transition-colors ${
              copied ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}>
            {copied ? 'Copied!' : 'Copy Script'}
          </button>
          {savedScriptId && !audioGenerated && (
            <div className="flex items-center gap-3 flex-wrap">
              {musicTracks.length > 0 && (
                <>
                  <select value={selectedMusic} onChange={e => setSelectedMusic(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100">
                    <option value="">No background music</option>
                    {musicTracks.map((t: any) => (
                      <option key={t.filename} value={t.filename}>{t.name}</option>
                    ))}
                  </select>
                  {selectedMusic && (
                    <label className="flex items-center gap-2 text-xs text-gray-400">
                      Vol
                      <input type="range" min="0.05" max="0.4" step="0.05" value={musicVolume}
                        onChange={e => setMusicVolume(parseFloat(e.target.value))}
                        className="w-20 accent-purple-500" />
                      {Math.round(musicVolume * 100)}%
                    </label>
                  )}
                </>
              )}
              <button onClick={generateAudio} disabled={generatingAudio}
                className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl px-6 py-3 font-medium transition-colors">
                {generatingAudio ? 'Generating Audio...' : 'Generate Audio'}
              </button>
            </div>
          )}
          {audioGenerated && (
            <Link to="/audios"
              className="bg-emerald-600 hover:bg-emerald-500 rounded-xl px-6 py-3 font-medium transition-colors inline-block">
              View in Audios
            </Link>
          )}
          <button onClick={reset}
            className="bg-gray-800 hover:bg-gray-700 rounded-xl px-6 py-3 font-medium transition-colors">
            New Session
          </button>
        </div>
      </div>
    );
  }

  // ── Coaching Chat (main view — fills available space) ──
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Minimal header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900/80"
        style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">Daily Coaching</span>
          {profileInsights.detected_map && (
            <span className="text-xs bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded">
              {mapLabels[profileInsights.detected_map] || profileInsights.detected_map}
            </span>
          )}
        </div>
        <button onClick={reset}
          className="bg-gray-800 hover:bg-gray-700 rounded-lg px-3 py-1 text-xs font-medium transition-colors">
          New
        </button>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }} className="p-3 space-y-3">
        {initializing && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-400 max-w-[85%]">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                <span>Starting your session...</span>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-gray-800 text-gray-100 rounded-tl-sm'
              }`}
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-400 max-w-[85%]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Create Audio CTA — appears when coaching is complete */}
      {readyToGenerate && !generating && (
        <div className="border-t border-indigo-800 bg-gradient-to-r from-indigo-950 to-purple-950 px-4 py-3"
          style={{ flexShrink: 0 }}>
          <button onClick={generateScript}
            className="w-full bg-indigo-600 hover:bg-indigo-500 rounded-xl px-6 py-3.5 font-semibold text-base transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]">
            Create Audio
          </button>
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div className="border-t border-gray-800 bg-gray-900 px-4 py-3" style={{ flexShrink: 0 }}>
          <div className="flex items-center justify-center gap-3 text-gray-300">
            <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Creating your personalized hypnosis script...</span>
          </div>
        </div>
      )}

      {/* Input area */}
      {!readyToGenerate && !generating && (
        <form onSubmit={handleSubmit}
          className="border-t border-gray-800 px-3 py-2 flex gap-2 items-end bg-gray-950"
          style={{ flexShrink: 0 }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={initializing ? 'Starting session...' : 'Type your message...'}
            disabled={loading || initializing}
            rows={1}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50 resize-none leading-relaxed"
            style={{ minHeight: '42px', maxHeight: '120px', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
          />
          <button type="submit"
            disabled={!input.trim() || loading || initializing}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors shrink-0">
            Send
          </button>
        </form>
      )}

      {error && (
        <div className="bg-red-900/30 border-t border-red-800 px-4 py-2 text-sm text-red-300" style={{ flexShrink: 0 }}>
          {error}
        </div>
      )}
    </div>
  );
}
