import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Screen from '../../components/rd/Screen';
import Card from '../../components/rd/Card';

type Step = 'intro' | 'lists' | 'write' | 'meditate' | 'complete';

export default function JournalSpeakPractice() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('intro');
  const [timeRemaining, setTimeRemaining] = useState(20 * 60); // 20 minutes in seconds
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [meditationTime, setMeditationTime] = useState(10 * 60); // 10 minutes
  const [isMeditating, setIsMeditating] = useState(false);

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
                Write for 20 minutes about one topic—raw, unfiltered, uncensored
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
              JournalSpeak entries are meant to be private, cathartic releases. This app doesn't save your writing. Consider deleting or destroying your written work after completing the practice.
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
            <p style={{ fontSize: 13, color: 'var(--rd-muted)', lineHeight: 1.5, marginBottom: 12 }}>
              Events from your past (childhood through adulthood) that caused stress, fear, anger, guilt, shame, or humiliation.
            </p>
            <div style={{ fontSize: 13, color: 'var(--rd-ink-soft)', lineHeight: 1.6 }}>
              Examples: neglect, abuse, abandonment, moving, bullying, difficulties with family, divorce, bereavement, career stress, or any event that means something to you
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--rd-accent-bright)', marginBottom: 8 }}>
              Current Stressors
            </div>
            <p style={{ fontSize: 13, color: 'var(--rd-muted)', lineHeight: 1.5, marginBottom: 12 }}>
              Ongoing sources of stress in your present life.
            </p>
            <div style={{ fontSize: 13, color: 'var(--rd-ink-soft)', lineHeight: 1.6 }}>
              Examples: specific relationships (name each person), money, moving, job/career, body image, pain or symptoms, regret or resentment
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--rd-accent-bright)', marginBottom: 8 }}>
              Personality Traits
            </div>
            <p style={{ fontSize: 13, color: 'var(--rd-muted)', lineHeight: 1.5, marginBottom: 12 }}>
              Aspects of your personality that may contribute to stress or emotional repression.
            </p>
            <div style={{ fontSize: 13, color: 'var(--rd-ink-soft)', lineHeight: 1.6 }}>
              Examples: perfectionism, people-pleasing, needing approval, inner critic, high standards, putting others first, difficulty setting boundaries, difficulty expressing emotions
            </div>
          </div>

          <div style={{ 
            background: 'rgba(212, 168, 83, 0.1)', 
            border: '1px solid var(--rd-accent)', 
            borderRadius: 8, 
            padding: 16, 
            marginBottom: 20 
          }}>
            <p style={{ fontSize: 13, color: 'var(--rd-muted)', lineHeight: 1.5 }}>
              Take a few minutes now to write these lists on paper or in a private note. They'll serve as your writing prompts.
            </p>
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
            I've Made My Lists →
          </button>
        </Card>
      </Screen>
    );
  }

  if (step === 'write') {
    return (
      <Screen>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, marginBottom: 24 }}>
          Step 2: Write for 20 Minutes
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
              color: timeRemaining === 0 ? 'var(--rd-accent-bright)' : 'var(--rd-ink-soft)',
              marginBottom: 16,
            }}>
              {formatTime(timeRemaining)}
            </div>
            
            {!isTimerRunning && timeRemaining > 0 && (
              <button
                onClick={() => setIsTimerRunning(true)}
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
                Start Timer
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
                  padding: '8px 24px',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Pause
              </button>
            )}

            {timeRemaining === 0 && (
              <div style={{ 
                fontSize: 16, 
                color: 'var(--rd-accent-bright)', 
                fontWeight: 600 
              }}>
                Time's up! ✓
              </div>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--rd-accent-bright)', marginBottom: 12 }}>
              Writing Guidelines:
            </div>
            <ul style={{ paddingLeft: 20 }}>
              <li style={{ fontSize: 13, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 6 }}>
                Pick ANY topic from your lists—don't overthink it
              </li>
              <li style={{ fontSize: 13, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 6 }}>
                Write the raw, unfiltered truth—no censorship, no editing
              </li>
              <li style={{ fontSize: 13, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 6 }}>
                If you go off on a tangent, follow it
              </li>
              <li style={{ fontSize: 13, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 6 }}>
                Focus on how you FEEL, not just what happened
              </li>
              <li style={{ fontSize: 13, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 6 }}>
                Notice what's happening in your body as you write
              </li>
              <li style={{ fontSize: 13, color: 'var(--rd-ink-soft)', lineHeight: 1.6 }}>
                Invite difficult emotions to surface (they may not come right away—that's okay)
              </li>
            </ul>
          </div>

          <div style={{ 
            background: 'rgba(212, 168, 83, 0.1)', 
            border: '1px solid var(--rd-accent)', 
            borderRadius: 8, 
            padding: 16, 
            marginBottom: 20 
          }}>
            <p style={{ fontSize: 13, color: 'var(--rd-muted)', lineHeight: 1.5 }}>
              Write on paper, in a notes app, or anywhere private. This app doesn't save your writing—it's for you alone.
            </p>
          </div>

          <button
            onClick={() => setStep('meditate')}
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
            Done Writing →
          </button>
        </Card>
      </Screen>
    );
  }

  if (step === 'meditate') {
    return (
      <Screen>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, marginBottom: 24 }}>
          Step 3: Self-Soothing Meditation
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
                Complete! ✓
              </div>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 14, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 16 }}>
              After expressing difficult emotions, take time to soothe your nervous system and offer yourself compassion.
            </p>
            
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--rd-accent-bright)', marginBottom: 12 }}>
              Meditation Options:
            </div>
            <ul style={{ paddingLeft: 20 }}>
              <li style={{ fontSize: 13, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 6 }}>
                Silent meditation
              </li>
              <li style={{ fontSize: 13, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 6 }}>
                Guided visualization
              </li>
              <li style={{ fontSize: 13, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 6 }}>
                Loving-kindness meditation
              </li>
              <li style={{ fontSize: 13, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 6 }}>
                Body scan or breathing exercise
              </li>
              <li style={{ fontSize: 13, color: 'var(--rd-ink-soft)', lineHeight: 1.6 }}>
                Or use the app's meditation features
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
            Finish Practice →
          </button>
        </Card>
      </Screen>
    );
  }

  if (step === 'complete') {
    return (
      <Screen>
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <div style={{ 
            fontSize: 64, 
            marginBottom: 24 
          }}>
            ✨
          </div>
          
          <h1 style={{ 
            fontFamily: 'var(--font-display)', 
            fontSize: 32, 
            fontWeight: 400, 
            marginBottom: 12 
          }}>
            Practice Complete
          </h1>
          
          <p style={{ 
            fontSize: 14, 
            color: 'var(--rd-muted)', 
            lineHeight: 1.6, 
            marginBottom: 32,
            maxWidth: 480,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            You've completed a full JournalSpeak session. The most effective approach is to practice daily, especially when beginning this work.
          </p>

          <Card>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--rd-accent-bright)', marginBottom: 12 }}>
                Remember:
              </div>
              <ul style={{ paddingLeft: 20, textAlign: 'left' }}>
                <li style={{ fontSize: 13, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 6 }}>
                  This is a practice, not a quick fix
                </li>
                <li style={{ fontSize: 13, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 6 }}>
                  Consistency brings the most benefit
                </li>
                <li style={{ fontSize: 13, color: 'var(--rd-ink-soft)', lineHeight: 1.6, marginBottom: 6 }}>
                  It's okay if emotions didn't surface today—they will when you're ready
                </li>
                <li style={{ fontSize: 13, color: 'var(--rd-ink-soft)', lineHeight: 1.6 }}>
                  Consider deleting or destroying your writing
                </li>
              </ul>
            </div>

            <button
              onClick={() => {
                setStep('intro');
                setTimeRemaining(20 * 60);
                setMeditationTime(10 * 60);
                setIsTimerRunning(false);
                setIsMeditating(false);
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
              Practice Again
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
              Back to Learn
            </button>
          </Card>

          <div style={{ marginTop: 32, fontSize: 12, color: 'var(--rd-muted-2)' }}>
            <a 
              href="https://www.yourbreakawake.com/journalspeak-info" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: 'var(--rd-accent)' }}
            >
              Learn more about JournalSpeak
            </a>
          </div>
        </div>
      </Screen>
    );
  }

  return null;
}
