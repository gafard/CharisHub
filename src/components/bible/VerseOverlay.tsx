'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Sun, X, Search } from 'lucide-react';

interface VerseOverlayProps {
  reference: string;
  content: string;
  onClose?: () => void;
  onOpenInterlinear?: () => void;
  isOwner?: boolean;
}

export default function VerseOverlay({ reference, content, onClose, onOpenInterlinear, isOwner }: VerseOverlayProps) {
  if (!reference || !content) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        className="absolute bottom-24 left-1/2 z-50 w-[90%] max-w-2xl -translate-x-1/2 overflow-hidden rounded-3xl border border-amber-400/30 bg-slate-900/90 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
      >
        <div className="absolute -left-12 -top-12 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute -right-12 -bottom-12 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-amber-500/20 p-1.5 text-amber-300">
                <BookOpen size={14} />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-amber-200/80">
                Méditation Partagée
              </span>
            </div>
            <div className="flex items-center gap-2">
              {onOpenInterlinear && (
                <button
                  onClick={onOpenInterlinear}
                  className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-bold text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                  title="Explorer l'original (Interlinéaire)"
                >
                  <Search size={10} />
                  INTERLINÉAIRE
                </button>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="rounded-full bg-white/5 p-1 text-white/40 hover:bg-white/10 hover:text-white transition-all"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-black tracking-tight text-white">{reference}</h3>
            <p className="text-base font-medium leading-relaxed text-slate-100 line-clamp-4 italic">
              « {content} »
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold text-amber-200/40 border border-white/5">
              <Sparkles size={10} className="text-amber-400" />
              <span>Miroir</span>
            </div>
            <div className="text-[10px] font-medium text-muted italic">
              Données de concordance réelles issues du texte original
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
