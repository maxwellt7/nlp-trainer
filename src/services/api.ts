const BASE = (import.meta.env.VITE_API_URL || '') + '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
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
  hypnosisChat: (messages: any[], sessionId?: string, moodBefore?: number) =>
    request<any>('/hypnosis/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, sessionId, moodBefore }),
    }),
  hypnosisGenerate: (messages: any[], sessionId?: string) =>
    request<any>('/hypnosis/generate', {
      method: 'POST',
      body: JSON.stringify({ messages, sessionId }),
    }),

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
  saveScript: (script: { title: string; duration: string; estimatedMinutes: number; script: string }) =>
    request<any>('/audio/scripts', { method: 'POST', body: JSON.stringify(script) }),
  generateAudio: (scriptId: string, musicTrack?: string, musicVolume?: number) =>
    request<any>(`/audio/generate-audio/${scriptId}`, {
      method: 'POST',
      body: JSON.stringify({ musicTrack, musicVolume }),
    }),
  listMusic: () => request<any>('/audio/music'),
  deleteScript: (scriptId: string) =>
    request<any>(`/audio/scripts/${scriptId}`, { method: 'DELETE' }),
  getAudioUrl: (filename: string) => `${BASE}/audio/audio/${filename}`,

  // ── Reference ──
  getReference: () => request<any>('/learn/reference'),
};
