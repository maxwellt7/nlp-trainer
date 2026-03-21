import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useProgress } from '../hooks/useProgress';

export default function Dashboard() {
  const { progress } = useProgress();
  const [modules, setModules] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getModules()
      .then(setModules)
      .catch(err => setError(err.message || 'Failed to load modules'))
      .finally(() => setLoading(false));
  }, []);

  const totalLessons = modules?.modules?.reduce((sum: number, m: any) => sum + m.lessons.length, 0) || 0;
  const completedLessons = Object.values(progress.lessons).filter((l: any) => l.completed).length;

  const quizScores = Object.values(progress.lessons)
    .map((l: any) => l.quizScore)
    .filter((s: any): s is number => s !== null);
  const avgQuiz = quizScores.length > 0
    ? Math.round(quizScores.reduce((a: number, b: number) => a + b, 0) / quizScores.length)
    : 0;

  let suggestion = { text: 'Start your first lesson', link: '/learn' };
  if (modules?.modules) {
    const allLessons = modules.modules.flatMap((m: any) => m.lessons);
    const nextIncomplete = allLessons.find((l: any) => !progress.lessons[l.id]?.completed);
    if (nextIncomplete) {
      suggestion = { text: `Continue: ${nextIncomplete.title}`, link: `/learn/${nextIncomplete.id}` };
    } else if (avgQuiz < 80 && quizScores.length > 0) {
      const lowLesson = Object.entries(progress.lessons).find(([, v]: any) => v.quizScore !== null && v.quizScore < 80);
      if (lowLesson) {
        suggestion = { text: `Retake quiz: ${lowLesson[0]}`, link: `/learn/${lowLesson[0]}` };
      }
    } else if (progress.practice.sessionsCompleted < 3) {
      suggestion = { text: 'Try a practice scenario', link: '/practice' };
    } else {
      const minScenario = Object.entries(progress.practice.scenarios)
        .sort(([, a], [, b]) => a - b)[0];
      if (minScenario) {
        suggestion = { text: `Practice more: ${minScenario[0]}`, link: '/practice' };
      }
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">Dashboard</h1>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl px-6 py-3 text-sm text-red-300 mb-6">
          {error}
        </div>
      )}

      {loading && !modules && (
        <div className="text-gray-400 mb-6">Loading...</div>
      )}

      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-gray-900 rounded-xl p-3 sm:p-6 border border-gray-800">
          <div className="text-xl sm:text-3xl font-bold text-indigo-400">{completedLessons}/{totalLessons}</div>
          <div className="text-sm text-gray-400 mt-1">Lessons Completed</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-3 sm:p-6 border border-gray-800">
          <div className="text-xl sm:text-3xl font-bold text-emerald-400">{avgQuiz}%</div>
          <div className="text-sm text-gray-400 mt-1">Quiz Accuracy</div>
        </div>
        <div className="bg-gray-900 rounded-xl p-3 sm:p-6 border border-gray-800">
          <div className="text-xl sm:text-3xl font-bold text-amber-400">{progress.practice.sessionsCompleted}</div>
          <div className="text-sm text-gray-400 mt-1">Practice Sessions</div>
        </div>
      </div>

      <Link
        to={suggestion.link}
        className="block bg-indigo-600 hover:bg-indigo-500 rounded-xl p-6 mb-8 transition-colors"
      >
        <div className="text-sm text-indigo-200">Suggested Next</div>
        <div className="text-lg font-semibold">{suggestion.text}</div>
      </Link>

      {progress.practice.sessionsCompleted > 0 && (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Practice Breakdown</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {Object.entries(progress.practice.scenarios).map(([name, count]) => (
              <div key={name} className="text-center">
                <div className="text-xl font-bold text-gray-300">{count}</div>
                <div className="text-xs text-gray-500 capitalize">{name.replace('-', ' ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
