import { useState } from 'react';
import { api } from '../services/api';
import { useProgress } from '../hooks/useProgress';
import Chat from '../components/Chat';

const SCENARIOS = [
  { id: 'sales', name: 'Sales Conversation', description: 'Practice Milton Model patterns and meta program matching with a prospect' },
  { id: 'coaching', name: 'Coaching Session', description: 'Run a Personal Breakthrough Session with a client' },
  { id: 'negotiation', name: 'Negotiation', description: 'Practice chunking, Cartesian Coordinates, and rapport in a deal' },
  { id: 'pattern-drill', name: 'Pattern Recognition', description: 'Identify Milton Model patterns in NLP-loaded language' },
  { id: 'free', name: 'Free Practice', description: 'Describe any scenario and practice your NLP skills' },
];

interface Message {
  role: 'user' | 'assistant';
  content: string;
  hidden?: boolean;
  coaching?: any;
}

export default function Practice() {
  const [scenario, setScenario] = useState<string | null>(null);
  const [coached, setCoached] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [debrief, setDebrief] = useState<any>(null);
  const [freeSetup, setFreeSetup] = useState('');
  const [sessionStarted, setSessionStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const { recordPracticeSession } = useProgress();

  const MAX_MESSAGES = 50;

  const startSession = async () => {
    if (!scenario) return;
    setSessionStarted(true);
    setMessages([]);
    setDebrief(null);
    setError(null);

    if (scenario !== 'free') {
      setLoading(true);
      try {
        const initContent = 'Start the scenario. Give me your opening line in character.';
        const data = await api.sendMessage(
          scenario,
          [{ role: 'user', content: initContent }],
          coached
        );
        const parsed = data.response || data;
        setMessages([
          { role: 'user', content: initContent, hidden: true },
          { role: 'assistant', content: parsed.dialogue, coaching: parsed.coaching },
        ]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  const sendMessage = async (content: string) => {
    if (messages.length >= MAX_MESSAGES) return;

    const userMsg: Message = { role: 'user', content };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);
    setError(null);

    try {
      const apiMessages = updated.map(m => ({ role: m.role, content: m.content }));
      const data = await api.sendMessage(
        scenario!,
        apiMessages,
        coached,
        scenario === 'free' ? freeSetup : undefined
      );
      const parsed = data.response || data;
      setMessages([...updated, {
        role: 'assistant',
        content: parsed.dialogue,
        coaching: parsed.coaching,
      }]);
      setLastFailedMessage(null);
    } catch (err: any) {
      setError(err.message || 'Failed to get response');
      setLastFailedMessage(content);
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  };

  const endSession = async () => {
    if (!scenario || messages.length === 0) return;
    setLoading(true);
    try {
      const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));
      const result = await api.getDebrief(scenario, apiMessages);
      setDebrief(result.debrief || result);
      recordPracticeSession(scenario);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetSession = () => {
    setScenario(null);
    setMessages([]);
    setDebrief(null);
    setSessionStarted(false);
    setFreeSetup('');
    setError(null);
    setLastFailedMessage(null);
  };

  // Debrief view
  if (debrief) {
    return (
      <div className="p-8 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Session Debrief</h1>
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <p className="text-gray-300">{debrief.summary}</p>
          </div>
          {debrief.patternsUsed && (
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <h2 className="font-semibold mb-3">Patterns Used ({debrief.totalPatterns || 0} total)</h2>
              <div className="flex flex-wrap gap-2">
                {Object.entries(debrief.patternsUsed).map(([pattern, count]: [string, any]) => (
                  <span key={pattern} className="bg-indigo-900/50 text-indigo-300 px-3 py-1 rounded-full text-sm">
                    {pattern}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
          {debrief.strengths?.length > 0 && (
            <div className="bg-emerald-950/30 rounded-xl p-6 border border-emerald-800/50">
              <h2 className="font-semibold text-emerald-400 mb-2">Strengths</h2>
              <ul className="text-sm text-gray-300 space-y-1">
                {debrief.strengths.map((s: string, i: number) => <li key={i}>- {s}</li>)}
              </ul>
            </div>
          )}
          {debrief.areasToImprove?.length > 0 && (
            <div className="bg-amber-950/30 rounded-xl p-6 border border-amber-800/50">
              <h2 className="font-semibold text-amber-400 mb-2">Areas to Improve</h2>
              <ul className="text-sm text-gray-300 space-y-1">
                {debrief.areasToImprove.map((s: string, i: number) => <li key={i}>- {s}</li>)}
              </ul>
            </div>
          )}
          <button onClick={resetSession} className="bg-indigo-600 hover:bg-indigo-500 rounded-xl px-6 py-3 font-medium transition-colors">
            New Session
          </button>
        </div>
      </div>
    );
  }

  // Scenario selection
  if (!sessionStarted) {
    return (
      <div className="p-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Practice NLP</h1>
        <div className="space-y-3 mb-6">
          {SCENARIOS.map(s => (
            <button
              key={s.id}
              onClick={() => setScenario(s.id)}
              className={`w-full text-left p-4 rounded-xl border transition-colors ${
                scenario === s.id
                  ? 'border-indigo-500 bg-indigo-950/30'
                  : 'border-gray-800 bg-gray-900 hover:border-gray-700'
              }`}
            >
              <div className="font-medium">{s.name}</div>
              <div className="text-sm text-gray-400">{s.description}</div>
            </button>
          ))}
        </div>

        {scenario === 'free' && (
          <textarea
            value={freeSetup}
            onChange={e => setFreeSetup(e.target.value)}
            placeholder="Describe the scenario: who is the other person, what's the situation, what do you want to practice?"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 mb-4"
            rows={3}
          />
        )}

        <div className="flex items-center gap-4 mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={coached} onChange={e => setCoached(e.target.checked)} className="accent-indigo-500" />
            <span className="text-sm">Real-time coaching</span>
          </label>
        </div>

        <button
          onClick={startSession}
          disabled={!scenario || (scenario === 'free' && !freeSetup.trim())}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl px-6 py-3 font-medium transition-colors"
        >
          Start Session
        </button>
      </div>
    );
  }

  // Active session
  const atLimit = messages.length >= MAX_MESSAGES;
  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-medium capitalize">{scenario?.replace('-', ' ')}</span>
          {coached && <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded">Coached</span>}
          <span className="text-xs text-gray-500">{messages.filter(m => !m.hidden).length}/{MAX_MESSAGES} messages</span>
        </div>
        <button
          onClick={endSession}
          disabled={loading || messages.length === 0}
          className="bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
        >
          End Session
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <Chat
          messages={messages}
          onSend={sendMessage}
          loading={loading}
          coached={coached}
          disabled={atLimit}
        />
      </div>
      {error && (
        <div className="bg-red-900/30 border-t border-red-800 px-6 py-2 text-sm text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => lastFailedMessage && sendMessage(lastFailedMessage)} className="bg-red-700 hover:bg-red-600 rounded px-3 py-1 text-xs font-medium">Retry</button>
        </div>
      )}
      {atLimit && (
        <div className="bg-amber-900/30 border-t border-amber-800 px-6 py-2 text-sm text-amber-300 text-center">
          Message limit reached. Click &quot;End Session&quot; for your debrief.
        </div>
      )}
    </div>
  );
}
