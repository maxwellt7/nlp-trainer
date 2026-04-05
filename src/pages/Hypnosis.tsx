import { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import XpPopup from '../components/XpPopup';
import MysteryBox from '../components/MysteryBox';

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
  gamification?: any;
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
          <span className="flex-1 border-t" style={{ borderColor: 'var(--color-brand-border)' }} />
          <span className="text-[10px] shrink-0" style={{ color: 'var(--color-text-dim)' }}>{seconds}s</span>
          <span className="flex-1 border-t" style={{ borderColor: 'var(--color-brand-border)' }} />
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
  const [showXpPopup, setShowXpPopup] = useState(false);
  const [xpPopupData, setXpPopupData] = useState<any>(null);
  const [mysteryBoxData, setMysteryBoxData] = useState<any>(null);
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
          setMessages(data.resumeMessages);
          setSessionId(data.sessionId);
        } else if (data.reply) {
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
    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(20);
    sendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
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

      // Handle gamification results
      if (data.gamification) {
        const gam = data.gamification;
        if (gam.xpEvents && gam.xpEvents.length > 0) {
          setXpPopupData({
            xpEvents: gam.xpEvents,
            levelUp: gam.levelUp,
          });
          setShowXpPopup(true);
        }
        if (gam.mysteryBox) {
          setMysteryBoxData(gam.mysteryBox);
        }
      }

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
      if (navigator.vibrate) navigator.vibrate([30, 50, 100]);
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
    setShowXpPopup(false);
    setXpPopupData(null);
    setMysteryBoxData(null);
    setInitializing(true);
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
        {/* XP Popup */}
        {showXpPopup && xpPopupData && (
          <XpPopup
            xpEvents={xpPopupData.xpEvents}
            levelUp={xpPopupData.levelUp}
            onDismiss={() => setShowXpPopup(false)}
          />
        )}

        <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-white">{scriptResult.title}</h1>
        {scriptResult.sessionSummary && (
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>{scriptResult.sessionSummary}</p>
        )}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <span className="px-3 py-1 rounded-full text-sm"
            style={{
              background: scriptResult.duration === 'full' ? 'var(--color-accent-cyan-glow)' : 'rgba(52, 211, 153, 0.15)',
              color: scriptResult.duration === 'full' ? 'var(--color-accent-cyan)' : 'var(--color-status-success)',
            }}>
            {scriptResult.duration === 'full' ? 'Full Session' : 'Short Script'} &mdash; ~{scriptResult.estimatedMinutes} min
          </span>
          {scriptResult.keyThemes?.map((t, i) => (
            <span key={i} className="px-2 py-1 rounded-full text-xs"
              style={{ background: 'var(--color-brand-card)', color: 'var(--color-text-muted)' }}>#{t}</span>
          ))}
        </div>

        {/* Mystery Box Reward */}
        {mysteryBoxData && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Session Reward
            </h3>
            <MysteryBox box={mysteryBoxData} />
          </div>
        )}

        {(profileInsights.detected_map || profileInsights.detected_state) && (
          <div className="glass-card p-4 mb-6">
            <div className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>Session Insights</div>
            <div className="flex gap-3 flex-wrap">
              {profileInsights.detected_map && (
                <span className="text-xs px-2 py-1 rounded"
                  style={{ background: 'var(--color-accent-cyan-glow)', color: 'var(--color-accent-cyan)' }}>
                  Active Map: {mapLabels[profileInsights.detected_map] || profileInsights.detected_map}
                </span>
              )}
              {profileInsights.detected_state && (
                <span className="text-xs px-2 py-1 rounded"
                  style={{
                    background: profileInsights.detected_state === 'capacity' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                    color: profileInsights.detected_state === 'capacity' ? 'var(--color-status-success)' : 'var(--color-status-warning)',
                  }}>
                  State: {profileInsights.detected_state}
                </span>
              )}
              {profileInsights.force_pattern && (
                <span className="text-xs px-2 py-1 rounded"
                  style={{ background: 'var(--color-accent-gold-glow)', color: 'var(--color-accent-gold)' }}>
                  Pattern: {profileInsights.force_pattern} force
                </span>
              )}
            </div>
          </div>
        )}

        <div className="glass-card p-4 sm:p-8 mb-6 text-sm sm:text-base leading-loose font-serif"
          style={{ color: 'var(--color-text-primary)' }}>
          {renderScript(scriptResult.script)}
        </div>

        {error && (
          <div className="rounded-xl px-6 py-3 text-sm mb-4"
            style={{ background: 'rgba(248, 113, 113, 0.1)', border: '1px solid rgba(248, 113, 113, 0.3)', color: 'var(--color-status-error)' }}>
            {error}
          </div>
        )}

        {!ratingSubmitted && (
          <div className="glass-card p-4 mb-6">
            <div className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>How was this session?</div>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => { setSessionRating(n); if (navigator.vibrate) navigator.vibrate(15); }}
                  className="text-2xl transition-all"
                  style={{ color: n <= sessionRating ? 'var(--color-accent-gold)' : 'var(--color-brand-border)' }}>
                  ★
                </button>
              ))}
              {sessionRating > 0 && (
                <button onClick={submitRating}
                  className="ml-3 text-sm rounded-lg px-3 py-1 btn-primary">
                  Submit
                </button>
              )}
            </div>
          </div>
        )}
        {ratingSubmitted && (
          <div className="rounded-xl px-4 py-2 text-sm mb-6"
            style={{ background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)', color: 'var(--color-status-success)' }}>
            Thank you for your feedback!
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          <button onClick={copyScript}
            className="rounded-xl px-6 py-3 font-medium transition-colors haptic-tap"
            style={{
              background: copied ? 'var(--color-status-success)' : 'linear-gradient(135deg, var(--color-accent-cyan-dim), var(--color-accent-cyan))',
              color: 'white',
            }}>
            {copied ? 'Copied!' : 'Copy Script'}
          </button>
          {savedScriptId && !audioGenerated && (
            <div className="flex items-center gap-3 flex-wrap">
              {musicTracks.length > 0 && (
                <>
                  <select value={selectedMusic} onChange={e => setSelectedMusic(e.target.value)}
                    className="rounded-lg px-3 py-2 text-sm"
                    style={{ background: 'var(--color-brand-card)', border: '1px solid var(--color-brand-border)', color: 'var(--color-text-primary)' }}>
                    <option value="">No background music</option>
                    {musicTracks.map((t: any) => (
                      <option key={t.filename} value={t.filename}>{t.name}</option>
                    ))}
                  </select>
                  {selectedMusic && (
                    <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Vol
                      <input type="range" min="0.05" max="0.4" step="0.05" value={musicVolume}
                        onChange={e => setMusicVolume(parseFloat(e.target.value))}
                        className="w-20" style={{ accentColor: 'var(--color-accent-violet)' }} />
                      {Math.round(musicVolume * 100)}%
                    </label>
                  )}
                </>
              )}
              <button onClick={generateAudio} disabled={generatingAudio}
                className="rounded-xl px-6 py-3 font-medium transition-colors haptic-tap disabled:opacity-50"
                style={{
                  background: generatingAudio ? 'var(--color-brand-card)' : 'linear-gradient(135deg, var(--color-accent-violet-dim), var(--color-accent-violet))',
                  color: 'white',
                }}>
                {generatingAudio ? 'Generating Audio...' : 'Generate Audio'}
              </button>
            </div>
          )}
          {audioGenerated && (
            <Link to="/audios"
              className="rounded-xl px-6 py-3 font-medium transition-colors inline-block"
              style={{ background: 'var(--color-status-success)', color: 'white' }}>
              View in Audios
            </Link>
          )}
          <button onClick={reset}
            className="rounded-xl px-6 py-3 font-medium transition-colors haptic-tap"
            style={{ background: 'var(--color-brand-card)', color: 'var(--color-text-primary)', border: '1px solid var(--color-brand-border)' }}>
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
      <div className="flex items-center justify-between px-4 py-2 border-b"
        style={{ flexShrink: 0, background: 'var(--color-brand-deep)', borderColor: 'var(--color-brand-border)' }}>
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-white">Daily Coaching</span>
          {profileInsights.detected_map && (
            <span className="text-xs px-2 py-0.5 rounded"
              style={{ background: 'var(--color-accent-cyan-glow)', color: 'var(--color-accent-cyan)' }}>
              {mapLabels[profileInsights.detected_map] || profileInsights.detected_map}
            </span>
          )}
        </div>
        <button onClick={reset}
          className="rounded-lg px-3 py-1 text-xs font-medium transition-colors haptic-tap"
          style={{ background: 'var(--color-brand-card)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-brand-border)' }}>
          New
        </button>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }} className="p-3 space-y-3">
        {initializing && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm max-w-[85%]"
              style={{ background: 'var(--color-brand-card)', color: 'var(--color-text-muted)' }}>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'var(--color-accent-cyan)', borderTopColor: 'transparent' }} />
                <span>Starting your session...</span>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
              style={{
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, var(--color-accent-cyan-dim), rgba(34, 211, 238, 0.4))'
                  : 'var(--color-brand-card)',
                color: 'var(--color-text-primary)',
                borderTopRightRadius: msg.role === 'user' ? '4px' : undefined,
                borderTopLeftRadius: msg.role === 'assistant' ? '4px' : undefined,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm max-w-[85%]"
              style={{ background: 'var(--color-brand-card)', color: 'var(--color-text-muted)' }}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'var(--color-accent-cyan)', borderTopColor: 'transparent' }} />
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Create Audio CTA — appears when coaching is complete, with breathing animation */}
      {readyToGenerate && !generating && (
        <div className="px-4 py-3 border-t"
          style={{
            flexShrink: 0,
            background: 'linear-gradient(135deg, var(--color-brand-deep), rgba(14, 116, 144, 0.2))',
            borderColor: 'var(--color-accent-cyan-dim)',
          }}>
          <button onClick={generateScript}
            className="w-full rounded-xl px-6 py-3.5 font-semibold text-base transition-all active:scale-[0.98] animate-breathe haptic-tap"
            style={{
              background: 'linear-gradient(135deg, var(--color-accent-cyan-dim), var(--color-accent-cyan))',
              color: 'white',
            }}>
            Create Audio
          </button>
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div className="border-t px-4 py-3"
          style={{ flexShrink: 0, background: 'var(--color-brand-deep)', borderColor: 'var(--color-brand-border)' }}>
          <div className="flex items-center justify-center gap-3" style={{ color: 'var(--color-text-secondary)' }}>
            <div className="w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: 'var(--color-accent-cyan)', borderTopColor: 'transparent' }} />
            <span className="text-sm font-medium">Creating your personalized hypnosis script...</span>
          </div>
        </div>
      )}

      {/* Input area */}
      {!readyToGenerate && !generating && (
        <form onSubmit={handleSubmit}
          className="border-t px-3 py-2 flex gap-2 items-end"
          style={{ flexShrink: 0, background: 'var(--color-brand-midnight)', borderColor: 'var(--color-brand-border)' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={initializing ? 'Starting session...' : 'Type your message...'}
            disabled={loading || initializing}
            rows={1}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm placeholder-opacity-50 focus:outline-none disabled:opacity-50 resize-none leading-relaxed"
            style={{
              background: 'var(--color-brand-card)',
              border: '1px solid var(--color-brand-border)',
              color: 'var(--color-text-primary)',
              minHeight: '42px',
              maxHeight: '120px',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
            }}
          />
          <button type="submit"
            disabled={!input.trim() || loading || initializing}
            className="rounded-xl px-4 py-2.5 text-sm font-medium transition-colors shrink-0 disabled:opacity-30 haptic-tap"
            style={{
              background: !input.trim() || loading || initializing
                ? 'var(--color-brand-card)'
                : 'linear-gradient(135deg, var(--color-accent-cyan-dim), var(--color-accent-cyan))',
              color: 'white',
            }}>
            Send
          </button>
        </form>
      )}

      {error && (
        <div className="border-t px-4 py-2 text-sm"
          style={{
            flexShrink: 0,
            background: 'rgba(248, 113, 113, 0.1)',
            borderColor: 'rgba(248, 113, 113, 0.3)',
            color: 'var(--color-status-error)',
          }}>
          {error}
        </div>
      )}
    </div>
  );
}
