'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  BookText,
  BookOpen,
  Copy,
  Highlighter,
  Link2,
  NotebookPen,
  Star,
  SplitSquareHorizontal,
  X,
} from 'lucide-react';
import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type HighlightColor = 'yellow' | 'green' | 'pink' | 'blue' | 'orange' | 'purple';

type StudyStrongToken = {
  w: string;
  strong: string;
};

function ActionChip({
  label,
  icon,
  onClick,
  hint,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint || label}
      aria-label={label}
      className="
        group flex h-11 items-center justify-center gap-2 rounded-2xl
        border border-white/10 bg-white/[0.05] px-3
        text-xs font-extrabold text-white/85
        transition-all duration-200
        hover:border-white/20 hover:bg-white/[0.09] hover:text-white
        active:scale-[0.98]
      "
    >
      <span className="opacity-80 transition group-hover:opacity-100">{icon}</span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
      {children}
    </div>
  );
}

export default function BibleMeditationBar({
  open,
  refLabel,
  verseText,
  hasNote,
  refsCount,
  highlightColor,
  onClose,
  onStrong,
  onRefs,
  onHighlight,
  onNote,
  onCompare,
  onCopy,
  onMirror,
  onLectio,
  onMemorize,
  isMemorized,
  strongTokens,
  strongLoading,
  onStrongToken,
}: {
  open: boolean;
  refLabel: string;
  verseText: string;
  hasNote: boolean;
  refsCount: number;
  highlightColor: HighlightColor;
  onClose: () => void;
  onStrong: () => void;
  onRefs: () => void;
  onHighlight: () => void;
  onNote: () => void;
  onCompare: () => void;
  onCopy: () => void;
  onMirror: () => void;
  onLectio?: () => void;
  onMemorize?: () => void;
  isMemorized?: boolean;
  strongTokens: StudyStrongToken[];
  strongLoading?: boolean;
  onStrongToken?: (strong: string) => void;
}) {
  const colorDot: Record<HighlightColor, string> = {
    yellow: 'bg-yellow-300',
    green: 'bg-green-300',
    pink: 'bg-pink-300',
    blue: 'bg-blue-300',
    orange: 'bg-orange-300',
    purple: 'bg-violet-300',
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="pointer-events-none fixed inset-x-0 z-[22000] px-3 sm:px-4"
          style={{ bottom: 'calc(92px + env(safe-area-inset-bottom))' }}
          initial={{ y: 28, opacity: 0, scale: 0.985 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 24, opacity: 0, scale: 0.99 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        >
          <div
            className="
              pointer-events-auto mx-auto w-full max-w-4xl overflow-hidden rounded-[32px]
              border border-white/10
              bg-[linear-gradient(180deg,rgba(18,22,38,0.96),rgba(8,10,20,0.96))]
              shadow-[0_30px_100px_rgba(0,0,0,0.5)]
              backdrop-blur-2xl
            "
          >
            <div className="pointer-events-none absolute inset-0" />

            {/* halo */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.14),transparent_62%)]" />
            <div className="pointer-events-none absolute -left-16 top-10 h-44 w-44 rounded-full bg-amber-400/8 blur-3xl" />
            <div className="pointer-events-none absolute -right-16 bottom-0 h-40 w-40 rounded-full bg-blue-400/8 blur-3xl" />

            {/* Header */}
            <div className="relative border-b border-white/8 px-4 py-4 sm:px-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/15 bg-amber-300/8 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/90">
                    <Star size={11} />
                    Lecture & discernement
                  </div>


                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <div className="truncate text-base font-black tracking-tight text-white sm:text-[1.05rem]">
                      {refLabel}
                    </div>

                    {hasNote ? (
                      <span className="rounded-full border border-emerald-400/15 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-200">
                        note
                      </span>
                    ) : null}

                    {refsCount > 0 ? (
                      <span className="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/70">
                        {refsCount} réf{refsCount > 1 ? 's' : ''}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 max-w-3xl line-clamp-2 text-sm leading-6 text-white/58">
                    {verseText}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="
                    grid h-10 w-10 shrink-0 place-items-center rounded-full
                    border border-white/10 bg-white/[0.06]
                    text-white/70 transition-all
                    hover:bg-white/[0.12] hover:text-white
                  "
                  aria-label="Fermer"
                  title="Fermer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="relative p-4 sm:p-5">
              {/* bloc principal */}
              <div
                className="
                  mb-4 overflow-hidden rounded-[24px]
                  border border-amber-300/12
                  bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(255,255,255,0.03)_48%,rgba(255,255,255,0.02))]
                "
              >
                <button
                  type="button"
                  onClick={onMirror}
                  className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/[0.03] sm:px-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="
                        grid h-12 w-12 shrink-0 place-items-center rounded-2xl
                        bg-[linear-gradient(135deg,#fbbf24,#f59e0b)]
                        text-slate-950
                        shadow-[0_10px_30px_rgba(245,158,11,0.28)]
                      "
                    >
                      <Star size={18} />
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-black tracking-tight text-white sm:text-base">
                        Miroir de Grâce
                      </div>
                      <div className="mt-0.5 text-xs leading-5 text-amber-100/68 sm:text-sm">
                        Voir ce verset à travers l’identité, la grâce, la maturité et la révélation.
                      </div>
                    </div>
                  </div>

                  <div className="hidden shrink-0 rounded-full border border-amber-300/18 bg-white/8 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-100/90 sm:block">
                    ouvrir
                  </div>
                </button>
              </div>

              {/* Lectio Divina */}
              {onLectio && (
                <div
                  className="
                    mb-4 overflow-hidden rounded-[24px]
                    border border-emerald-300/12
                    bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(255,255,255,0.03)_48%,rgba(255,255,255,0.02))]
                  "
                >
                  <button
                    type="button"
                    onClick={onLectio}
                    className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/[0.03] sm:px-5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="
                          grid h-12 w-12 shrink-0 place-items-center rounded-2xl
                          bg-[linear-gradient(135deg,#10b981,#059669)]
                          text-white
                          shadow-[0_10px_30px_rgba(16,185,129,0.28)]
                        "
                      >
                        <BookOpen size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-black tracking-tight text-white sm:text-base">
                          Lectio Divina
                        </div>
                        <div className="mt-0.5 text-xs leading-5 text-emerald-100/68 sm:text-sm">
                          Lectio · Meditatio · Oratio · Contemplatio
                        </div>
                      </div>
                    </div>
                    <div className="hidden shrink-0 rounded-full border border-emerald-300/18 bg-white/8 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100/90 sm:block">
                      entrer
                    </div>
                  </button>
                </div>
              )}

              {/* actions */}
              <div>
                <SectionLabel>Actions rapides</SectionLabel>

                <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                  <ActionChip
                    label="Strong"
                    onClick={onStrong}
                    icon={<BookText size={15} />}
                  />
                  <ActionChip
                    label="Références"
                    onClick={onRefs}
                    icon={<Link2 size={15} />}
                    hint="Références croisées"
                  />
                  <ActionChip
                    label="Surligner"
                    onClick={onHighlight}
                    icon={
                      <span className="flex items-center gap-2">
                        <Highlighter size={15} />
                        <span className={`h-2.5 w-2.5 rounded-full ${colorDot[highlightColor]}`} />
                      </span>
                    }
                  />
                  <ActionChip
                    label={hasNote ? 'Note' : 'Ajouter note'}
                    onClick={onNote}
                    icon={<NotebookPen size={15} />}
                  />
                  <ActionChip
                    label="Comparer"
                    onClick={onCompare}
                    icon={<SplitSquareHorizontal size={15} />}
                  />
                  <ActionChip
                    label="Copier"
                    onClick={onCopy}
                    icon={<Copy size={15} />}
                  />
                  {onMemorize && (
                    <ActionChip
                      label={isMemorized ? 'Mémorisé ✓' : 'Mémoriser'}
                      onClick={onMemorize}
                      icon={<BookOpen size={15} />}
                    />
                  )}
                </div>
              </div>

              {/* strong */}
              <div className="mt-5 rounded-[24px] border border-white/8 bg-white/[0.035] p-3.5 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <SectionLabel>Mots Strong du verset</SectionLabel>
                  {strongTokens.length > 0 && !strongLoading ? (
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
                      {Math.min(strongTokens.length, 12)} affichés
                    </div>
                  ) : null}
                </div>

                {strongLoading ? (
                  <div className="mt-3 text-xs text-white/58">Chargement...</div>
                ) : strongTokens.length > 0 ? (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
                    {strongTokens.slice(0, 12).map((token, index) => (
                      <button
                        key={`${token.strong}-${index}`}
                        type="button"
                        onClick={() => onStrongToken?.(token.strong)}
                        title={`${token.w} (${token.strong})`}
                        className="
                          shrink-0 rounded-full border border-white/10 bg-white/[0.07]
                          px-3 py-1.5 text-[11px] font-bold text-white/86
                          transition hover:border-white/18 hover:bg-white/[0.12] hover:text-white
                        "
                      >
                        {token.w}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-white/50">
                    Aucun mot Strong détecté.
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
