import { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';

interface SavedScript {
  id: string;
  title: string;
  duration: string;
  estimatedMinutes: number;
  script: string;
  audioFile: string | null;
  createdAt: string;
}

export default function Audios() {
  const [scripts, setScripts] = useState<SavedScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadScripts = async () => {
    try {
      const data = await api.listScripts();
      setScripts(data.scripts || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScripts();
  }, []);

  const playAudio = (script: SavedScript) => {
    if (!script.audioFile) return;

    if (playingId === script.id) {
      // Stop
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingId(null);
      return;
    }

    // Stop current
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(api.getAudioUrl(script.audioFile));
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => {
      setPlayingId(null);
      setError('Failed to play audio');
    };
    audio.play();
    audioRef.current = audio;
    setPlayingId(script.id);
  };

  const generateAudio = async (scriptId: string) => {
    setGeneratingId(scriptId);
    setError(null);
    try {
      await api.generateAudio(scriptId);
      await loadScripts();
    } catch (err: any) {
      setError(err.message || 'Failed to generate audio');
    } finally {
      setGeneratingId(null);
    }
  };

  const deleteScript = async (scriptId: string) => {
    if (playingId === scriptId && audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
    }
    try {
      await api.deleteScript(scriptId);
      setScripts(prev => prev.filter(s => s.id !== scriptId));
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <div className="p-8 text-gray-400">Loading scripts...</div>;

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Audios</h1>
      <p className="text-gray-400 mb-8">Your saved hypnosis scripts and generated audio files.</p>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl px-6 py-3 text-sm text-red-300 mb-6">
          {error}
          <button onClick={() => setError(null)} className="ml-3 text-red-400 hover:text-red-300">dismiss</button>
        </div>
      )}

      {scripts.length === 0 ? (
        <div className="bg-gray-900 rounded-xl p-12 border border-gray-800 text-center">
          <p className="text-gray-400 mb-4">No scripts yet. Generate one from the Hypnosis page.</p>
          <a href="/hypnosis" className="text-indigo-400 hover:text-indigo-300">Go to Hypnosis</a>
        </div>
      ) : (
        <div className="space-y-4">
          {scripts.map(script => (
            <div key={script.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <div className="p-5 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="font-semibold truncate">{script.title}</h2>
                    <span className={`px-2 py-0.5 rounded text-xs shrink-0 ${
                      script.duration === 'full'
                        ? 'bg-indigo-900/50 text-indigo-300'
                        : 'bg-emerald-900/50 text-emerald-300'
                    }`}>
                      ~{script.estimatedMinutes} min
                    </span>
                    {script.audioFile && (
                      <span className="px-2 py-0.5 rounded text-xs bg-purple-900/50 text-purple-300 shrink-0">
                        Audio Ready
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(script.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-4">
                  {script.audioFile ? (
                    <button
                      onClick={() => playAudio(script)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        playingId === script.id
                          ? 'bg-red-600 hover:bg-red-500 text-white'
                          : 'bg-purple-600 hover:bg-purple-500 text-white'
                      }`}
                    >
                      {playingId === script.id ? 'Stop' : 'Play'}
                    </button>
                  ) : (
                    <button
                      onClick={() => generateAudio(script.id)}
                      disabled={generatingId === script.id}
                      className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                    >
                      {generatingId === script.id ? 'Generating...' : 'Generate Audio'}
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedId(expandedId === script.id ? null : script.id)}
                    className="bg-gray-800 hover:bg-gray-700 rounded-lg px-3 py-2 text-sm transition-colors"
                  >
                    {expandedId === script.id ? 'Hide' : 'Script'}
                  </button>
                  <button
                    onClick={() => deleteScript(script.id)}
                    className="bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400 rounded-lg px-3 py-2 text-sm transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {expandedId === script.id && (
                <div className="border-t border-gray-800 p-5 max-h-96 overflow-auto">
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap font-serif leading-relaxed">
                    {script.script}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
