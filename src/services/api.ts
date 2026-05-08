const BASE = (import.meta.env.VITE_API_URL || '') + '/api';

// Token getter function — set by the auth hook
let getToken: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(fn: (() => Promise<string | null>) | null) {
  getToken = fn;
}

function getBrowserTimezone(): string | null {
  if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') {
    return null;
  }

  const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return typeof resolved === 'string' && resolved.trim() ? resolved : null;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };

  const userTimezone = getBrowserTimezone();
  if (userTimezone) {
    headers['X-User-Timezone'] = userTimezone;
  }

  // Attach Clerk auth token if available
  if (getToken) {
    try {
      const token = await getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch {
      // No token available — continue without auth
    }
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // ── Profile & Session ──
  getProfile: () => request<any>('/profile'),
  updateProfile: (data: any) =>
    request<any>('/profile', { method: 'PUT', body: JSON.stringify(data) }),
  getSessions: (limit = 30, offset = 0) =>
    request<any>(`/profile/sessions?limit=${limit}&offset=${offset}`),
  getSession: (sessionId: string) =>
    request<any>(`/profile/sessions/${sessionId}`),
  rateSession: (sessionId: string, rating: number, feedback?: string) =>
    request<any>(`/profile/sessions/${sessionId}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating, feedback }),
    }),
  getStreak: () => request<any>('/profile/streak'),

  // ── Coaching & Hypnosis ──
  hypnosisInit: (options?: { sessionId?: string; sessionType?: string; forceNew?: boolean; title?: string }) =>
    request<any>('/hypnosis/init', { method: 'POST', body: JSON.stringify(options ?? {}) }),
  hypnosisChat: (messages: any[], sessionId?: string, moodBefore?: number, sessionType?: string, title?: string) =>
    request<any>('/hypnosis/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, sessionId, moodBefore, sessionType, title }),
    }),
  // POST starts an async generation job. Frontend polls hypnosisGenerateStatus
  // until status === 'complete' (or 'failed').
  hypnosisGenerateStart: (messages: any[], sessionId?: string) =>
    request<{ jobId: string; status: 'queued' | 'running' | 'complete' | 'failed' }>('/hypnosis/generate', {
      method: 'POST',
      body: JSON.stringify({ messages, sessionId }),
    }),
  hypnosisGenerateStatus: (jobId: string) =>
    request<{
      jobId: string;
      status: 'queued' | 'running' | 'complete' | 'failed';
      result?: any;
      error?: string;
    }>(`/hypnosis/generate-status/${encodeURIComponent(jobId)}`),
  // Recovery: "is there a generation already in flight for this session?"
  hypnosisGetActiveJob: (sessionId: string) =>
    request<{ jobId: string | null; status?: 'queued' | 'running' }>(
      `/hypnosis/generate-active/${encodeURIComponent(sessionId)}`,
    ),

  // ── Learn ──
  getModules: () => request<any>('/learn/modules'),
  getLesson: (lessonId: string) => request<any>(`/learn/lesson/${lessonId}`),
  generateQuiz: (lessonId: string) =>
    request<any>('/learn/quiz', { method: 'POST', body: JSON.stringify({ lessonId }) }),
  evaluateQuiz: (lessonId: string, questions: any[], userAnswers: any[]) =>
    request<any>('/learn/quiz/evaluate', {
      method: 'POST',
      body: JSON.stringify({ lessonId, questions, userAnswers }),
    }),

  // ── Practice ──
  sendMessage: (scenario: string, messages: any[], coached: boolean, scenarioSetup?: string) => {
    const conversationHistory = messages.slice(0, -1);
    const message = messages.length > 0 ? messages[messages.length - 1].content : '';
    return request<any>('/practice/chat', {
      method: 'POST',
      body: JSON.stringify({ scenario, message, conversationHistory, coached, customSetup: scenarioSetup }),
    });
  },
  getDebrief: (scenario: string, messages: any[]) =>
    request<any>('/practice/debrief', {
      method: 'POST',
      body: JSON.stringify({ scenario, conversationHistory: messages }),
    }),

  // ── Audio / Scripts ──
  listScripts: () => request<any>('/audio/scripts'),
  listVoices: () => request<any>('/audio/voices'),
  saveScript: (script: { title: string; duration: string; estimatedMinutes: number; script: string }) =>
    request<any>('/audio/scripts', { method: 'POST', body: JSON.stringify(script) }),
  // POST starts an async ElevenLabs render job. Returns 202 + jobId.
  // Use audioGenerateStatus to poll until status === 'complete'.
  audioGenerateStart: (scriptId: string, musicTrack?: string, musicVolume?: number, voiceId?: string) =>
    request<{ jobId: string; status: 'queued' | 'running' | 'complete' | 'failed' }>(
      `/audio/generate-audio/${scriptId}`,
      {
        method: 'POST',
        body: JSON.stringify({ musicTrack, musicVolume, voiceId }),
      },
    ),
  audioGenerateStatus: (jobId: string) =>
    request<{
      jobId: string;
      status: 'queued' | 'running' | 'complete' | 'failed';
      result?: any;
      error?: string;
    }>(`/audio/audio-status/${encodeURIComponent(jobId)}`),
  // Recovery: "is there an audio render in flight for this script?"
  audioGetActiveJob: (scriptId: string) =>
    request<{ jobId: string | null; status?: 'queued' | 'running' }>(
      `/audio/audio-active/${encodeURIComponent(scriptId)}`,
    ),
  listMusic: () => request<any>('/audio/music'),
  deleteScript: (scriptId: string) =>
    request<any>(`/audio/scripts/${scriptId}`, { method: 'DELETE' }),
  getAudioUrl: (filename: string) => `${BASE}/audio/audio/${filename}`,

  // ── Identity & Values ──
  getIdentity: () => request<any>('/identity'),
  getValueEvidence: (valueName: string) =>
    request<any>(`/identity/values/${encodeURIComponent(valueName)}/evidence`),

  // ── Reference ──
  getReference: () => request<any>('/learn/reference'),

  // ── Gamification ──
  getXp: () => request<any>('/gamification/xp'),
  getXpHistory: (limit = 20) => request<any>(`/gamification/xp/history?limit=${limit}`),
  getMysteryBoxes: (limit = 20) => request<any>(`/gamification/mystery-boxes?limit=${limit}`),
  getUnopenedBoxes: () => request<any>('/gamification/mystery-boxes/unopened'),
  openMysteryBox: (boxId: string) =>
    request<any>(`/gamification/mystery-boxes/${boxId}/open`, { method: 'POST' }),
  getAchievements: () => request<any>('/gamification/achievements'),
  getGamificationSummary: () => request<any>('/gamification/summary'),
};
