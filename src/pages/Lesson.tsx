import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useProgress } from '../hooks/useProgress';
import PatternCard from '../components/PatternCard';
import Quiz from '../components/Quiz';

export default function Lesson() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { completeLesson } = useProgress();
  const [lesson, setLesson] = useState<any>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [questions, setQuestions] = useState<any[] | null>(null);
  const [quizResults, setQuizResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lessonId) return;
    api.getLesson(lessonId).then(setLesson).catch(console.error);
    setShowQuiz(false);
    setQuestions(null);
    setQuizResults(null);
  }, [lessonId]);

  const startQuiz = async () => {
    if (!lessonId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.generateQuiz(lessonId);
      setQuestions(data.questions);
      setShowQuiz(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitQuiz = async (answers: string[]) => {
    if (!lessonId || !questions) return;
    setLoading(true);
    try {
      const results = await api.evaluateQuiz(lessonId, questions, answers);
      setQuizResults(results);
      completeLesson(lessonId, results.overallScore);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!lesson) return <div className="p-8 text-gray-400">Loading lesson...</div>;

  const renderContent = (data: any): React.ReactNode => {
    if (Array.isArray(data)) {
      return data.map((item: any, i: number) => {
        if (item.name || item.text) {
          return <PatternCard key={i} name={item.name || `#${item.number}`} definition={item.definition || item.text || item.details || ''} tipOff={item.tipOff} examples={item.examples} number={item.number} />;
        }
        if (typeof item === 'string') {
          return <div key={i} className="text-sm text-gray-300 py-1">{item}</div>;
        }
        return <div key={i} className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-sm text-gray-300">{JSON.stringify(item, null, 2)}</div>;
      });
    }
    if (typeof data === 'object' && data !== null) {
      return Object.entries(data).map(([key, value]: [string, any]) => {
        if (Array.isArray(value)) {
          return (
            <div key={key} className="mb-6">
              <h3 className="text-lg font-semibold mb-3 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</h3>
              <div className="space-y-3">{renderContent(value)}</div>
            </div>
          );
        }
        if (typeof value === 'object' && value !== null) {
          return (
            <div key={key} className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-3">
              <h3 className="font-semibold capitalize mb-2">{key.replace(/([A-Z])/g, ' $1').trim()}</h3>
              <div className="text-sm text-gray-300 space-y-1">
                {Object.entries(value).map(([k, v]) => (
                  <div key={k}><span className="text-gray-500">{k}:</span> {Array.isArray(v) ? (v as string[]).join(', ') : String(v)}</div>
                ))}
              </div>
            </div>
          );
        }
        return <div key={key} className="text-sm text-gray-300 mb-2"><span className="text-gray-500">{key}:</span> {String(value)}</div>;
      });
    }
    return <div className="text-sm text-gray-300">{String(data)}</div>;
  };

  return (
    <div className="p-8 max-w-4xl">
      <Link to="/learn" className="text-sm text-gray-400 hover:text-white mb-4 inline-block">&larr; Back to Curriculum</Link>
      <h1 className="text-2xl font-bold mb-2">{lesson.lesson.title}</h1>
      <p className="text-gray-400 mb-6">{lesson.lesson.description}</p>

      {!showQuiz ? (
        <>
          <div className="space-y-4 mb-8">
            {lesson.content.map((section: any, i: number) => (
              <div key={i}>{renderContent(section.data)}</div>
            ))}
          </div>
          <button
            onClick={startQuiz}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 rounded-xl px-6 py-3 font-medium transition-colors"
          >
            {loading ? 'Generating Quiz...' : 'Take Quiz'}
          </button>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </>
      ) : questions ? (
        <>
          <h2 className="text-xl font-semibold mb-4">Quiz</h2>
          <Quiz questions={questions} onSubmit={submitQuiz} results={quizResults} loading={loading} />
          {quizResults && (
            <Link to="/learn" className="inline-block mt-6 text-indigo-400 hover:text-indigo-300">
              &larr; Back to Curriculum
            </Link>
          )}
        </>
      ) : null}
    </div>
  );
}
