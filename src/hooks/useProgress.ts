import { useState, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';

interface LessonProgress {
  completed: boolean;
  quizScore: number | null;
  completedAt: string | null;
}

interface PracticeProgress {
  sessionsCompleted: number;
  scenarios: Record<string, number>;
}

interface Progress {
  lessons: Record<string, LessonProgress>;
  practice: PracticeProgress;
  lastAccessed: string;
}

const defaultProgress: Progress = {
  lessons: {},
  practice: {
    sessionsCompleted: 0,
    scenarios: { sales: 0, coaching: 0, negotiation: 0, 'pattern-drill': 0, free: 0 },
  },
  lastAccessed: new Date().toISOString().split('T')[0],
};

function getStorageKey(userId: string | null): string {
  return userId ? `nlp-training-progress-${userId}` : 'nlp-training-progress';
}

function loadProgress(userId: string | null): Progress {
  try {
    const stored = localStorage.getItem(getStorageKey(userId));
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { ...defaultProgress };
}

function saveProgress(userId: string | null, progress: Progress): boolean {
  progress.lastAccessed = new Date().toISOString().split('T')[0];
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(progress));
    return true;
  } catch (e) {
    console.warn('localStorage full:', e);
    return false;
  }
}

export function useProgress() {
  const { user } = useUser();
  const userId = user?.id || null;
  const [progress, setProgress] = useState<Progress>(() => loadProgress(userId));

  const completeLesson = useCallback((lessonId: string, quizScore: number | null) => {
    setProgress(prev => {
      const updated = {
        ...prev,
        lessons: {
          ...prev.lessons,
          [lessonId]: {
            completed: true,
            quizScore,
            completedAt: new Date().toISOString().split('T')[0],
          },
        },
      };
      saveProgress(userId, updated);
      return updated;
    });
  }, [userId]);

  const recordPracticeSession = useCallback((scenario: string) => {
    setProgress(prev => {
      const updated = {
        ...prev,
        practice: {
          sessionsCompleted: prev.practice.sessionsCompleted + 1,
          scenarios: {
            ...prev.practice.scenarios,
            [scenario]: (prev.practice.scenarios[scenario] || 0) + 1,
          },
        },
      };
      saveProgress(userId, updated);
      return updated;
    });
  }, [userId]);

  const resetProgress = useCallback(() => {
    const fresh = { ...defaultProgress };
    saveProgress(userId, fresh);
    setProgress(fresh);
  }, [userId]);

  return { progress, completeLesson, recordPracticeSession, resetProgress };
}
