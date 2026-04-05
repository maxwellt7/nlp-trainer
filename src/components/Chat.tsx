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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || disabled) return;
    onSend(input.trim());
    setInput('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // Enter key creates a new line (default textarea behavior)
  // Message is only submitted when the user clicks the Send button

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.filter(msg => !msg.hidden).map((msg, i) => (
          <div key={i}>
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[90%] sm:max-w-[75%] rounded-xl px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-100'
                }`}
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere',
                }}
              >
                {msg.content}
              </div>
            </div>
            {coached && msg.coaching && (
              <div className="mt-2 ml-2 bg-emerald-950/40 border border-emerald-800/50 rounded-lg p-3 max-w-[80%]">
                <div className="text-xs font-semibold text-emerald-400 mb-1">Coaching</div>
                {msg.coaching.patternsUsed.length > 0 && (
                  <div className="text-xs text-gray-300 mb-1" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    <span className="text-emerald-400">Patterns used:</span> {msg.coaching.patternsUsed.join(', ')}
                  </div>
                )}
                <div className="text-xs text-gray-400 mb-1" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{msg.coaching.effectiveness}</div>
                {msg.coaching.suggestions.length > 0 && (
                  <div className="text-xs text-gray-400" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    <span className="text-amber-400">Try:</span> {msg.coaching.suggestions[0]}
                  </div>
                )}
                {msg.coaching.missedOpportunities.length > 0 && (
                  <div className="text-xs text-gray-400 mt-1" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
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
      <form onSubmit={handleSubmit} className="border-t border-gray-800 p-3 sm:p-4 flex gap-2 items-end bg-gray-950">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={loading || disabled}
          rows={1}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50 resize-none leading-relaxed"
          style={{
            minHeight: '42px',
            maxHeight: '120px',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || loading || disabled}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors shrink-0"
        >
          Send
        </button>
      </form>
    </div>
  );
}
