'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  BookText,
  Copy,
  Highlighter,
  Link2,
  NotebookPen,
  Sparkles,
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
      className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-0 py-2 text-xs font-extrabold text-white/90 transition hover:bg-white/15 sm:h-auto sm:w-auto sm:justify-start sm:px-3"
      title={hint || label}
      aria-label={label}
    >
      <span className="opacity-90">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export default function BibleStudyBar({
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
  onHuios,
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
  onHuios: () => void;
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
          className="pointer-events-none fixed inset-x-0 z-[22000] px-2 sm:px-3"
          style={{ bottom: 'calc(92px + env(safe-area-inset-bottom))', transform: 'translateZ(0)' }}
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 520, damping: 34 }}
        >
          <div className="pointer-events-auto mx-auto max-h-[66vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-white/12 bg-black/85 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:max-h-none sm:bg-black/60">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/65 sm:text-[11px] sm:tracking-[0.22em]">
                  Verset sélectionné
                </div>
                <div className="flex items-center gap-2">
                  <div className="truncate text-[13px] font-extrabold text-white sm:text-sm">{refLabel}</div>
                  {hasNote ? (
                    <span className="rounded-full bg-white/12 px-2 py-0.5 text-[10px] font-extrabold text-white/80">
                      note
                    </span>
                  ) : null}
                  {refsCount > 0 ? (
                    <span className="rounded-full bg-white/12 px-2 py-0.5 text-[10px] font-extrabold text-white/80">
                      {refsCount} refs
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 hidden text-xs text-white/70 sm:line-clamp-1 sm:block">
                  {verseText}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/10 text-white/80 transition hover:bg-white/15"
                aria-label="Fermer"
                title="Fermer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[46vh] overflow-y-auto p-3 sm:max-h-none sm:overflow-visible">
              <div className="grid grid-cols-6 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
                <button
                  onClick={onVisionClick}
                  className="flex flex-col items-center gap-1.5 group"
                  title="Miroir de Grâce ✨"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100/10 to-slate-100/5 border border-white/10 flex items-center justify-center group-hover:bg-amber-400 group-hover:text-black transition-all duration-300 shadow-lg group-active:scale-95 group-hover:border-amber-400/50 group-hover:shadow-amber-400/20">
                    <Sparkles size={20} className={showAIVision ? "text-amber-400" : "text-slate-400 group-hover:text-black"} />
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 group-hover:text-amber-400 transition-colors">Miroir de Grâce</span>
                </button>
                <ActionChip label="Strong" onClick={onStrong} icon={<BookText size={14} />} />
                <ActionChip label="Réfs" onClick={onRefs} icon={<Link2 size={14} />} hint="Références croisées" />
                <ActionChip
                  label="Surligner"
                  onClick={onHighlight}
                  icon={
                    <span className="flex items-center gap-2">
                      <Highlighter size={14} />
                      <span className={`h-2.5 w-2.5 rounded-full ${colorDot[highlightColor]}`} />
                    </span>
                  }
                />
                <ActionChip label={hasNote ? 'Note' : 'Ajouter note'} onClick={onNote} icon={<NotebookPen size={14} />} />
                <ActionChip label="Comparer" onClick={onCompare} icon={<SplitSquareHorizontal size={14} />} />
                <ActionChip label="Copier" onClick={onCopy} icon={<Copy size={14} />} />
              </div>

              <div className="mt-3 hidden border-t border-white/10 pt-3 sm:block">
                <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/60">
                  Mots Strong du verset
                </div>
                {strongLoading ? (
                  <div className="text-xs text-white/70">Chargement...</div>
                ) : strongTokens.length > 0 ? (
                  <div className="flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                    {strongTokens.slice(0, 10).map((token, index) => (
                      <button
                        key={`${token.strong}-${index}`}
                        type="button"
                        onClick={() => onStrongToken?.(token.strong)}
                        className="shrink-0 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/90 transition hover:bg-white/18"
                        title={`${token.w} (${token.strong})`}
                      >
                        {token.w}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-white/65">Aucun mot Strong détecté.</div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  , document.body);
}
