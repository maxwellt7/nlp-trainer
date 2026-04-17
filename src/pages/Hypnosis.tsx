import { useState, useEffect, useRef, useCallback, useMemo, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import XpPopup from '../components/XpPopup';
import MysteryBox from '../components/MysteryBox';
import { resolveInitialHypnosisTarget } from './hypnosisLaunch';
import { canShowCreateHypnosisCTA, isSessionMarkedReady } from './hypnosisReadiness';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  eventType?: string;
  generatedAt?: string;
  sessionType?: string;
}

interface SessionSummary {
  id: string;
  session_type: 'daily_hypnosis' | 'general_chat';
  session_status?: string;
  title?: string;
  chat_summary?: string;
  key_themes?: string[];
  date_key?: string | null;
  last_message_at?: string | null;
  hypnosis_generated_at?: string | null;
  locked_at?: string | null;
  is_locked?: boolean;
  created_at?: string;
  user_rating?: number | null;
  chat_messages?: Message[] | string;
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

interface VoiceOption {
  id: string;
  key: string;
  label: string;
  description: string;
  isDefault: boolean;
}

const mapLabels: Record<string, string> = {
  map1: 'Work / Adult',
  map2: 'Social / Adolescent',
  map3: 'Home / Childhood',
};

function renderScript(script: string) {
  const parts = script.split(/<break\s+time="([\d.]+)s"\s*\/>/g);
  const elements: ReactNode[] = [];
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

function parseMessages(raw: unknown): Message[] {
  if (Array.isArray(raw)) return raw as Message[];
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeSession(session: any): SessionSummary | null {
  if (!session?.id) return null;
  return {
    ...session,
    key_themes: Array.isArray(session.key_themes) ? session.key_themes : [],
    is_locked: !!(session.is_locked || session.locked_at),
  };
}

function formatTitle(session: SessionSummary | null) {
  if (!session) return 'Conversation';
  if (session.title && session.title.trim()) return session.title.trim();
  if (session.session_type === 'daily_hypnosis') {
    const label = session.date_key || session.created_at || session.last_message_at;
    if (label) {
      return `Daily Session · ${new Date(label).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    }
    return 'Daily Session';
  }
  return 'Untitled Conversation';
}

function formatTimestamp(value?: string | null) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusPills(session: SessionSummary | null) {
  if (!session) return [] as string[];
  const pills = [session.session_type === 'daily_hypnosis' ? 'Daily' : 'Chat'];
  if (session.is_locked) {
    pills.push('Locked');
  } else if (session.hypnosis_generated_at) {
    pills.push('Hypnosis Generated');
  } else if (session.session_status === 'ready_for_hypnosis') {
    pills.push('Ready');
  } else {
    pills.push('Open');
  }
  return pills;
}

export default function Hypnosis() {
  const [conversations, setConversations] = useState<SessionSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionSummary | null>(null);
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
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [profileInsights, setProfileInsights] = useState<ProfileUpdates>({});
  const [sessionRating, setSessionRating] = useState<number>(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [input, setInput] = useState('');
  const [showXpPopup, setShowXpPopup] = useState(false);
  const [xpPopupData, setXpPopupData] = useState<any>(null);
  const [mysteryBoxData, setMysteryBoxData] = useState<any>(null);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const detailSectionRef = useRef<HTMLElement>(null);
  const nextConversationViewportActionRef = useRef<'top' | 'bottom' | null>(null);
  const initCalled = useRef(false);

  const hasConversationStarted = useMemo(
    () => messages.some((message) => message.role === 'user') || messages.filter((message) => message.role === 'assistant').length > 1,
    [messages],
  );

  const isSelectedLocked = !!selectedSession?.is_locked && selectedSession?.session_type === 'daily_hypnosis';
  const canCreateHypnosis = canShowCreateHypnosisCTA({
    readyToGenerate,
    messages,
    initializing,
    loading,
    generating,
    isSelectedLocked,
    minimumUserMessages: 3,
  });

  const resetScriptPanel = useCallback(() => {
    setReadyToGenerate(false);
    setScriptResult(null);
    setCopied(false);
    setSavedScriptId(null);
    setGeneratingAudio(false);
    setAudioGenerated(false);
    setMusicTracks([]);
    setSelectedMusic('');
    setMusicVolume(0.15);
    setVoices([]);
    setSelectedVoice('');
    setSessionRating(0);
    setRatingSubmitted(false);
    setShowXpPopup(false);
    setXpPopupData(null);
    setMysteryBoxData(null);
  }, []);

  const isMobileViewport = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 1023px)').matches;
  }, []);

  const revealConversationPanelOnMobile = useCallback(() => {
    if (!isMobileViewport()) return;

    setMobileHistoryOpen(false);

    const scrollIntoView = () => {
      detailSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    window.requestAnimationFrame(scrollIntoView);
    window.setTimeout(scrollIntoView, 180);
  }, [isMobileViewport]);

  const refreshConversations = useCallback(async (preferredId?: string) => {
    const data = await api.getSessions(50);
    const nextConversations = (data.sessions || []).map((session: any) => normalizeSession(session)).filter(Boolean) as SessionSummary[];
    setConversations(nextConversations);

    if (preferredId) {
      const preferred = nextConversations.find((session) => session.id === preferredId);
      if (preferred) {
        setSelectedSession((current) => (current && current.id === preferred.id ? { ...current, ...preferred } : current));
      }
    }

    return nextConversations;
  }, []);

  const applyConversationState = useCallback((session: SessionSummary | null, nextMessages: Message[]) => {
    setSelectedSession(session);
    setSelectedConversationId(session?.id || null);
    setMessages(nextMessages);
    setReadyToGenerate(isSessionMarkedReady(session?.session_status) && !(session?.is_locked && session?.session_type === 'daily_hypnosis'));
    setInput('');
    setError(null);
    setProfileInsights({});
    setRatingSubmitted(Boolean(session?.user_rating));
    setSessionRating(session?.user_rating || 0);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, []);

  const loadConversation = useCallback(async (conversationId: string, options?: { revealOnMobile?: boolean }) => {
    setInitializing(true);
    setError(null);
    resetScriptPanel();
    try {
      const detailRaw = await api.getSession(conversationId);
      const detail = normalizeSession(detailRaw);
      if (!detail) throw new Error('Conversation not found');

      let detailMessages = parseMessages(detailRaw.chat_messages);
      if (detailMessages.length === 0 && !detail.is_locked) {
        const initData = await api.hypnosisInit({ sessionId: conversationId, sessionType: detail.session_type });
        detailMessages = initData.resumeMessages || (initData.reply ? [{ role: 'assistant', content: initData.reply }] : []);
      }

      if (options?.revealOnMobile && isMobileViewport()) {
        nextConversationViewportActionRef.current = 'top';
        setMobileHistoryOpen(false);
      }

      applyConversationState(detail, detailMessages);
      if (options?.revealOnMobile) {
        revealConversationPanelOnMobile();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load conversation');
    } finally {
      setInitializing(false);
    }
  }, [applyConversationState, isMobileViewport, resetScriptPanel, revealConversationPanelOnMobile]);

  const startConversation = useCallback(async (sessionType: 'daily_hypnosis' | 'general_chat', options?: { revealOnMobile?: boolean }) => {
    setInitializing(true);
    setError(null);
    resetScriptPanel();
    if (options?.revealOnMobile && isMobileViewport()) {
      setMobileHistoryOpen(false);
    }
    try {
      const initData = await api.hypnosisInit({
        sessionType,
        forceNew: sessionType === 'general_chat',
      });
      const refreshed = await refreshConversations(initData.sessionId);
      const preferredId = initData.sessionId || refreshed[0]?.id;
      if (preferredId) {
        await loadConversation(preferredId, options);
      } else {
        setInitializing(false);
      }
    } catch (err: any) {
      setError(err.message || 'Could not start conversation');
      setInitializing(false);
    }
  }, [loadConversation, refreshConversations, resetScriptPanel]);

  useEffect(() => {
    if (initCalled.current) return;
    initCalled.current = true;

    async function bootstrap() {
      setInitializing(true);
      try {
        const launchSearch = window.location.search;
        const launchParams = new URLSearchParams(launchSearch);
        const existing = await refreshConversations();
        const initialTarget = resolveInitialHypnosisTarget(launchSearch, existing);
        const revealFromLaunchIntent = launchParams.has('mode') || launchParams.has('sessionId');

        if (initialTarget.action === 'load') {
          await loadConversation(initialTarget.sessionId, { revealOnMobile: revealFromLaunchIntent });
          return;
        }

        await startConversation(initialTarget.sessionType, { revealOnMobile: revealFromLaunchIntent });
      } catch (err: any) {
        setError(err.message || 'Could not load conversations. Please refresh.');
        setInitializing(false);
      }
    }

    bootstrap();
  }, [loadConversation, refreshConversations, startConversation]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const syncDesktopMode = () => {
      if (window.matchMedia('(min-width: 1024px)').matches) {
        setMobileHistoryOpen(false);
      }
    };

    syncDesktopMode();
    window.addEventListener('resize', syncDesktopMode);
    return () => window.removeEventListener('resize', syncDesktopMode);
  }, []);

  useEffect(() => {
    if (!hasConversationStarted && !loading) {
      messagesRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      nextConversationViewportActionRef.current = null;
      return;
    }

    if (nextConversationViewportActionRef.current === 'top') {
      messagesRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      nextConversationViewportActionRef.current = null;
      return;
    }

    nextConversationViewportActionRef.current = null;
    bottomRef.current?.scrollIntoView({
      behavior: loading ? 'smooth' : 'auto',
      block: 'end',
    });
  }, [hasConversationStarted, loading, messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  }, [input]);

  const sendMessage = useCallback(async (content: string) => {
    if (!selectedSession) {
      setError('Start a conversation first.');
      return;
    }

    const userMsg: Message = { role: 'user', content };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);
    setError(null);
    setReadyToGenerate(false);

    try {
      const data = await api.hypnosisChat(
        updatedMessages.map((message) => ({ role: message.role, content: message.content })),
        selectedSession.id,
        undefined,
        selectedSession.session_type,
        selectedSession.title,
      );

      const nextMessages = [...updatedMessages, { role: 'assistant', content: data.reply } as Message];
      setMessages(nextMessages);
      if (data.session) {
        const normalized = normalizeSession(data.session);
        if (normalized) setSelectedSession((current) => ({ ...(current || {}), ...normalized } as SessionSummary));
      }
      setReadyToGenerate((data.readyToGenerate === true || isSessionMarkedReady(data.session?.session_status)) && !isSelectedLocked);
      if (data.profileUpdates) {
        setProfileInsights((prev) => ({ ...prev, ...data.profileUpdates }));
      }
      await refreshConversations(selectedSession.id);
    } catch (err: any) {
      setError(err.message || 'Failed to get response');
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  }, [isSelectedLocked, messages, refreshConversations, selectedSession]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || generating || isSelectedLocked) return;
    if (navigator.vibrate) navigator.vibrate(20);
    sendMessage(input.trim());
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const generateScript = async () => {
    if (!selectedSession) return;

    setGenerating(true);
    setError(null);
    try {
      const apiMessages = messages.map((message) => ({ role: message.role, content: message.content }));
      const data = await api.hypnosisGenerate(apiMessages, selectedSession.id);
      setScriptResult(data);
      if (data.hypnosisEvent) {
        setMessages((current) => {
          const alreadyAdded = current.some(
            (message) => message.role === 'system' && message.generatedAt === data.hypnosisEvent.generatedAt,
          );
          if (alreadyAdded) return current;
          return [...current, data.hypnosisEvent];
        });
      }

      if (data.session) {
        const normalized = normalizeSession(data.session);
        if (normalized) setSelectedSession((current) => ({ ...(current || {}), ...normalized } as SessionSummary));
      }

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
        setSelectedMusic('');
      } catch {
        setMusicTracks([]);
      }

      try {
        const voiceData = await api.listVoices();
        const availableVoices = voiceData.voices || [];
        setVoices(availableVoices);
        const defaultVoice = availableVoices.find((voice: VoiceOption) => voice.isDefault);
        setSelectedVoice(defaultVoice?.id || availableVoices[0]?.id || '');
      } catch {
        setVoices([]);
      }

      if (data.gamification) {
        const gam = data.gamification;
        if (gam.xpEvents && gam.xpEvents.length > 0) {
          setXpPopupData({ xpEvents: gam.xpEvents, levelUp: gam.levelUp });
          setShowXpPopup(true);
        }
        if (gam.mysteryBox) setMysteryBoxData(gam.mysteryBox);
      }

      await refreshConversations(selectedSession.id);
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
        selectedMusic ? musicVolume : undefined,
        selectedVoice || undefined,
      );
      setAudioGenerated(true);
      if (navigator.vibrate) navigator.vibrate([30, 50, 100]);
    } catch (err: any) {
      setError(err.message || 'Failed to generate audio');
    } finally {
      setGeneratingAudio(false);
    }
  };

  const submitRating = async () => {
    if (!selectedConversationId || sessionRating === 0) return;
    try {
      await api.rateSession(selectedConversationId, sessionRating);
      setRatingSubmitted(true);
      await refreshConversations(selectedConversationId);
    } catch {
      // Rating is optional and non-critical.
    }
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

  const handleInputFocus = () => {
    if (hasConversationStarted) return;

    const keepIntroVisible = () => {
      messagesRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    };

    window.requestAnimationFrame(keepIntroVisible);
    window.setTimeout(keepIntroVisible, 120);
  };

  return (
    <div className="relative flex h-[100dvh] max-h-[100dvh] min-h-0 overflow-hidden lg:h-full lg:max-h-none" style={{ background: 'var(--color-brand-midnight)' }}>
      {showXpPopup && xpPopupData && (
        <XpPopup xpEvents={xpPopupData.xpEvents} levelUp={xpPopupData.levelUp} onDismiss={() => setShowXpPopup(false)} />
      )}

      {mobileHistoryOpen && (
        <button
          type="button"
          aria-label="Close conversation history"
          onClick={() => setMobileHistoryOpen(false)}
          className="lg:hidden absolute inset-0 z-20 bg-black/60 backdrop-blur-sm"
        />
      )}

      <aside
        className={`absolute inset-y-0 left-0 z-30 w-full max-w-[24rem] border-r flex flex-col transform transition-transform duration-200 ease-in-out lg:static lg:z-auto lg:w-[19rem] xl:w-[21rem] ${mobileHistoryOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ borderColor: 'var(--color-brand-border)', background: 'rgba(7, 11, 20, 0.96)' }}
      >
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-brand-border)' }}>
          <div>
            <p className="text-uppercase-spaced" style={{ color: 'var(--color-accent-gold)' }}>History</p>
            <p className="text-sm text-white font-semibold">Conversation Sidebar</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileHistoryOpen(false)}
            className="rounded-lg px-3 py-2 text-xs font-semibold haptic-tap btn-ghost"
          >
            Close
          </button>
        </div>

        <div className="p-4 border-b" style={{ borderColor: 'var(--color-brand-border)' }}>
          <p className="text-uppercase-spaced mb-2" style={{ color: 'var(--color-accent-gold)' }}>Conversations</p>
          <h1 className="font-display text-2xl text-white mb-3">Alignment Workspace</h1>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => startConversation('general_chat', { revealOnMobile: true })}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold haptic-tap btn-primary"
            >
              New Chat
            </button>
            <button
              onClick={() => startConversation('daily_hypnosis', { revealOnMobile: true })}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold haptic-tap btn-ghost"
            >
              Daily Session
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2">
          {conversations.length === 0 && !initializing && (
            <div className="brand-card p-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Start a chat or open your daily session to begin building personalized momentum.
            </div>
          )}

          {conversations.map((conversation) => {
            const active = conversation.id === selectedConversationId;
            return (
              <button
                key={conversation.id}
                onClick={() => loadConversation(conversation.id, { revealOnMobile: true })}
                className="w-full text-left rounded-2xl p-3 transition-all haptic-tap"
                style={{
                  background: active ? 'rgba(212, 168, 83, 0.12)' : 'var(--color-brand-card)',
                  border: active ? '1px solid rgba(212, 168, 83, 0.35)' : '1px solid var(--color-brand-border)',
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="text-sm font-semibold text-white leading-tight">{formatTitle(conversation)}</div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--color-text-dim)' }}>
                      {formatTimestamp(conversation.last_message_at || conversation.created_at || conversation.hypnosis_generated_at)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {statusPills(conversation).map((pill) => (
                    <span key={pill} className="pill pill-inactive text-[10px] px-2 py-1">{pill}</span>
                  ))}
                </div>
                <div className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  {conversation.chat_summary?.trim() || (conversation.session_type === 'daily_hypnosis' ? 'Daily hypnosis thread ready to resume.' : 'Open-ended coaching conversation.')}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section ref={detailSectionRef} className="flex-1 min-h-0 min-w-0 flex flex-col">
        <div
          className="px-3 sm:px-6 py-3 sm:py-4 border-b flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: 'var(--color-brand-border)', background: 'var(--color-brand-deep)' }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0 mb-1">
              <button
                type="button"
                onClick={() => setMobileHistoryOpen(true)}
                className="lg:hidden rounded-lg px-3 py-1.5 text-xs font-semibold haptic-tap btn-ghost shrink-0"
              >
                History
              </button>
              <div className="w-2 h-2 rounded-full shrink-0 animate-breathe-subtle" style={{ background: 'var(--color-accent-gold)' }} />
              <span className="min-w-0 truncate text-sm sm:text-base font-semibold text-white">{formatTitle(selectedSession)}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 flex-wrap mb-1">
              {statusPills(selectedSession).map((pill) => (
                <span key={pill} className="pill pill-inactive text-[10px] px-2 py-1">{pill}</span>
              ))}
            </div>
            <div className="text-[11px] sm:text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              {selectedSession?.hypnosis_generated_at
                ? `Hypnosis generated ${formatTimestamp(selectedSession.hypnosis_generated_at)}`
                : selectedSession?.session_type === 'daily_hypnosis'
                  ? 'Daily hypnosis sessions lock after generation.'
                  : 'General chats stay open, even after hypnosis is generated.'}
            </div>
          </div>

          {profileInsights.detected_map && (
            <span className="hidden sm:inline-flex pill pill-inactive text-[10px] py-1 px-2 self-start sm:self-auto">
              {mapLabels[profileInsights.detected_map] || profileInsights.detected_map}
            </span>
          )}
        </div>

        <div ref={messagesRef} className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 space-y-3">
          {initializing && (
            <div className="flex justify-start">
              <div
                className="rounded-xl rounded-tl-sm px-4 py-3 text-sm max-w-[85%]"
                style={{ background: 'var(--color-brand-card)', color: 'var(--color-text-muted)' }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'var(--color-accent-gold)', borderTopColor: 'transparent' }}
                  />
                  <span>Loading conversation...</span>
                </div>
              </div>
            </div>
          )}

          {!initializing && messages.length === 0 && (
            <div className="brand-card p-5 max-w-2xl text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Start talking normally. You can keep this as a conversation, or create hypnosis later when you want.
            </div>
          )}

          {messages.map((msg, index) => {
            if (msg.role === 'system' && msg.eventType === 'hypnosis_generated') {
              return (
                <div key={`${msg.generatedAt || 'event'}-${index}`} className="flex justify-center animate-slide-up">
                  <div
                    className="max-w-xl rounded-2xl px-4 py-3 text-center text-sm"
                    style={{
                      background: 'rgba(212, 168, 83, 0.12)',
                      border: '1px solid rgba(212, 168, 83, 0.25)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    <div className="text-uppercase-spaced mb-1" style={{ color: 'var(--color-accent-gold)' }}>Hypnosis Generated</div>
                    <div>{msg.content}</div>
                    {msg.generatedAt && (
                      <div className="text-[11px] mt-2" style={{ color: 'var(--color-text-dim)' }}>
                        {formatTimestamp(msg.generatedAt)}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div key={`${msg.role}-${index}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                <div
                  className="max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed"
                  style={{
                    background: msg.role === 'user'
                      ? 'linear-gradient(135deg, var(--color-accent-gold-dim), rgba(212, 168, 83, 0.35))'
                      : 'var(--color-brand-card)',
                    color: 'var(--color-text-primary)',
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
            );
          })}

          {loading && (
            <div className="flex justify-start">
              <div
                className="rounded-xl rounded-tl-sm px-4 py-3 text-sm max-w-[85%]"
                style={{ background: 'var(--color-brand-card)', color: 'var(--color-text-muted)', border: '1px solid var(--color-brand-border)' }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-accent-gold)', borderTopColor: 'transparent' }} />
                  <span>Processing...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {isSelectedLocked && (
          <div className="px-4 sm:px-5 py-3 text-sm" style={{ background: 'rgba(245, 158, 11, 0.08)', borderTop: '1px solid rgba(245, 158, 11, 0.2)', color: 'var(--color-status-warning)' }}>
            This daily session is locked because hypnosis has already been generated. You can review it here, or start a new chat from the sidebar.
          </div>
        )}

        {canCreateHypnosis && (
          <div
            className="px-4 sm:px-5 py-3"
            style={{ background: 'linear-gradient(135deg, var(--color-brand-deep), rgba(160, 125, 58, 0.1))', borderTop: '1px solid var(--color-accent-gold-dim)' }}
          >
            <button
              onClick={generateScript}
              className="w-full rounded-xl px-6 py-3.5 font-bold text-base transition-all active:scale-[0.98] animate-breathe haptic-tap btn-primary"
            >
              {selectedSession?.hypnosis_generated_at ? 'Create Updated Hypnosis' : 'Create Hypnosis'}
            </button>
          </div>
        )}

        {generating && (
          <div className="px-4 sm:px-5 py-3" style={{ background: 'var(--color-brand-deep)', borderTop: '1px solid var(--color-brand-border)' }}>
            <div className="flex items-center justify-center gap-3" style={{ color: 'var(--color-text-secondary)' }}>
              <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-accent-gold)', borderTopColor: 'transparent' }} />
              <span className="text-sm font-medium">Generating your personalized script...</span>
            </div>
          </div>
        )}

        {!isSelectedLocked && !generating && (
          <form
            onSubmit={handleSubmit}
            className="px-3 sm:px-5 py-2.5 sm:py-3 flex gap-2 items-end"
            style={{
              background: 'var(--color-brand-midnight)',
              borderTop: '1px solid var(--color-brand-border)',
              paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))',
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onFocus={handleInputFocus}
              onChange={(e) => setInput(e.target.value)}
              placeholder={initializing ? 'Loading conversation...' : 'Type your message...'}
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
              }}
            >
              Send
            </button>
          </form>
        )}

        {error && (
          <div className="px-4 sm:px-5 py-2 text-sm" style={{ background: 'rgba(239, 68, 68, 0.08)', borderTop: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--color-status-error)' }}>
            {error}
          </div>
        )}

        {scriptResult && (
          <div className="border-t px-4 sm:px-6 py-5 space-y-5" style={{ borderColor: 'var(--color-brand-border)', background: 'rgba(7, 11, 20, 0.82)' }}>
            <div>
              <p className="text-uppercase-spaced mb-2" style={{ color: 'var(--color-accent-gold)' }}>Hypnosis Output</p>
              <h2 className="font-display text-2xl text-white mb-2">{scriptResult.title}</h2>
              {scriptResult.sessionSummary && (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{scriptResult.sessionSummary}</p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="pill pill-active font-mono-brand text-xs">
                {scriptResult.duration === 'full' ? 'FULL' : 'SHORT'} &mdash; ~{scriptResult.estimatedMinutes}m
              </span>
              {scriptResult.keyThemes?.map((theme, index) => (
                <span key={`${theme}-${index}`} className="pill pill-inactive text-xs">#{theme}</span>
              ))}
            </div>

            {mysteryBoxData && (
              <div>
                <h3 className="text-uppercase-spaced mb-2" style={{ color: 'var(--color-text-dim)' }}>Session Reward</h3>
                <MysteryBox box={mysteryBoxData} />
              </div>
            )}

            {(profileInsights.detected_map || profileInsights.detected_state) && (
              <div className="brand-card p-4">
                <div className="text-uppercase-spaced mb-2" style={{ color: 'var(--color-text-dim)' }}>Intel Detected</div>
                <div className="flex gap-2 flex-wrap">
                  {profileInsights.detected_map && (
                    <span className="pill pill-inactive text-xs">
                      Map: {mapLabels[profileInsights.detected_map] || profileInsights.detected_map}
                    </span>
                  )}
                  {profileInsights.detected_state && (
                    <span
                      className="text-xs px-3 py-1.5 rounded-full font-semibold"
                      style={{
                        background: profileInsights.detected_state === 'capacity' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                        color: profileInsights.detected_state === 'capacity' ? 'var(--color-status-success)' : 'var(--color-status-warning)',
                        border: `1px solid ${profileInsights.detected_state === 'capacity' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
                      }}
                    >
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

            <div className="brand-card p-5 sm:p-8 text-sm sm:text-base leading-loose" style={{ color: 'var(--color-text-primary)', fontFamily: 'Georgia, serif' }}>
              {renderScript(scriptResult.script)}
            </div>

            {!ratingSubmitted && (
              <div className="brand-card p-4">
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>Rate this session</div>
                <div className="flex items-center gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      onClick={() => {
                        setSessionRating(value);
                        if (navigator.vibrate) navigator.vibrate(15);
                      }}
                      className="text-2xl transition-all haptic-tap"
                      style={{ color: value <= sessionRating ? 'var(--color-accent-gold)' : 'var(--color-brand-border)' }}
                    >
                      ★
                    </button>
                  ))}
                  {sessionRating > 0 && (
                    <button onClick={submitRating} className="ml-1 text-sm rounded-lg px-4 py-1.5 btn-primary">
                      Submit
                    </button>
                  )}
                </div>
              </div>
            )}

            {ratingSubmitted && (
              <div className="rounded-lg px-4 py-2 text-sm" style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)', color: 'var(--color-status-success)' }}>
                Rating recorded.
              </div>
            )}

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={copyScript}
                className="rounded-lg px-5 py-2.5 font-semibold text-sm transition-colors haptic-tap"
                style={{ background: copied ? 'var(--color-status-success)' : 'linear-gradient(135deg, var(--color-accent-blue-dim), var(--color-accent-blue))', color: 'white' }}
              >
                {copied ? 'Copied' : 'Copy Script'}
              </button>

              {savedScriptId && !audioGenerated && (
                <div className="flex items-center gap-3 flex-wrap">
                  {voices.length > 0 && (
                    <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Voice
                      <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} className="brand-input text-sm rounded-lg min-w-[11rem]">
                        {voices.map((voice) => (
                          <option key={voice.id} value={voice.id}>{voice.label}</option>
                        ))}
                      </select>
                    </label>
                  )}

                  {musicTracks.length > 0 && (
                    <>
                      <select value={selectedMusic} onChange={(e) => setSelectedMusic(e.target.value)} className="brand-input text-sm rounded-lg">
                        <option value="">No music</option>
                        {musicTracks.map((track: any) => (
                          <option key={track.filename} value={track.filename}>{track.name}</option>
                        ))}
                      </select>
                      {selectedMusic && (
                        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          Vol
                          <input
                            type="range"
                            min="0.05"
                            max="0.4"
                            step="0.05"
                            value={musicVolume}
                            onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                            className="w-20"
                            style={{ accentColor: 'var(--color-accent-gold)' }}
                          />
                          {Math.round(musicVolume * 100)}%
                        </label>
                      )}
                    </>
                  )}

                  <button
                    onClick={generateAudio}
                    disabled={generatingAudio}
                    className="rounded-lg px-5 py-2.5 font-semibold text-sm transition-colors haptic-tap disabled:opacity-50 btn-primary"
                  >
                    {generatingAudio ? 'Generating...' : 'Generate Audio'}
                  </button>
                </div>
              )}

              {audioGenerated && (
                <Link to="/audios" className="rounded-lg px-5 py-2.5 font-semibold text-sm inline-block" style={{ background: 'var(--color-status-success)', color: 'white' }}>
                  View in Audio
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
