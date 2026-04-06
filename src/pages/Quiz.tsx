import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  trackViewContent,
  trackQuizStart,
  trackQuizProgress,
  trackQuizComplete,
  trackEmailCapture,
  trackStartTrial,
  sendServerEvent,
} from '../utils/pixel';

// ── Types ──

interface QuizQuestion {
  id: number;
  beliefTarget: string;
  question: string;
  subtext?: string;
  options: { label: string; value: number; sublabel?: string }[];
  insight?: string;
}

interface QuizResult {
  score: number;
  tier: 'fractured' | 'drifting' | 'emerging';
  title: string;
  diagnosis: string;
  rootCause: string;
  prescription: string;
}

type FunnelStep = 'landing' | 'quiz' | 'email' | 'results';

// ── Quiz Data (Belief Engineering Sequence) ──

const QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    beliefTarget: 'Problem Belief — Make the problem real',
    question: 'How often do you say one thing but do another?',
    subtext: 'Be honest. No one sees your answers.',
    options: [
      { label: 'Almost never', value: 4, sublabel: 'My words and actions are aligned' },
      { label: 'Sometimes', value: 3, sublabel: 'Occasionally I catch myself' },
      { label: 'Often', value: 2, sublabel: 'More than I\'d like to admit' },
      { label: 'Constantly', value: 1, sublabel: 'It feels like two different people' },
    ],
  },
  {
    id: 2,
    beliefTarget: 'Problem Belief — Make it urgent',
    question: 'When you set a meaningful goal, what usually happens?',
    subtext: 'Think about the last 12 months.',
    options: [
      { label: 'I achieve it', value: 4, sublabel: 'Consistently follow through' },
      { label: 'I start strong but lose momentum', value: 3, sublabel: 'The fire fades after a few weeks' },
      { label: 'I self-sabotage', value: 2, sublabel: 'Something always derails me' },
      { label: 'I don\'t even start', value: 1, sublabel: 'The gap between intention and action is too wide' },
    ],
  },
  {
    id: 3,
    beliefTarget: 'Identity Belief — Open possibility',
    question: 'Do you believe your deepest patterns can actually change?',
    subtext: 'Not surface habits — the core operating system.',
    options: [
      { label: 'Absolutely', value: 4, sublabel: 'I\'ve seen it happen' },
      { label: 'I think so', value: 3, sublabel: 'But I haven\'t cracked the code yet' },
      { label: 'I\'m not sure anymore', value: 2, sublabel: 'I\'ve tried a lot of things' },
      { label: 'I\'ve mostly given up', value: 1, sublabel: 'This is just who I am' },
    ],
    insight: 'The fact that you\'re here means something in you hasn\'t given up.',
  },
  {
    id: 4,
    beliefTarget: 'Solution Belief — Fatal Flaw',
    question: 'What have you tried to change your patterns?',
    subtext: 'Select all that apply (tap your primary approach).',
    options: [
      { label: 'Therapy or counseling', value: 2, sublabel: 'Talked through it' },
      { label: 'Self-help books & podcasts', value: 2, sublabel: 'Consumed the knowledge' },
      { label: 'Meditation or mindfulness', value: 2, sublabel: 'Tried to observe it away' },
      { label: 'Willpower and discipline', value: 2, sublabel: 'White-knuckled it' },
      { label: 'Nothing yet', value: 3, sublabel: 'Haven\'t found the right approach' },
    ],
    insight: 'None of these are wrong — but they all share a fatal flaw. They try to solve a subconscious problem with conscious tools.',
  },
  {
    id: 5,
    beliefTarget: 'Outcome Belief — Make the outcome vivid',
    question: 'If your actions naturally matched your values tomorrow — what changes first?',
    subtext: 'What would alignment unlock for you?',
    options: [
      { label: 'My career takes off', value: 3, sublabel: 'No more holding myself back' },
      { label: 'My relationships deepen', value: 3, sublabel: 'Authentic connection, finally' },
      { label: 'My health transforms', value: 3, sublabel: 'I actually follow through on what I know' },
      { label: 'Everything', value: 4, sublabel: 'It\'s all connected' },
    ],
  },
  {
    id: 6,
    beliefTarget: 'Solution Belief — Master Key',
    question: '95% of your decisions are made by your subconscious mind — not your conscious willpower. Did you know that?',
    subtext: 'This is peer-reviewed neuroscience, not self-help theory.',
    options: [
      { label: 'I knew that', value: 4, sublabel: 'Which is why willpower alone doesn\'t work' },
      { label: 'I suspected it', value: 3, sublabel: 'It explains a lot' },
      { label: 'That\'s new to me', value: 2, sublabel: 'But it makes sense' },
    ],
    insight: 'This is why conscious approaches alone can\'t fix subconscious patterns. You need a tool that speaks the language of the subconscious.',
  },
  {
    id: 7,
    beliefTarget: 'Product Belief — Bridge to the app',
    question: 'If a daily 10-minute practice could reprogram your subconscious patterns using AI-personalized hypnosis — would you try it?',
    subtext: 'Not generic meditation. A protocol built around YOUR specific misalignments.',
    options: [
      { label: 'Absolutely', value: 4, sublabel: 'I\'m ready' },
      { label: 'I\'d be curious', value: 3, sublabel: 'Show me how it works' },
      { label: 'I\'d need proof first', value: 2, sublabel: 'Skeptical but open' },
    ],
  },
];

// ── Scoring & Results ──

function calculateResult(answers: Record<number, number>): QuizResult {
  const rawScore = Object.values(answers).reduce((sum, v) => sum + v, 0);
  const maxScore = QUESTIONS.length * 4;
  const normalized = Math.round((rawScore / maxScore) * 100);

  if (normalized <= 40) {
    return {
      score: normalized,
      tier: 'fractured',
      title: 'Fractured Alignment',
      diagnosis: 'Your subconscious patterns are actively working against your conscious intentions. You\'re not broken — you\'re running outdated programming. The gap between who you are and who you want to be isn\'t a character flaw. It\'s a signal that your subconscious beliefs haven\'t been updated to match your conscious growth.',
      rootCause: 'The methods you\'ve tried — therapy, books, willpower — all operate at the conscious level. But your patterns live deeper. They were installed before you had the language to question them, and they\'ve been running on autopilot ever since. This isn\'t about trying harder. It\'s about speaking the right language.',
      prescription: 'You need a daily subconscious reprogramming protocol — personalized to YOUR specific misalignments. Not generic affirmations. Not more information. A targeted intervention that reaches the operating system running beneath your awareness.',
    };
  } else if (normalized <= 70) {
    return {
      score: normalized,
      tier: 'drifting',
      title: 'Drifting Alignment',
      diagnosis: 'You have moments of clarity — flashes where everything clicks. But they don\'t hold. You drift back to old patterns like gravity pulling you down. This isn\'t lack of knowledge or motivation. You know what to do. Something deeper keeps overriding your best intentions.',
      rootCause: 'Your conscious mind has evolved, but your subconscious hasn\'t caught up. There\'s a lag between who you\'ve become intellectually and who you are operationally. Every time you "know better but do worse," that\'s the gap talking. Conscious tools can\'t close a subconscious gap.',
      prescription: 'You\'re closer than you think. The foundation is there — you just need a way to lock it in at the subconscious level. A daily alignment practice that bridges the gap between your conscious intentions and your subconscious programming.',
    };
  } else {
    return {
      score: normalized,
      tier: 'emerging',
      title: 'Emerging Alignment',
      diagnosis: 'You\'re already more aligned than most people will ever be. But you can feel the ceiling. There are specific areas where old patterns still have a grip — subtle self-sabotage, hesitation at critical moments, or a nagging sense that you\'re not operating at full capacity.',
      rootCause: 'At your level, the remaining misalignments are deeply embedded and highly specific. Generic approaches won\'t reach them. You need precision — a tool that can identify your exact blind spots and target them with surgical accuracy.',
      prescription: 'You don\'t need another course or coach. You need a daily practice that\'s as sophisticated as you are — AI-personalized, targeting your specific remaining misalignments, and evolving as you grow.',
    };
  }
}

// ── Components ──

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="w-full mb-6">
      <div className="flex justify-between items-center mb-2">
        <span className="text-uppercase-spaced text-text-muted">Question {current} of {total}</span>
        <span className="font-mono-brand text-sm text-accent-gold">{pct}%</span>
      </div>
      <div className="w-full h-1.5 bg-brand-surface rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--color-accent-gold-dim), var(--color-accent-gold))',
            boxShadow: '0 0 12px rgba(212, 168, 83, 0.3)',
          }}
        />
      </div>
    </div>
  );
}

function LandingSection({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-[100dvh] flex flex-col justify-center items-center px-6 py-12 text-center">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(212, 168, 83, 0.15) 0%, transparent 70%)' }} />

      <div className="relative z-10 max-w-lg mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-border bg-brand-surface/50 mb-8">
          <div className="w-2 h-2 rounded-full bg-accent-gold animate-pulse" />
          <span className="text-uppercase-spaced text-accent-gold">2-Minute Assessment</span>
        </div>

        {/* Headline */}
        <h1 className="font-display text-4xl md:text-5xl text-text-primary leading-tight mb-6">
          How Aligned<br />Are You, <span className="text-accent-gold">Really</span>?
        </h1>

        {/* Fatal Flaw opener */}
        <p className="text-lg text-text-secondary leading-relaxed mb-4">
          Why do driven men still feel stuck — even after therapy, journaling, and meditation?
        </p>
        <p className="text-base text-text-muted leading-relaxed mb-10">
          Because those methods treat symptoms. They never reach the <span className="text-text-primary font-medium">subconscious beliefs</span> running the show.
        </p>

        {/* Social proof */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="flex -space-x-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-brand-midnight bg-brand-card flex items-center justify-center">
                <span className="text-xs text-accent-gold font-bold">{['M', 'J', 'D', 'K'][i]}</span>
              </div>
            ))}
          </div>
          <span className="text-sm text-text-muted">
            <span className="text-text-secondary font-medium">2,847</span> men assessed this month
          </span>
        </div>

        {/* CTA */}
        <button
          onClick={onStart}
          className="btn-primary w-full max-w-sm py-4 text-lg font-bold tracking-wide animate-breathe cursor-pointer"
        >
          Take the Assessment
        </button>

        <p className="text-xs text-text-dim mt-4">
          Free. Private. Takes 2 minutes.
        </p>
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  onAnswer,
  animating,
}: {
  question: QuizQuestion;
  onAnswer: (value: number) => void;
  animating: boolean;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const handleSelect = (idx: number, value: number) => {
    if (selectedIdx !== null) return;
    setSelectedIdx(idx);
    setTimeout(() => onAnswer(value), 400);
  };

  return (
    <div className={`transition-all duration-500 ${animating ? 'opacity-0 translate-x-8' : 'opacity-100 translate-x-0'}`}>
      <h2 className="font-display text-2xl md:text-3xl text-text-primary leading-tight mb-3">
        {question.question}
      </h2>
      {question.subtext && (
        <p className="text-sm text-text-muted mb-8">{question.subtext}</p>
      )}

      <div className="space-y-3">
        {question.options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => handleSelect(idx, opt.value)}
            className={`w-full text-left p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
              selectedIdx === idx
                ? 'border-accent-gold bg-accent-gold-deep shadow-lg shadow-accent-gold/10'
                : selectedIdx !== null
                ? 'border-brand-border bg-brand-surface/30 opacity-40'
                : 'border-brand-border-light bg-brand-card hover:border-accent-gold-dim hover:bg-brand-card-hover'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                selectedIdx === idx
                  ? 'border-accent-gold bg-accent-gold'
                  : 'border-brand-border-light'
              }`}>
                {selectedIdx === idx && (
                  <svg className="w-3 h-3 text-brand-midnight" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div>
                <span className="text-base font-medium text-text-primary">{opt.label}</span>
                {opt.sublabel && (
                  <p className="text-xs text-text-muted mt-0.5">{opt.sublabel}</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {question.insight && selectedIdx !== null && (
        <div className="mt-6 p-4 rounded-xl border border-accent-gold-dim bg-accent-gold-deep animate-fade-in">
          <p className="text-sm text-accent-gold-bright leading-relaxed italic">
            {question.insight}
          </p>
        </div>
      )}
    </div>
  );
}

function EmailCapture({
  onSubmit,
  loading,
}: {
  onSubmit: (email: string, name: string) => void;
  loading: boolean;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !email.includes('@') || !email.includes('.')) {
      setError('Enter a valid email to see your results.');
      return;
    }
    onSubmit(email, name);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center items-center px-6 py-12">
      <div className="max-w-md w-full mx-auto text-center">
        {/* Lock icon */}
        <div className="w-16 h-16 rounded-2xl bg-accent-gold-deep border border-accent-gold-dim flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-accent-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>

        <h2 className="font-display text-3xl text-text-primary mb-3">
          Your Results Are Ready
        </h2>
        <p className="text-text-secondary mb-8">
          Enter your email to unlock your personalized Alignment Score and diagnostic report.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="First name (optional)"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3.5 rounded-xl bg-brand-card border border-brand-border-light text-text-primary placeholder-text-dim focus:outline-none focus:border-accent-gold transition-colors"
          />
          <input
            ref={emailRef}
            type="email"
            placeholder="Your best email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(''); }}
            className={`w-full px-4 py-3.5 rounded-xl bg-brand-card border text-text-primary placeholder-text-dim focus:outline-none focus:border-accent-gold transition-colors ${
              error ? 'border-status-error' : 'border-brand-border-light'
            }`}
          />
          {error && <p className="text-sm text-status-error text-left">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-4 text-lg font-bold tracking-wide cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Calculating...' : 'Reveal My Alignment Score'}
          </button>
        </form>

        <div className="flex items-center justify-center gap-4 mt-6 text-xs text-text-dim">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            Encrypted
          </span>
          <span>No spam, ever</span>
          <span>Unsubscribe anytime</span>
        </div>
      </div>
    </div>
  );
}

function ResultsSection({ result, name }: { result: QuizResult; name: string }) {
  const navigate = useNavigate();

  const tierColors = {
    fractured: { ring: 'border-status-error', glow: 'rgba(239, 68, 68, 0.15)', text: 'text-status-error', bg: 'bg-status-error/10' },
    drifting: { ring: 'border-status-warning', glow: 'rgba(245, 158, 11, 0.15)', text: 'text-status-warning', bg: 'bg-status-warning/10' },
    emerging: { ring: 'border-status-success', glow: 'rgba(34, 197, 94, 0.15)', text: 'text-status-success', bg: 'bg-status-success/10' },
  };

  const colors = tierColors[result.tier];

  const handleCTA = () => {
    trackStartTrial({ value: 0, currency: 'USD' });
    sendServerEvent('StartTrial', { score: result.score, tier: result.tier });
    navigate('/sign-up');
  };

  return (
    <div className="min-h-[100dvh] px-6 py-12 overflow-y-auto">
      <div className="max-w-lg mx-auto">
        {/* Score Circle */}
        <div className="text-center mb-8">
          {name && (
            <p className="text-text-muted text-sm mb-2">{name}, your score is</p>
          )}
          <div className="relative inline-flex items-center justify-center mb-4">
            <div
              className={`w-32 h-32 rounded-full border-4 ${colors.ring} flex items-center justify-center`}
              style={{ boxShadow: `0 0 40px ${colors.glow}, 0 0 80px ${colors.glow}` }}
            >
              <span className="font-mono-brand text-5xl font-bold text-text-primary">{result.score}</span>
            </div>
          </div>
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full ${colors.bg} mb-2`}>
            <span className={`text-uppercase-spaced ${colors.text}`}>{result.title}</span>
          </div>
        </div>

        {/* Diagnosis */}
        <div className="brand-card p-5 mb-4">
          <h3 className="text-uppercase-spaced text-accent-gold mb-3">Your Diagnosis</h3>
          <p className="text-text-secondary text-sm leading-relaxed">{result.diagnosis}</p>
        </div>

        {/* Root Cause */}
        <div className="brand-card p-5 mb-4">
          <h3 className="text-uppercase-spaced text-accent-gold mb-3">The Root Cause</h3>
          <p className="text-text-secondary text-sm leading-relaxed">{result.rootCause}</p>
        </div>

        {/* Prescription */}
        <div className="brand-card-gold p-5 mb-8">
          <h3 className="text-uppercase-spaced text-accent-gold mb-3">Your Prescription</h3>
          <p className="text-text-secondary text-sm leading-relaxed">{result.prescription}</p>
        </div>

        {/* Bridge to product */}
        <div className="text-center mb-6">
          <h3 className="font-display text-2xl text-text-primary mb-3">
            The Alignment Engine
          </h3>
          <p className="text-text-secondary text-sm leading-relaxed mb-6">
            AI-personalized hypnosis sessions that target your specific subconscious misalignments.
            10 minutes a day. Built around your patterns, your values, your blind spots.
          </p>

          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { icon: '🧠', label: 'AI-Personalized', sub: 'Built for you' },
              { icon: '🎯', label: 'Targeted', sub: 'Your blind spots' },
              { icon: '⚡', label: '10 Min/Day', sub: 'That\'s all it takes' },
            ].map((f, i) => (
              <div key={i} className="brand-card p-3 text-center">
                <div className="text-2xl mb-1">{f.icon}</div>
                <div className="text-xs font-semibold text-text-primary">{f.label}</div>
                <div className="text-xs text-text-muted">{f.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={handleCTA}
          className="btn-primary w-full py-4 text-lg font-bold tracking-wide animate-breathe cursor-pointer mb-4"
        >
          Start Your Alignment Protocol — Free
        </button>

        <p className="text-center text-xs text-text-dim mb-16">
          No credit card required. Cancel anytime.
        </p>
      </div>
    </div>
  );
}

// ── Main Quiz Page ──

export default function Quiz() {
  const [step, setStep] = useState<FunnelStep>('landing');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [animating, setAnimating] = useState(false);
  const [name, setName] = useState('');
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Track page view on mount
  useEffect(() => {
    trackViewContent({
      content_name: 'Alignment Assessment',
      content_category: 'quiz_funnel',
    });
    sendServerEvent('ViewContent', { sourceUrl: window.location.href });
  }, []);

  const handleStart = () => {
    setStep('quiz');
    trackQuizStart();
    sendServerEvent('ViewContent', { sourceUrl: window.location.href });
  };

  const handleAnswer = (value: number) => {
    const qId = QUESTIONS[currentQ].id;
    const newAnswers = { ...answers, [qId]: value };
    setAnswers(newAnswers);

    trackQuizProgress(currentQ + 1, QUESTIONS.length);

    if (currentQ < QUESTIONS.length - 1) {
      setAnimating(true);
      setTimeout(() => {
        setCurrentQ(currentQ + 1);
        setAnimating(false);
      }, 400);
    } else {
      // Quiz complete — go to email capture
      setTimeout(() => {
        setStep('email');
        const res = calculateResult(newAnswers);
        setResult(res);
        trackQuizComplete(res.score, res.tier);
        sendServerEvent('ViewContent', {
          score: res.score,
          tier: res.tier,
          sourceUrl: window.location.href,
        });
      }, 500);
    }
  };

  const handleEmailSubmit = async (submittedEmail: string, submittedName: string) => {
    setName(submittedName);
    setLoading(true);

    // Track email capture
    trackEmailCapture();

    // Send to backend for storage + CAPI
    try {
      const BASE = (import.meta.env.VITE_API_URL || '') + '/api';
      await fetch(`${BASE}/quiz/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: submittedEmail,
          name: submittedName,
          score: result?.score,
          tier: result?.tier,
          answers,
          sourceUrl: window.location.href,
          userAgent: navigator.userAgent,
          fbp: getCookie('_fbp'),
          fbc: getCookie('_fbc'),
        }),
      });
    } catch {
      // Silent fail
    }

    // Send server-side Lead event
    sendServerEvent('Lead', {
      email: submittedEmail,
      score: result?.score,
      tier: result?.tier,
    });

    setLoading(false);
    setStep('results');
  };

  return (
    <div className="min-h-[100dvh] bg-brand-midnight relative overflow-hidden">
      {/* Background gradient */}
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(212, 168, 83, 0.03) 0%, transparent 60%)' }} />

      <div className="relative z-10">
        {step === 'landing' && (
          <LandingSection onStart={handleStart} />
        )}

        {step === 'quiz' && (
          <div className="min-h-[100dvh] flex flex-col justify-center px-6 py-12">
            <div className="max-w-lg mx-auto w-full">
              <ProgressBar current={currentQ + 1} total={QUESTIONS.length} />
              <QuestionCard
                key={currentQ}
                question={QUESTIONS[currentQ]}
                onAnswer={handleAnswer}
                animating={animating}
              />
            </div>
          </div>
        )}

        {step === 'email' && (
          <EmailCapture onSubmit={handleEmailSubmit} loading={loading} />
        )}

        {step === 'results' && result && (
          <ResultsSection result={result} name={name} />
        )}
      </div>
    </div>
  );
}

// Helper
function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : undefined;
}
