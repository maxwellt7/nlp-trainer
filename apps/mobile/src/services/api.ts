import { getCalendars } from 'expo-localization';
import { env } from '../config/env';

const BASE = `${env.apiUrl.replace(/\/$/, '')}/api`;

let getToken: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(fn: (() => Promise<string | null>) | null) {
  getToken = fn;
}

function getDeviceTimezone(): string | null {
  try {
    const calendars = getCalendars();
    if (!calendars || calendars.length === 0) {
      return null;
    }
    return calendars[0]?.timeZone ?? null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (!env.apiUrl) {
    throw new Error('Missing EXPO_PUBLIC_API_URL');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  };

  const timezone = getDeviceTimezone();
  if (timezone) {
    headers['X-User-Timezone'] = timezone;
  }

  if (getToken) {
    try {
      const token = await getToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Continue unauthenticated on token errors.
    }
  }

  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(payload.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  getProfile: () => request<any>('/profile'),
  getGamificationSummary: () => request<any>('/gamification/summary'),
  getModules: () => request<any>('/learn/modules'),
  getReference: () => request<any>('/learn/reference'),
  listScripts: () => request<any>('/audio/scripts'),
  getSessions: (limit = 30, offset = 0) =>
    request<any>(`/profile/sessions?limit=${limit}&offset=${offset}`),
  getIdentity: () => request<any>('/identity'),
  getAudioUrl: (filename: string) => `${BASE}/audio/audio/${filename}`,
  hypnosisInit: (options?: { sessionId?: string; sessionType?: string; forceNew?: boolean; title?: string }) =>
    request<any>('/hypnosis/init', { method: 'POST', body: JSON.stringify(options ?? {}) }),
  hypnosisChat: (messages: any[], sessionId?: string, moodBefore?: number, sessionType?: string, title?: string) =>
    request<any>('/hypnosis/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, sessionId, moodBefore, sessionType, title }),
    }),
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
  audioGenerateStatus: (jobId: string) =>
    request<{
      jobId: string;
      status: 'queued' | 'running' | 'complete' | 'failed';
      result?: any;
      error?: string;
    }>(`/audio/audio-status/${encodeURIComponent(jobId)}`),
};
