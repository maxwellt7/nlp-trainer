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
  // Learn
  getModules: () => request<any>('/learn/modules'),
  getLesson: (lessonId: string) => request<any>(`/learn/lesson/${lessonId}`),
  generateQuiz: (lessonId: string) =>
    request<any>('/learn/quiz', { method: 'POST', body: JSON.stringify({ lessonId }) }),
  evaluateQuiz: (lessonId: string, questions: any[], userAnswers: any[]) =>
    request<any>('/learn/quiz/evaluate', {
      method: 'POST',
      body: JSON.stringify({ lessonId, questions, userAnswers }),
    }),

  // Practice
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

  // Hypnosis
  hypnosisChat: (messages: any[]) =>
    request<any>('/hypnosis/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }),
  hypnosisGenerate: (messages: any[]) =>
    request<any>('/hypnosis/generate', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }),

  // Audio / Scripts
  listScripts: () => request<any>('/audio/scripts'),
  saveScript: (script: { title: string; duration: string; estimatedMinutes: number; script: string }) =>
    request<any>('/audio/scripts', { method: 'POST', body: JSON.stringify(script) }),
  generateAudio: (scriptId: string) =>
    request<any>(`/audio/generate-audio/${scriptId}`, { method: 'POST' }),
  deleteScript: (scriptId: string) =>
    request<any>(`/audio/scripts/${scriptId}`, { method: 'DELETE' }),
  getAudioUrl: (filename: string) => `${BASE}/audio/audio/${filename}`,

  // Reference
  getReference: () => request<any>('/learn/reference'),
};
