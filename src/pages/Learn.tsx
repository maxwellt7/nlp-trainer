import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useProgress } from '../hooks/useProgress';

export default function Learn() {
  const [modules, setModules] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { progress } = useProgress();

  useEffect(() => {
    api.getModules().then(setModules).catch(err => setError(err.message || 'Failed to load curriculum'));
  }, []);

  if (error) return <div className="p-8 text-red-400">{error}</div>;
  if (!modules) return <div className="p-8 text-gray-400">Loading curriculum...</div>;

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">Learn NLP</h1>
      <div className="space-y-6">
        {modules.modules.map((mod: any) => {
          const completedCount = mod.lessons.filter((l: any) => progress.lessons[l.id]?.completed).length;
          return (
            <div key={mod.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="p-5 border-b border-gray-800">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold">{mod.title}</h2>
                  <span className="text-sm text-gray-400">{completedCount}/{mod.lessons.length}</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">{mod.description}</p>
              </div>
              <div className="divide-y divide-gray-800">
                {mod.lessons.map((lesson: any) => {
                  const lessonProgress = progress.lessons[lesson.id];
                  return (
                    <Link
                      key={lesson.id}
                      to={`/learn/${lesson.id}`}
                      className="flex items-center justify-between p-4 hover:bg-gray-800 transition-colors"
                    >
                      <div>
                        <div className="text-sm font-medium">{lesson.title}</div>
                        <div className="text-xs text-gray-500">{lesson.description}</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {lessonProgress?.quizScore != null && (
                          <span className={`text-xs ${lessonProgress.quizScore >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {lessonProgress.quizScore}%
                          </span>
                        )}
                        {lessonProgress?.completed && (
                          <span className="text-emerald-400 text-sm">&#10003;</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
