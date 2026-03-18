import { useState, useCallback } from 'react';
import { api } from '../services/api';
import Chat from '../components/Chat';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  hidden?: boolean;
}

interface ScriptResult {
  title: string;
  duration: string;
  estimatedMinutes: number;
  script: string;
}

function renderScript(script: string) {
  const parts = script.split(/(<break\s+time="(\d+)s"\s*\/>)/g);
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < parts.length) {
    const part = parts[i];
    if (part && part.startsWith('<break')) {
      const seconds = parts[i + 1];
      elements.push(
        <span key={i} className="flex items-center gap-2 my-3">
          <span className="flex-1 border-t border-gray-700" />
          <span className="text-xs text-gray-500 shrink-0">{seconds}s pause</span>
          <span className="flex-1 border-t border-gray-700" />
        </span>
      );
      i += 3; // skip full match, capture group, and next
    } else if (part && part.trim()) {
      elements.push(
        <span key={i} className="leading-relaxed">
          {part}
        </span>
      );
      i++;
    } else {
      i++;
    }
  }

  return elements;
}

export default function Hypnosis() {
  const [state, setState] = useState<'welcome' | 'intake' | 'script'>('welcome');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [readyToGenerate, setReadyToGenerate] = useState(false);
  const [scriptResult, setScriptResult] = useState<ScriptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const sendMessage = useCallback(async (content: string) => {
    const userMsg: Message = { role: 'user', content };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);
    setError(null);

    try {
      const data = await api.hypnosisChat(
        updated.map(m => ({ role: m.role, content: m.content }))
      );
      setMessages([...updated, { role: 'assistant', content: data.reply }]);
      if (data.readyToGenerate) {
        setReadyToGenerate(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to get response');
      setMessages(messages); // revert
    } finally {
      setLoading(false);
    }
  }, [messages]);

  const generateScript = async () => {
    setGenerating(true);
    setError(null);

    try {
      const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));
      const data = await api.hypnosisGenerate(apiMessages);
      setScriptResult(data);
      setState('script');
    } catch (err: any) {
      setError(err.message || 'Failed to generate script');
    } finally {
      setGenerating(false);
    }
  };

  const copyScript = async () => {
    if (!scriptResult) return;
    try {
      await navigator.clipboard.writeText(scriptResult.script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = scriptResult.script;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const reset = () => {
    setState('welcome');
    setMessages([]);
    setReadyToGenerate(false);
    setScriptResult(null);
    setError(null);
    setGenerating(false);
  };

  // Welcome state
  if (state === 'welcome') {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-3xl font-bold mb-4">Hypnosis Script Generator</h1>
        <p className="text-gray-400 mb-6">
          Create personalized self-hypnosis scripts powered by NLP. The agent will ask a few questions
          about your goal, then generate a custom script formatted for ElevenLabs audio generation.
        </p>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-6">
          <h2 className="font-semibold mb-2">How it works</h2>
          <div className="text-sm text-gray-400 space-y-1">
            <p>1. Tell the agent what you want to work on</p>
            <p>2. Answer a few questions (the agent adapts to your goal's complexity)</p>
            <p>3. Get a custom hypnosis script with precise pacing for audio generation</p>
          </div>
        </div>
        <button
          onClick={() => setState('intake')}
          className="bg-indigo-600 hover:bg-indigo-500 rounded-xl px-6 py-3 font-medium transition-colors"
        >
          Start Session
        </button>
      </div>
    );
  }

  // Script display state
  if (state === 'script' && scriptResult) {
    return (
      <div className="p-8 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">{scriptResult.title}</h1>
        <div className="flex items-center gap-3 mb-6">
          <span className={`px-3 py-1 rounded-full text-sm ${
            scriptResult.duration === 'full'
              ? 'bg-indigo-900/50 text-indigo-300'
              : 'bg-emerald-900/50 text-emerald-300'
          }`}>
            {scriptResult.duration === 'full' ? 'Full Session' : 'Short Script'} &mdash; ~{scriptResult.estimatedMinutes} min
          </span>
        </div>

        <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 mb-6 text-gray-200 text-base leading-loose font-serif">
          {renderScript(scriptResult.script)}
        </div>

        <div className="flex gap-3">
          <button
            onClick={copyScript}
            className={`rounded-xl px-6 py-3 font-medium transition-colors ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            {copied ? 'Copied!' : 'Copy Script'}
          </button>
          <button
            onClick={reset}
            className="bg-gray-800 hover:bg-gray-700 rounded-xl px-6 py-3 font-medium transition-colors"
          >
            New Session
          </button>
        </div>
      </div>
    );
  }

  // Intake chat state
  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-medium">Hypnosis Intake</span>
          {readyToGenerate && (
            <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded">Ready</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {readyToGenerate && (
            <button
              onClick={generateScript}
              disabled={generating}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
            >
              {generating ? 'Generating...' : 'Generate Script'}
            </button>
          )}
          <button
            onClick={reset}
            className="bg-gray-800 hover:bg-gray-700 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <Chat
          messages={messages}
          onSend={sendMessage}
          loading={loading}
          coached={false}
          disabled={generating}
        />
      </div>
      {error && (
        <div className="bg-red-900/30 border-t border-red-800 px-6 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
