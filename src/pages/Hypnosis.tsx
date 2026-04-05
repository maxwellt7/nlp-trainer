import { useState, useEffect, useRef, useCallback } from 'react';
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
        <div key={`b${i}`} className="flex items-center gap-2 my-3">
          <span className="flex-1 gold-accent-line" />
          <span className="font-mono-brand text-[10px] shrink-0" style={{ color: 'var(--color-text-dim)' }}>{seconds}s</span>
          <span className="flex-1 gold-accent-line" />
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  }, [input]);

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
    if (navigator.vibrate) navigator.vibrate(20);
    sendMessage(input.trim());
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
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
      if (data.gamification) {
        const gam = data.gamification;
        if (gam.xpEvents && gam.xpEvents.length > 0) {
          setXpPopupData({ xpEvents: gam.xpEvents, levelUp: gam.levelUp });
          setShowXpPopup(true);
        }
        if (gam.mysteryBox) setMysteryBoxData(gam.mysteryBox);
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
        {showXpPopup && xpPopupData && (
          <XpPopup xpEvents={xpPopupData.xpEvents} levelUp={xpPopupData.levelUp} onDismiss={() => setShowXpPopup(false)} />
        )}

        <div className="mb-6">
          <p className="text-uppercase-spaced mb-2" style={{ color: 'var(--color-accent-gold)' }}>Session Complete</p>
          <h1 className="font-display text-2xl sm:text-3xl text-white mb-2">{scriptResult.title}</h1>
          {scriptResult.sessionSummary && (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{scriptResult.sessionSummary}</p>
          )}
        </div>

        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <span className="pill pill-active font-mono-brand text-xs">
            {scriptResult.duration === 'full' ? 'FULL' : 'SHORT'} &mdash; ~{scriptResult.estimatedMinutes}m
          </span>
          {scriptResult.keyThemes?.map((t, i) => (
            <span key={i} className="pill pill-inactive text-xs">#{t}</span>
          ))}
        </div>

        {mysteryBoxData && (
          <div className="mb-6">
            <h3 className="text-uppercase-spaced mb-2" style={{ color: 'var(--color-text-dim)' }}>Session Reward</h3>
            <MysteryBox box={mysteryBoxData} />
          </div>
        )}

        {(profileInsights.detected_map || profileInsights.detected_state) && (
          <div className="brand-card p-4 mb-6">
            <div className="text-uppercase-spaced mb-2" style={{ color: 'var(--color-text-dim)' }}>Intel Detected</div>
            <div className="flex gap-2 flex-wrap">
              {profileInsights.detected_map && (
                <span className="pill pill-inactive text-xs">
                  Map: {mapLabels[profileInsights.detected_map] || profileInsights.detected_map}
                </span>
              )}
              {profileInsights.detected_state && (
                <span className="text-xs px-3 py-1.5 rounded-full font-semibold"
                  style={{
                    background: profileInsights.detected_state === 'capacity' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                    color: profileInsights.detected_state === 'capacity' ? 'var(--color-status-success)' : 'var(--color-status-warning)',
                    border: `1px solid ${profileInsights.detected_state === 'capacity' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
                  }}>
                  State: {profileInsights.detected_state}
                </span>
              )}
              {profileInsights.force_pattern && (
                <span className="pill pill-inactive text-xs" style={{ color: 'var(--color-accent-gold)', borderColor: 'rgba(212,168,83,0.2)' }}>
                  Pattern: {profileInsights.force_pattern} force
                </span>
              )}
            </div>
          </div>
        )}

        <div className="brand-card p-5 sm:p-8 mb-6 text-sm sm:text-base leading-loose"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'Georgia, serif' }}>
          {renderScript(scriptResult.script)}
        </div>

        {error && (
          <div className="rounded-lg px-5 py-3 text-sm mb-4"
            style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--color-status-error)' }}>
            {error}
          </div>
        )}

        {!ratingSubmitted && (
          <div className="brand-card p-4 mb-6">
            <div className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>Rate this session</div>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => { setSessionRating(n); if (navigator.vibrate) navigator.vibrate(15); }}
                  className="text-2xl transition-all haptic-tap"
                  style={{ color: n <= sessionRating ? 'var(--color-accent-gold)' : 'var(--color-brand-border)' }}>
                  ★
                </button>
              ))}
              {sessionRating > 0 && (
                <button onClick={submitRating} className="ml-3 text-sm rounded-lg px-4 py-1.5 btn-primary">
                  Submit
                </button>
              )}
            </div>
          </div>
        )}
        {ratingSubmitted && (
          <div className="rounded-lg px-4 py-2 text-sm mb-6"
            style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)', color: 'var(--color-status-success)' }}>
            Rating recorded.
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          <button onClick={copyScript}
            className="rounded-lg px-5 py-2.5 font-semibold text-sm transition-colors haptic-tap"
            style={{
              background: copied ? 'var(--color-status-success)' : 'linear-gradient(135deg, var(--color-accent-blue-dim), var(--color-accent-blue))',
              color: 'white',
            }}>
            {copied ? 'Copied' : 'Copy Script'}
          </button>
          {savedScriptId && !audioGenerated && (
            <div className="flex items-center gap-3 flex-wrap">
              {musicTracks.length > 0 && (
                <>
                  <select value={selectedMusic} onChange={e => setSelectedMusic(e.target.value)}
                    className="brand-input text-sm rounded-lg">
                    <option value="">No music</option>
                    {musicTracks.map((t: any) => (
                      <option key={t.filename} value={t.filename}>{t.name}</option>
                    ))}
                  </select>
                  {selectedMusic && (
                    <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Vol
                      <input type="range" min="0.05" max="0.4" step="0.05" value={musicVolume}
                        onChange={e => setMusicVolume(parseFloat(e.target.value))}
                        className="w-20" style={{ accentColor: 'var(--color-accent-gold)' }} />
                      {Math.round(musicVolume * 100)}%
                    </label>
                  )}
                </>
              )}
              <button onClick={generateAudio} disabled={generatingAudio}
                className="rounded-lg px-5 py-2.5 font-semibold text-sm transition-colors haptic-tap disabled:opacity-50 btn-primary">
                {generatingAudio ? 'Generating...' : 'Generate Audio'}
              </button>
            </div>
          )}
          {audioGenerated && (
            <Link to="/audios"
              className="rounded-lg px-5 py-2.5 font-semibold text-sm inline-block"
              style={{ background: 'var(--color-status-success)', color: 'white' }}>
              View in Audio
            </Link>
          )}
          <button onClick={reset} className="rounded-lg px-5 py-2.5 font-semibold text-sm btn-ghost haptic-tap">
            New Session
          </button>
        </div>
      </div>
    );
  }

  // ── Coaching Chat ──
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{
          flexShrink: 0,
          background: 'var(--color-brand-deep)',
          borderBottom: '1px solid var(--color-brand-border)',
        }}>
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full animate-breathe-subtle" style={{ background: 'var(--color-accent-gold)' }} />
          <span className="text-sm font-semibold text-white">Session Active</span>
          {profileInsights.detected_map && (
            <span className="pill pill-inactive text-[10px] py-0.5 px-2">
              {mapLabels[profileInsights.detected_map] || profileInsights.detected_map}
            </span>
          )}
        </div>
        <button onClick={reset}
          className="rounded-md px-3 py-1 text-xs font-semibold transition-colors haptic-tap btn-ghost">
          Reset
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }} className="p-3 space-y-3">
        {initializing && (
          <div className="flex justify-start">
            <div className="rounded-xl rounded-tl-sm px-4 py-3 text-sm max-w-[85%]"
              style={{ background: 'var(--color-brand-card)', color: 'var(--color-text-muted)' }}>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'var(--color-accent-gold)', borderTopColor: 'transparent' }} />
                <span>Initializing session...</span>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
            <div
              className="max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed"
              style={{
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, var(--color-accent-gold-dim), rgba(212, 168, 83, 0.35))'
                  : 'var(--color-brand-card)',
                color: msg.role === 'user' ? 'var(--color-text-primary)' : 'var(--color-text-primary)',
                borderTopRightRadius: msg.role === 'user' ? '4px' : undefined,
                borderTopLeftRadius: msg.role === 'assistant' ? '4px' : undefined,
                border: msg.role === 'user' ? '1px solid rgba(212,168,83,0.2)' : '1px solid var(--color-brand-border)',
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
            <div className="rounded-xl rounded-tl-sm px-4 py-3 text-sm max-w-[85%]"
              style={{ background: 'var(--color-brand-card)', color: 'var(--color-text-muted)', border: '1px solid var(--color-brand-border)' }}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'var(--color-accent-gold)', borderTopColor: 'transparent' }} />
                <span>Processing...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Generate CTA */}
      {readyToGenerate && !generating && (
        <div className="px-4 py-3"
          style={{
            flexShrink: 0,
            background: 'linear-gradient(135deg, var(--color-brand-deep), rgba(160, 125, 58, 0.1))',
            borderTop: '1px solid var(--color-accent-gold-dim)',
          }}>
          <button onClick={generateScript}
            className="w-full rounded-xl px-6 py-3.5 font-bold text-base transition-all active:scale-[0.98] animate-breathe haptic-tap btn-primary">
            Create Audio
          </button>
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div className="px-4 py-3"
          style={{ flexShrink: 0, background: 'var(--color-brand-deep)', borderTop: '1px solid var(--color-brand-border)' }}>
          <div className="flex items-center justify-center gap-3" style={{ color: 'var(--color-text-secondary)' }}>
            <div className="w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: 'var(--color-accent-gold)', borderTopColor: 'transparent' }} />
            <span className="text-sm font-medium">Generating your personalized script...</span>
          </div>
        </div>
      )}

      {/* Input */}
      {!readyToGenerate && !generating && (
        <form onSubmit={handleSubmit}
          className="px-3 py-2.5 flex gap-2 items-end"
          style={{ flexShrink: 0, background: 'var(--color-brand-midnight)', borderTop: '1px solid var(--color-brand-border)' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={initializing ? 'Starting session...' : 'Type your message...'}
            disabled={loading || initializing}
            rows={1}
            className="brand-input flex-1 resize-none leading-relaxed"
            style={{ minHeight: '42px', maxHeight: '120px', borderRadius: 'var(--radius-button)' }}
          />
          <button type="submit"
            disabled={!input.trim() || loading || initializing}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors shrink-0 disabled:opacity-30 haptic-tap"
            style={{
              background: !input.trim() || loading || initializing
                ? 'var(--color-brand-card)'
                : 'linear-gradient(135deg, var(--color-accent-gold-dim), var(--color-accent-gold))',
              color: !input.trim() || loading || initializing ? 'var(--color-text-dim)' : 'var(--color-brand-midnight)',
              border: '1px solid var(--color-brand-border)',
            }}>
            Send
          </button>
        </form>
      )}

      {error && (
        <div className="px-4 py-2 text-sm"
          style={{
            flexShrink: 0,
            background: 'rgba(239, 68, 68, 0.08)',
            borderTop: '1px solid rgba(239, 68, 68, 0.2)',
            color: 'var(--color-status-error)',
          }}>
          {error}
        </div>
      )}
    </div>
  );
}
