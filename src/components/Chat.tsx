import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  hidden?: boolean;
  coaching?: {
    patternsUsed: string[];
    effectiveness: string;
    suggestions: string[];
    missedOpportunities: string[];
  };
}

interface Props {
  messages: Message[];
  onSend: (message: string) => void;
  loading: boolean;
  coached: boolean;
  disabled?: boolean;
}

export default function Chat({ messages, onSend, loading, coached, disabled }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || disabled) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.filter(msg => !msg.hidden).map((msg, i) => (
          <div key={i}>
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] sm:max-w-[75%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-100'
              }`}>
                {msg.content}
              </div>
            </div>
            {coached && msg.coaching && (
              <div className="mt-2 ml-2 bg-emerald-950/40 border border-emerald-800/50 rounded-lg p-3 max-w-[80%]">
                <div className="text-xs font-semibold text-emerald-400 mb-1">Coaching</div>
                {msg.coaching.patternsUsed.length > 0 && (
                  <div className="text-xs text-gray-300 mb-1">
                    <span className="text-emerald-400">Patterns used:</span> {msg.coaching.patternsUsed.join(', ')}
                  </div>
                )}
                <div className="text-xs text-gray-400 mb-1">{msg.coaching.effectiveness}</div>
                {msg.coaching.suggestions.length > 0 && (
                  <div className="text-xs text-gray-400">
                    <span className="text-amber-400">Try:</span> {msg.coaching.suggestions[0]}
                  </div>
                )}
                {msg.coaching.missedOpportunities.length > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    <span className="text-red-400">Missed:</span> {msg.coaching.missedOpportunities[0]}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400">Thinking...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="border-t border-gray-800 p-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={loading || disabled}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading || disabled}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}
