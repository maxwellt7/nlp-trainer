import { useState, useCallback } from 'react';

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

const STORAGE_KEY = 'nlp-training-progress';

const defaultProgress: Progress = {
  lessons: {},
  practice: {
    sessionsCompleted: 0,
    scenarios: { sales: 0, coaching: 0, negotiation: 0, 'pattern-drill': 0, free: 0 },
  },
  lastAccessed: new Date().toISOString().split('T')[0],
};

function loadProgress(): Progress {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { ...defaultProgress };
}

function saveProgress(progress: Progress): boolean {
  progress.lastAccessed = new Date().toISOString().split('T')[0];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch (e) {
    console.warn('localStorage full:', e);
    return false;
  }
}

export function useProgress() {
  const [progress, setProgress] = useState<Progress>(loadProgress);

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
      saveProgress(updated);
      return updated;
    });
  }, []);

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
      saveProgress(updated);
      return updated;
    });
  }, []);

  const resetProgress = useCallback(() => {
    const fresh = { ...defaultProgress };
    saveProgress(fresh);
    setProgress(fresh);
  }, []);

  return { progress, completeLesson, recordPracticeSession, resetProgress };
}
