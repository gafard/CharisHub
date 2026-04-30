'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Check, ChevronRight, Loader2, Mic, Pencil, Wind, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type LectioStep = 'lectio' | 'meditatio' | 'oratio' | 'contemplatio' | 'summary';

interface StepMeta {
  id: LectioStep;
  label: string;
  latin: string;
  icon: React.ReactNode;
  color: string;
  duration?: number; // seconds for contemplatio
}

const STEPS: StepMeta[] = [
  { id: 'lectio',       label: 'Lectio',       latin: 'Lecture',    icon: <BookOpen size={18} />, color: '#3b82f6' },
  { id: 'meditatio',    label: 'Meditatio',    latin: 'Méditation', icon: <Pencil   size={18} />, color: '#8b5cf6' },
  { id: 'oratio',       label: 'Oratio',       latin: 'Prière',     icon: <Mic      size={18} />, color: '#ec4899' },
  { id: 'contemplatio', label: 'Contemplatio', latin: 'Silence',    icon: <Wind     size={18} />, color: '#10b981', duration: 180 },
];

interface Props {
  reference: string;
  verseText: string;
  onClose: () => void;
}

// ─── Progress dots ─────────────────────────────────────────────────────────────

function StepDots({ current }: { current: LectioStep }) {
  const ids = STEPS.map(s => s.id);
  const currentIdx = ids.indexOf(current);
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => (
        <div
          key={s.id}
          className={`rounded-full transition-all duration-300 ${
            i < currentIdx
              ? 'h-2 w-2 bg-emerald-500'
              : i === currentIdx
              ? 'h-3 w-3 border-2 border-white/80 bg-white/20'
              : 'h-2 w-2 bg-white/20'
          }`}
        />
      ))}
    </div>
  );
}

// ─── Lectio step ──────────────────────────────────────────────────────────────

function LectioPane({ reference, verseText, onNext }: { reference: string; verseText: string; onNext: () => void }) {
  const [reads, setReads] = useState(0);
  const MAX_READS = 3;

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="text-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1">Lis lentement · {reads}/{MAX_READS} fois</p>
        <p className="text-sm font-bold text-white/60">{reference}</p>
      </div>

      <div className="flex-1 flex items-center justify-center px-2">
        <motion.p
          key={reads}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-xl md:text-2xl font-serif leading-relaxed text-white/95"
        >
          « {verseText} »
        </motion.p>
      </div>

      <div className="flex flex-col gap-3">
        {reads < MAX_READS ? (
          <button
            onClick={() => setReads(r => r + 1)}
            className="w-full rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 py-3 text-sm font-black text-white transition-all active:scale-95"
          >
            Lire encore une fois
          </button>
        ) : null}
        <button
          onClick={onNext}
          disabled={reads === 0}
          className="w-full rounded-2xl bg-white py-3 text-sm font-black text-black disabled:opacity-30 transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          Continuer vers la Méditation <ChevronRight size={16} />
        </button>
      </div>

      {reads === 0 && (
        <p className="text-center text-[10px] text-white/30">Lis au moins une fois avant de continuer</p>
      )}
    </div>
  );
}

// ─── Meditatio step ───────────────────────────────────────────────────────────

function MeditatioPane({ reference, verseText, onNext }: { reference: string; verseText: string; onNext: (answers: string[]) => void }) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>(['', '', '']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/bible/lectio', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reference, verseText, step: 'meditatio' }),
    })
      .then(r => r.json())
      .then(data => {
        if (!cancelled && Array.isArray(data.questions)) {
          setQuestions(data.questions);
          setAnswers(data.questions.map(() => ''));
        }
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reference, verseText]);

  const canContinue = answers.some(a => a.trim().length > 0);

  return (
    <div className="flex flex-col h-full gap-5">
      <div className="text-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
          Laisse la Parole te parler
        </p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-white/40" />
        </div>
      ) : error ? (
        <p className="text-center text-sm text-white/40">Impossible de charger les questions. Continue quand même.</p>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {questions.map((q, i) => (
            <div key={i} className="space-y-2">
              <p className="text-sm font-semibold text-white/80 leading-relaxed">{q}</p>
              <textarea
                value={answers[i]}
                onChange={e => setAnswers(prev => prev.map((a, j) => j === i ? e.target.value : a))}
                placeholder="Ta réponse personnelle..."
                rows={2}
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/25 resize-none focus:outline-none focus:border-white/30 transition-all"
              />
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => onNext(answers)}
        disabled={!canContinue && !error}
        className="w-full rounded-2xl bg-white py-3 text-sm font-black text-black disabled:opacity-30 transition-all active:scale-95 flex items-center justify-center gap-2"
      >
        Passer à la Prière <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ─── Oratio step ──────────────────────────────────────────────────────────────

function OratioPane({ reference, verseText, onNext }: { reference: string; verseText: string; onNext: (prayer: string) => void }) {
  const [invitation, setInvitation] = useState('');
  const [starter, setStarter] = useState('');
  const [prayer, setPrayer] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/bible/lectio', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reference, verseText, step: 'oratio' }),
    })
      .then(r => r.json())
      .then(data => {
        if (!cancelled) {
          setInvitation(data.invitation || '');
          setStarter(data.starter || '');
          setPrayer(data.starter || '');
        }
      })
      .catch(() => {
        if (!cancelled) setPrayer('Seigneur, merci pour ta Parole...');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reference, verseText]);

  return (
    <div className="flex flex-col h-full gap-5">
      <div className="text-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
          Parle à Ton Père
        </p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-white/40" />
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-4">
          {invitation && (
            <p className="text-sm text-white/60 italic leading-relaxed text-center">{invitation}</p>
          )}
          <textarea
            value={prayer}
            onChange={e => setPrayer(e.target.value)}
            rows={8}
            className="flex-1 rounded-2xl bg-white/5 border border-white/10 px-5 py-4 text-sm text-white placeholder:text-white/25 resize-none focus:outline-none focus:border-white/30 transition-all leading-relaxed font-serif"
            placeholder="Écris ta prière..."
          />
        </div>
      )}

      <button
        onClick={() => onNext(prayer)}
        className="w-full rounded-2xl bg-white py-3 text-sm font-black text-black transition-all active:scale-95 flex items-center justify-center gap-2"
      >
        Entrer dans le Silence <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ─── Contemplatio step ────────────────────────────────────────────────────────

function ContemplatioPane({ duration = 180, onDone }: { duration?: number; onDone: () => void }) {
  const [remaining, setRemaining] = useState(duration);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    setRunning(true);
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(intervalRef.current!);
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const progress = 1 - remaining / duration;

  return (
    <div className="flex flex-col h-full items-center justify-between gap-6">
      <div className="text-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
          Repose-toi en Sa présence
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        {/* Circular timer */}
        <div className="relative h-40 w-40">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
            <circle
              cx="60" cy="60" r="54" fill="none"
              stroke="rgba(255,255,255,0.7)" strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 54}`}
              strokeDashoffset={`${2 * Math.PI * 54 * (1 - progress)}`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-white tabular-nums">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
            <span className="text-[10px] text-white/40 uppercase tracking-widest mt-1">silence</span>
          </div>
        </div>

        <p className="text-center text-sm text-white/50 italic max-w-xs">
          « Sois tranquille, et sache que je suis Dieu. » — Psaume 46:10
        </p>
      </div>

      {remaining === 0 ? (
        <button
          onClick={onDone}
          className="w-full rounded-2xl bg-emerald-500 py-3 text-sm font-black text-white transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <Check size={16} /> Terminer la Lectio Divina
        </button>
      ) : running ? (
        <p className="text-[10px] text-white/30 uppercase tracking-widest">Respire et repose-toi...</p>
      ) : (
        <button
          onClick={start}
          className="w-full rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 py-3 text-sm font-black text-white transition-all active:scale-95"
        >
          Commencer le silence
        </button>
      )}
    </div>
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────

function SummaryPane({ reference, answers, prayer, onClose }: {
  reference: string;
  answers: string[];
  prayer: string;
  onClose: () => void;
}) {
  const filled = answers.filter(a => a.trim());

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="text-center">
        <div className="flex justify-center mb-3">
          <div className="h-14 w-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
            <Check size={28} className="text-emerald-400" />
          </div>
        </div>
        <h3 className="text-lg font-black text-white">Lectio Divina accomplie</h3>
        <p className="text-sm text-white/50 mt-1">{reference}</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {filled.length > 0 && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">Mes médiations</p>
            {filled.map((a, i) => (
              <p key={i} className="text-sm text-white/70 leading-relaxed">— {a}</p>
            ))}
          </div>
        )}
        {prayer.trim() && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-pink-400 mb-2">Ma prière</p>
            <p className="text-sm text-white/70 leading-relaxed font-serif italic">{prayer}</p>
          </div>
        )}
      </div>

      <button
        onClick={onClose}
        className="w-full rounded-2xl bg-white py-3 text-sm font-black text-black transition-all active:scale-95"
      >
        Fermer
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LectioDivina({ reference, verseText, onClose }: Props) {
  const [step, setStep] = useState<LectioStep>('lectio');
  const [answers, setAnswers] = useState<string[]>([]);
  const [prayer, setPrayer] = useState('');

  const currentMeta = STEPS.find(s => s.id === step) ?? STEPS[0];

  const bgGradient: Record<LectioStep, string> = {
    lectio:       'from-blue-950 to-slate-900',
    meditatio:    'from-violet-950 to-slate-900',
    oratio:       'from-rose-950 to-slate-900',
    contemplatio: 'from-emerald-950 to-slate-900',
    summary:      'from-slate-900 to-slate-900',
  };

  return (
    <AnimatePresence>
      <motion.div
        key="lectio-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      >
        <motion.div
          key="lectio-panel"
          initial={{ y: 40, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.97 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className={`relative w-full max-w-lg rounded-[32px] bg-gradient-to-b ${bgGradient[step]} p-6 pb-8 shadow-2xl`}
          style={{ maxHeight: '92dvh', display: 'flex', flexDirection: 'column' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${currentMeta.color}25`, color: currentMeta.color }}
              >
                {currentMeta.icon}
              </div>
              <div>
                <div className="text-xs font-black text-white">{currentMeta.label}</div>
                <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: currentMeta.color }}>
                  {currentMeta.latin}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {step !== 'summary' && <StepDots current={step} />}
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {step === 'lectio' && (
                  <LectioPane reference={reference} verseText={verseText} onNext={() => setStep('meditatio')} />
                )}
                {step === 'meditatio' && (
                  <MeditatioPane
                    reference={reference}
                    verseText={verseText}
                    onNext={a => { setAnswers(a); setStep('oratio'); }}
                  />
                )}
                {step === 'oratio' && (
                  <OratioPane
                    reference={reference}
                    verseText={verseText}
                    onNext={p => { setPrayer(p); setStep('contemplatio'); }}
                  />
                )}
                {step === 'contemplatio' && (
                  <ContemplatioPane onDone={() => setStep('summary')} />
                )}
                {step === 'summary' && (
                  <SummaryPane reference={reference} answers={answers} prayer={prayer} onClose={onClose} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
