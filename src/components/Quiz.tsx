import { useState } from 'react';

interface Question {
  type: string;
  question?: string;
  prompt?: string;
  scenario?: string;
  options?: string[];
  correctAnswer?: string;
  expectedPatterns?: string[];
}

interface QuizResult {
  questionIndex: number;
  correct: boolean;
  score: number;
  feedback: string;
}

interface Props {
  questions: Question[];
  onSubmit: (answers: string[]) => void;
  results: { results: QuizResult[]; overallScore: number; summary: string } | null;
  loading: boolean;
}

export default function Quiz({ questions, onSubmit, results, loading }: Props) {
  const [answers, setAnswers] = useState<string[]>(new Array(questions.length).fill(''));

  const setAnswer = (idx: number, value: string) => {
    setAnswers(prev => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  if (results) {
    return (
      <div className="space-y-4">
        <div className="bg-gray-800 rounded-xl p-6 text-center">
          <div className="text-4xl font-bold text-indigo-400 mb-2">{results.overallScore}%</div>
          <div className="text-gray-400">{results.summary}</div>
        </div>
        {results.results.map((r, i) => (
          <div key={i} className={`rounded-xl p-4 border ${r.correct ? 'border-emerald-800 bg-emerald-950/30' : 'border-red-800 bg-red-950/30'}`}>
            <div className="text-sm font-medium mb-1">
              Q{i + 1}: {questions[i].question || questions[i].prompt || questions[i].scenario}
            </div>
            <div className="text-sm text-gray-300">Your answer: {answers[i]}</div>
            <div className="text-sm text-gray-400 mt-1">{r.feedback}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {questions.map((q, i) => (
        <div key={i} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <div className="text-sm font-medium mb-3">
            Q{i + 1}: {q.question || q.prompt || q.scenario}
          </div>
          {q.options ? (
            <div className="space-y-2">
              {q.options.map(opt => (
                <label key={opt} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-800">
                  <input
                    type="radio"
                    name={`q-${i}`}
                    value={opt}
                    checked={answers[i] === opt}
                    onChange={() => setAnswer(i, opt)}
                    className="accent-indigo-500"
                  />
                  <span className="text-sm">{opt}</span>
                </label>
              ))}
            </div>
          ) : (
            <textarea
              value={answers[i]}
              onChange={e => setAnswer(i, e.target.value)}
              placeholder="Type your answer..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              rows={3}
            />
          )}
        </div>
      ))}
      <button
        onClick={() => onSubmit(answers)}
        disabled={loading || answers.some(a => !a.trim())}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl py-3 font-medium transition-colors"
      >
        {loading ? 'Evaluating...' : 'Submit Answers'}
      </button>
    </div>
  );
}
