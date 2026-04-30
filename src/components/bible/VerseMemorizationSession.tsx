'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { BookMarked, Check, ChevronRight, RotateCcw, Trophy, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { memorizationStore, type MemorizationCard, type ReviewRating } from '@/lib/memorizationStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionResult {
  again: number;
  hard: number;
  good: number;
  easy: number;
  total: number;
}

const RATINGS: { q: ReviewRating; label: string; color: string; bg: string }[] = [
  { q: 0, label: 'Oublié',   color: 'text-red-400',    bg: 'bg-red-500/15 border-red-500/30 hover:bg-red-500/25' },
  { q: 1, label: 'Difficile',color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/30 hover:bg-orange-500/25' },
  { q: 3, label: 'Bien',     color: 'text-blue-400',   bg: 'bg-blue-500/15 border-blue-500/30 hover:bg-blue-500/25' },
  { q: 5, label: 'Facile',   color: 'text-emerald-400',bg: 'bg-emerald-500/15 border-emerald-500/30 hover:bg-emerald-500/25' },
];

// ─── Flashcard ────────────────────────────────────────────────────────────────

function Flashcard({ card, onRate }: { card: MemorizationCard; onRate: (q: ReviewRating) => void }) {
  const [revealed, setRevealed] = useState(false);
  const [flipping, setFlipping] = useState(false);

  const reveal = () => {
    if (revealed) return;
    setFlipping(true);
    setTimeout(() => { setRevealed(true); setFlipping(false); }, 200);
  };

  const handleRate = (q: ReviewRating) => {
    setRevealed(false);
    onRate(q);
  };

  const masteryPct = card.totalReviews > 0 ? Math.round((card.correctReviews / card.totalReviews) * 100) : 0;

  return (
    <div className="flex flex-col h-full gap-5">
      {/* Card */}
      <motion.div
        style={{ perspective: 1000 }}
        className="flex-1 cursor-pointer"
        onClick={reveal}
      >
        <motion.div
          animate={{ rotateY: flipping ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          className="h-full rounded-[28px] border border-white/10 bg-gradient-to-b from-white/8 to-white/4 p-7 flex flex-col items-center justify-center gap-4 select-none"
        >
          <div className="text-[10px] font-black uppercase tracking-widest text-white/40">
            {card.reference}
          </div>

          <AnimatePresence mode="wait">
            {revealed ? (
              <motion.p
                key="text"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center text-lg md:text-xl font-serif leading-relaxed text-white/95"
              >
                « {card.text} »
              </motion.p>
            ) : (
              <motion.div
                key="hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-3"
              >
                <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center">
                  <BookMarked size={26} className="text-white/50" />
                </div>
                <p className="text-sm font-bold text-white/40">Appuie pour révéler</p>
              </motion.div>
            )}
          </AnimatePresence>

          {card.totalReviews > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 w-20 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${masteryPct}%` }} />
              </div>
              <span className="text-[9px] font-bold text-white/30">{masteryPct}% maîtrisé</span>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Rating buttons */}
      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-4 gap-2"
          >
            {RATINGS.map(({ q, label, color, bg }) => (
              <button
                key={q}
                onClick={() => handleRate(q)}
                className={`rounded-2xl border py-3 text-xs font-black transition-all active:scale-95 ${bg} ${color}`}
              >
                {label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {!revealed && (
        <button
          onClick={reveal}
          className="w-full rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 py-3 text-sm font-black text-white transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          Révéler le verset <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────

function SessionSummary({ result, onClose, onRestart }: {
  result: SessionResult;
  onClose: () => void;
  onRestart: () => void;
}) {
  const score = Math.round(((result.good + result.easy) / result.total) * 100);
  return (
    <div className="flex flex-col h-full items-center justify-between gap-6">
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 12 }}
          className="h-20 w-20 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl shadow-amber-500/30"
        >
          <Trophy size={36} className="text-white" />
        </motion.div>

        <div className="text-center">
          <div className="text-4xl font-black text-white">{score}%</div>
          <div className="text-sm font-bold text-white/50 mt-1">de réussite</div>
        </div>

        <div className="grid grid-cols-4 gap-3 w-full">
          {RATINGS.map(({ q, label, color }) => {
            const count = q === 0 ? result.again : q === 1 ? result.hard : q === 3 ? result.good : result.easy;
            return (
              <div key={q} className="rounded-2xl bg-white/5 border border-white/8 p-3 text-center">
                <div className={`text-xl font-black ${color}`}>{count}</div>
                <div className="text-[9px] font-bold text-white/30 mt-0.5">{label}</div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-sm text-white/50">
          {result.total} verset{result.total > 1 ? 's' : ''} révisé{result.total > 1 ? 's' : ''}
        </p>
      </div>

      <div className="w-full flex flex-col gap-3">
        {result.again > 0 && (
          <button onClick={onRestart} className="w-full rounded-2xl bg-white/10 border border-white/15 py-3 text-sm font-black text-white/80 flex items-center justify-center gap-2">
            <RotateCcw size={15} /> Rejouer les oubliés ({result.again})
          </button>
        )}
        <button onClick={onClose} className="w-full rounded-2xl bg-white py-3 text-sm font-black text-black flex items-center justify-center gap-2">
          <Check size={15} /> Terminer la session
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  /** Si fourni, révise uniquement les cartes dues. Sinon, toutes. */
  dueOnly?: boolean;
}

export default function VerseMemorizationSession({ onClose, dueOnly = true }: Props) {
  const initialCards = useMemo(() => {
    return dueOnly ? memorizationStore.getDueCards() : memorizationStore.getAll();
  }, [dueOnly]);

  const [queue, setQueue] = useState<MemorizationCard[]>(() => [...initialCards]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [result, setResult] = useState<SessionResult>({ again: 0, hard: 0, good: 0, easy: 0, total: 0 });
  const [done, setDone] = useState(false);
  const [failedCards, setFailedCards] = useState<MemorizationCard[]>([]);

  const current = queue[currentIdx];
  const progress = currentIdx / Math.max(queue.length, 1);

  const handleRate = useCallback((q: ReviewRating) => {
    const updated = memorizationStore.review(current.id, q);

    setResult(prev => ({
      again: prev.again + (q === 0 ? 1 : 0),
      hard:  prev.hard  + (q === 1 ? 1 : 0),
      good:  prev.good  + (q === 3 ? 1 : 0),
      easy:  prev.easy  + (q === 5 ? 1 : 0),
      total: prev.total + 1,
    }));

    if (q === 0 && updated) setFailedCards(prev => [...prev, updated]);

    if (currentIdx + 1 >= queue.length) {
      setDone(true);
    } else {
      setCurrentIdx(i => i + 1);
    }
  }, [current, currentIdx, queue.length]);

  const handleRestart = () => {
    setQueue([...failedCards]);
    setCurrentIdx(0);
    setResult({ again: 0, hard: 0, good: 0, easy: 0, total: 0 });
    setFailedCards([]);
    setDone(false);
  };

  if (initialCards.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
        <div className="w-full max-w-lg rounded-[32px] bg-slate-900 p-8 text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h3 className="text-lg font-black text-white">Aucune révision aujourd'hui</h3>
          <p className="text-sm text-white/50 mt-2 mb-6">Tous tes versets sont à jour. Reviens demain !</p>
          <button onClick={onClose} className="w-full rounded-2xl bg-white py-3 text-sm font-black text-black">Fermer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="relative w-full max-w-lg rounded-[32px] bg-gradient-to-b from-slate-800 to-slate-900 p-6 pb-8 shadow-2xl"
        style={{ maxHeight: '92dvh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-xs font-black text-white">Mémorisation</div>
            {!done && (
              <div className="text-[9px] text-white/40 font-bold mt-0.5">
                {currentIdx + 1} / {queue.length}
              </div>
            )}
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {/* Progress bar */}
        {!done && (
          <div className="mb-5 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-amber-400"
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div key="summary" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="h-full">
                <SessionSummary result={result} onClose={onClose} onRestart={handleRestart} />
              </motion.div>
            ) : (
              <motion.div key={current.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="h-full">
                <Flashcard card={current} onRate={handleRate} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
