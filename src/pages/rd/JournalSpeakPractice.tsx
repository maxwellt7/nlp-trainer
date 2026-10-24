import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import Screen from '../../components/rd/Screen';
import Card from '../../components/rd/Card';

type Step = 'intro' | 'lists' | 'write' | 'meditate' | 'complete';

const STORAGE_KEY = 'journalspeak-session';

interface SessionData {
  pastStressors: string;
  currentStressors: string;
  personalityTraits: string;
  writingText: string;
  timestamp: number;
}

export default function JournalSpeakPractice() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [step, setStep] = useState<Step>('intro');
  const [timeRemaining, setTimeRemaining] = useState(20 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [meditationTime, setMeditationTime] = useState(10 * 60);
  const [isMeditating, setIsMeditating] = useState(false);
  
  // List inputs
  const [pastStressors, setPastStressors] = useState('');
  const [currentStressors, setCurrentStressors] = useState('');
  const [personalityTraits, setPersonalityTraits] = useState('');
  
  // Writing
  const [writingText, setWritingText] = useState('');
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  
  // Voice input
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [useSpeechRecognition, setUseSpeechRecognition] = useState(false);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Keyboard handling for mobile
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Load saved session on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data: SessionData = JSON.parse(saved);
        setPastStressors(data.pastStressors || '');
        setCurrentStressors(data.currentStressors || '');
        setPersonalityTraits(data.personalityTraits || '');
        setWritingText(data.writingText || '');
      } catch (e) {
        console.error('Failed to load session:', e);
      }
    }
  }, []);

  // Autosave to localStorage
  useEffect(() => {
    const data: SessionData = {
      pastStressors,
      currentStressors,
      personalityTraits,
      writingText,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [pastStressors, currentStressors, personalityTraits, writingText]);

  // Timer for writing
  useEffect(() => {
    let interval: number;
    if (isTimerRunning && timeRemaining > 0) {
      interval = window.setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeRemaining]);

  // Timer for meditation
  useEffect(() => {
    let interval: number;
    if (isMeditating && meditationTime > 0) {
      interval = window.setInterval(() => {
        setMeditationTime(prev => {
          if (prev <= 1) {
            setIsMeditating(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isMeditating, meditationTime]);

  // Check if Web Speech API is available
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setUseSpeechRecognition(!!SpeechRecognition);
  }, []);

  // Keyboard height tracking for mobile
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleResize = () => {
      if (!window.visualViewport) return;
      const vh = window.visualViewport.height;
      const wh = window.innerHeight;
      const diff = wh - vh;
      setKeyboardHeight(diff > 100 ? diff : 0);
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
    };
  }, []);

  // Auto-grow text area
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
    }
  }, [writingText]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const clearEntry = () => {
    if (confirm('Delete this journal entry? This cannot be undone.')) {
      setWritingText('');
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const startVoiceInput = async () => {
    if (isRecording) {
      stopVoiceInput();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (useSpeechRecognition) {
        // Use Web Speech API
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        let finalTranscript = '';

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
              setWritingText(prev => prev + transcript + ' ');
            } else {
              interimTranscript += transcript;
            }
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognition.start();
        recognitionRef.current = recognition;
        setIsRecording(true);
      } else {
        // Fallback: record audio and transcribe server-side
        const mediaRecorder = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await transcribeAudio(audioBlob);
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
      }
    } catch (error) {
      console.error('Microphone access denied:', error);
      alert('Microphone access is required for voice input. Please grant permission in your browser settings.');
    }
  };

  const stopVoiceInput = () => {
    if (useSpeechRecognition && recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    } else if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const token = await getToken();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/voice/transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-audio-mime': audioBlob.type,
        },
        body: arrayBuffer,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      setWritingText(prev => prev + data.text + ' ');
    } catch (error) {
      console.error('Transcription error:', error);
      alert('Failed to transcribe audio. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  if (step === 'intro') {
    return (
      <Screen>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 400, marginBottom: 8 }}>
          JournalSpeak Practice
        </h1>
        <p style={{ fontSize: 14, color: 'var(--rd-muted)', lineHeight: 1.55, marginBottom: 24 }}>
          A structured expressive writing practice to process unresolved emotions
        </p>

        <Card>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--rd-accent-bright)', marginBottom: 12 }}>
              What is JournalSpeak?
            </div>
            <p style={{ fontSize: 14, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 12 }}>
              JournalSpeak is Nicole Sachs' method based on Dr. John Sarno's mind-body work. It helps you process emotions that may be contributing to physical symptoms or stress.
            </p>
            <p style={{ fontSize: 14, color: 'var(--rd-ink-soft)', lineHeight: 1.6 }}>
              The practice has four parts:
            </p>
            <ol style={{ paddingLeft: 24, marginTop: 8 }}>
              <li style={{ fontSize: 14, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 6 }}>
                Create your lists (Past Stressors, Current Stressors, Personality Traits)
              </li>
              <li style={{ fontSize: 14, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 6 }}>
                Write or dictate for 20 minutes about one topic—raw, unfiltered, uncensored
              </li>
              <li style={{ fontSize: 14, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 6 }}>
                Meditate for 10 minutes to soothe your nervous system
              </li>
              <li style={{ fontSize: 14, color: 'var(--rd-ink-soft)', lineHeight: 1.6 }}>
                Repeat daily for best results
              </li>
            </ol>
          </div>

          <div style={{ 
            background: 'rgba(212, 168, 83, 0.1)', 
            border: '1px solid var(--rd-accent)', 
            borderRadius: 8, 
            padding: 16, 
            marginBottom: 20 
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--rd-accent-bright)', marginBottom: 6 }}>
              Privacy Note
            </div>
            <p style={{ fontSize: 13, color: 'var(--rd-muted)', lineHeight: 1.5 }}>
              Your entries are saved locally on your device only. Use the "Release Entry" button at the end to permanently delete your writing. Audio recordings are transcribed and immediately discarded.
            </p>
          </div>

          <button
            onClick={() => setStep('lists')}
            style={{
              background: 'var(--rd-accent)',
              color: '#06121c',
              border: 'none',
              borderRadius: 999,
              padding: '12px 24px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            Begin Practice →
          </button>

          <button
            onClick={() => navigate('/learn')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--rd-muted)',
              fontSize: 13,
              cursor: 'pointer',
              marginTop: 12,
              width: '100%',
            }}
          >
            ← Back to Learn
          </button>
        </Card>
      </Screen>
    );
  }

  if (step === 'lists') {
    return (
      <Screen>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, marginBottom: 24 }}>
          Step 1: Create Your Lists
        </h1>

        <Card>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--rd-accent-bright)', marginBottom: 8 }}>
              Past Stressors
            </div>
            <p style={{ fontSize: 13, color: 'var(--rd-muted)', lineHeight: 1.5, marginBottom: 8 }}>
              Events from your past that caused stress, fear, anger, guilt, shame, or humiliation.
            </p>
            <textarea
              value={pastStressors}
              onChange={(e) => setPastStressors(e.target.value)}
              placeholder="Examples: neglect, abuse, abandonment, moving, bullying, family difficulties, divorce, bereavement..."
              style={{
                width: '100%',
                minHeight: 80,
                padding: 12,
                fontSize: 16,
                fontFamily: 'inherit',
                color: 'var(--rd-ink)',
                background: 'var(--rd-surface)',
                border: '1px solid var(--rd-border)',
                borderRadius: 8,
                resize: 'vertical',
                touchAction: 'manipulation',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--rd-accent-bright)', marginBottom: 8 }}>
              Current Stressors
            </div>
            <p style={{ fontSize: 13, color: 'var(--rd-muted)', lineHeight: 1.5, marginBottom: 8 }}>
              Ongoing sources of stress in your present life.
            </p>
            <textarea
              value={currentStressors}
              onChange={(e) => setCurrentStressors(e.target.value)}
              placeholder="Examples: specific relationships, money, career, body image, pain or symptoms, regret..."
              style={{
                width: '100%',
                minHeight: 80,
                padding: 12,
                fontSize: 16,
                fontFamily: 'inherit',
                color: 'var(--rd-ink)',
                background: 'var(--rd-surface)',
                border: '1px solid var(--rd-border)',
                borderRadius: 8,
                resize: 'vertical',
                touchAction: 'manipulation',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--rd-accent-bright)', marginBottom: 8 }}>
              Personality Traits
            </div>
            <p style={{ fontSize: 13, color: 'var(--rd-muted)', lineHeight: 1.5, marginBottom: 8 }}>
              Aspects of your personality that may contribute to stress or emotional repression.
            </p>
            <textarea
              value={personalityTraits}
              onChange={(e) => setPersonalityTraits(e.target.value)}
              placeholder="Examples: perfectionism, people-pleasing, inner critic, difficulty setting boundaries..."
              style={{
                width: '100%',
                minHeight: 80,
                padding: 12,
                fontSize: 16,
                fontFamily: 'inherit',
                color: 'var(--rd-ink)',
                background: 'var(--rd-surface)',
                border: '1px solid var(--rd-border)',
                borderRadius: 8,
                resize: 'vertical',
                touchAction: 'manipulation',
              }}
            />
          </div>

          <button
            onClick={() => setStep('write')}
            style={{
              background: 'var(--rd-accent)',
              color: '#06121c',
              border: 'none',
              borderRadius: 999,
              padding: '12px 24px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            Continue to Writing →
          </button>
        </Card>
      </Screen>
    );
  }

  if (step === 'write') {
    return (
      <Screen>
        <div style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: 'var(--rd-bg)',
          borderBottom: '1px solid var(--rd-border)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
        }}>
          <div style={{
            fontSize: 32,
            fontFamily: 'var(--font-display)',
            color: timeRemaining === 0 ? 'var(--rd-accent-bright)' : 'var(--rd-ink-soft)',
          }}>
            {formatTime(timeRemaining)}
          </div>
          
          <div style={{ display: 'flex', gap: 8 }}>
            {!isTimerRunning && timeRemaining > 0 && (
              <button
                onClick={() => setIsTimerRunning(true)}
                style={{
                  background: 'var(--rd-accent)',
                  color: '#06121c',
                  border: 'none',
                  borderRadius: 999,
                  padding: '8px 20px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Start
              </button>
            )}

            {isTimerRunning && (
              <button
                onClick={() => setIsTimerRunning(false)}
                style={{
                  background: 'var(--rd-surface)',
                  color: 'var(--rd-muted)',
                  border: '1px solid var(--rd-border)',
                  borderRadius: 999,
                  padding: '8px 20px',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Pause
              </button>
            )}
          </div>
        </div>

        <div style={{ 
          marginTop: 72,
          paddingBottom: keyboardHeight ? `${keyboardHeight + 80}px` : '80px',
        }}>
          <textarea
            ref={textAreaRef}
            value={writingText}
            onChange={(e) => setWritingText(e.target.value)}
            placeholder="Write freely about any topic from your lists. No censorship, no editing. Let it flow..."
            style={{
              width: '100%',
              minHeight: 'calc(100vh - 200px)',
              padding: 16,
              fontSize: 16,
              lineHeight: 1.6,
              fontFamily: 'inherit',
              color: 'var(--rd-ink)',
              background: 'var(--rd-bg)',
              border: 'none',
              resize: 'none',
              outline: 'none',
              touchAction: 'manipulation',
            }}
          />

          <div style={{
            position: 'fixed',
            bottom: keyboardHeight || 0,
            left: 0,
            right: 0,
            background: 'var(--rd-bg)',
            borderTop: '1px solid var(--rd-border)',
            padding: 16,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}>
            <button
              onClick={startVoiceInput}
              disabled={isTranscribing}
              style={{
                flex: 1,
                background: isRecording ? '#ef4444' : 'var(--rd-accent)',
                color: '#06121c',
                border: 'none',
                borderRadius: 999,
                padding: '14px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: isTranscribing ? 0.6 : 1,
              }}
            >
              {isTranscribing ? '⏳ Transcribing...' : isRecording ? '⏸ Stop' : '🎤 Voice Input'}
            </button>

            <button
              onClick={() => setStep('meditate')}
              style={{
                flex: 1,
                background: 'var(--rd-surface)',
                color: 'var(--rd-ink)',
                border: '1px solid var(--rd-border)',
                borderRadius: 999,
                padding: '14px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Done →
            </button>
          </div>
        </div>
      </Screen>
    );
  }

  if (step === 'meditate') {
    return (
      <Screen>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, marginBottom: 24 }}>
          Step 3: Meditate for 10 Minutes
        </h1>

        <Card>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            marginBottom: 24 
          }}>
            <div style={{ 
              fontSize: 48, 
              fontFamily: 'var(--font-display)', 
              color: meditationTime === 0 ? 'var(--rd-accent-bright)' : 'var(--rd-ink-soft)',
              marginBottom: 16,
            }}>
              {formatTime(meditationTime)}
            </div>
            
            {!isMeditating && meditationTime > 0 && (
              <button
                onClick={() => setIsMeditating(true)}
                style={{
                  background: 'var(--rd-accent)',
                  color: '#06121c',
                  border: 'none',
                  borderRadius: 999,
                  padding: '12px 32px',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Start Meditation
              </button>
            )}

            {isMeditating && (
              <button
                onClick={() => setIsMeditating(false)}
                style={{
                  background: 'var(--rd-surface)',
                  color: 'var(--rd-muted)',
                  border: '1px solid var(--rd-border)',
                  borderRadius: 999,
                  padding: '8px 24px',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Pause
              </button>
            )}

            {meditationTime === 0 && (
              <div style={{ 
                fontSize: 16, 
                color: 'var(--rd-accent-bright)', 
                fontWeight: 600 
              }}>
                Meditation complete ✓
              </div>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--rd-accent-bright)', marginBottom: 12 }}>
              Meditation Guidance:
            </div>
            <ul style={{ paddingLeft: 20 }}>
              <li style={{ fontSize: 13, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 6 }}>
                Find a comfortable position
              </li>
              <li style={{ fontSize: 13, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 6 }}>
                Close your eyes and breathe naturally
              </li>
              <li style={{ fontSize: 13, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 6 }}>
                Notice sensations in your body without judgment
              </li>
              <li style={{ fontSize: 13, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 6 }}>
                If thoughts arise, acknowledge them and return to your breath
              </li>
              <li style={{ fontSize: 13, color: 'var(--rd-ink-soft)', lineHeight: 1.6 }}>
                Send compassion to yourself for doing this practice
              </li>
            </ul>
          </div>

          <button
            onClick={() => setStep('complete')}
            style={{
              background: 'var(--rd-accent)',
              color: '#06121c',
              border: 'none',
              borderRadius: 999,
              padding: '12px 24px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            Complete Practice →
          </button>
        </Card>
      </Screen>
    );
  }

  if (step === 'complete') {
    return (
      <Screen>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 400, marginBottom: 8 }}>
          Practice Complete ✓
        </h1>
        <p style={{ fontSize: 14, color: 'var(--rd-muted)', lineHeight: 1.55, marginBottom: 24 }}>
          You've completed today's JournalSpeak practice
        </p>

        <Card>
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 14, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 16 }}>
              Well done. You've honored your emotions and given them space to be felt.
            </p>
            <p style={{ fontSize: 14, color: 'var(--rd-ink-soft)', lineHeight: 1.6 }}>
              Nicole Sachs recommends practicing daily for best results. The more you write, the more you'll uncover.
            </p>
          </div>

          <div style={{ 
            background: 'rgba(212, 168, 83, 0.1)', 
            border: '1px solid var(--rd-accent)', 
            borderRadius: 8, 
            padding: 16, 
            marginBottom: 20 
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--rd-accent-bright)', marginBottom: 6 }}>
              Release Your Writing
            </div>
            <p style={{ fontSize: 13, color: 'var(--rd-muted)', lineHeight: 1.5, marginBottom: 12 }}>
              JournalSpeak is about cathartic release. Consider permanently deleting this entry now that you've completed the practice.
            </p>
            <button
              onClick={clearEntry}
              style={{
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: 999,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Release Entry (Delete)
            </button>
          </div>

          <button
            onClick={() => {
              setStep('intro');
              setTimeRemaining(20 * 60);
              setMeditationTime(10 * 60);
            }}
            style={{
              background: 'var(--rd-accent)',
              color: '#06121c',
              border: 'none',
              borderRadius: 999,
              padding: '12px 24px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
              marginBottom: 12,
            }}
          >
            New Practice Session
          </button>

          <button
            onClick={() => navigate('/learn')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--rd-muted)',
              fontSize: 13,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            ← Back to Learn
          </button>
        </Card>
      </Screen>
    );
  }

  return null;
}
