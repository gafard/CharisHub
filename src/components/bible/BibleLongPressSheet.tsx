'use client';

import { BookText, Link2, NotebookPen, Search, Share2, Sparkles, X } from 'lucide-react';

type LongPressAction = 'strong' | 'refs' | 'note' | 'compare' | 'share' | 'huios' | 'pepite';

type BibleLongPressTarget = {
  ref: string;
};

type BibleLongPressSheetProps = {
  target: BibleLongPressTarget | null;
  onClose: () => void;
  onAction: (action: LongPressAction) => void;
  onHighlight: (color: 'yellow' | 'green' | 'pink' | 'blue' | 'orange' | 'purple') => void;
};

export default function BibleLongPressSheet({
  target,
  onClose,
  onAction,
  onHighlight,
}: BibleLongPressSheetProps) {
  if (!target) return null;

  return (
    <div className="fixed inset-0 z-[14000] flex items-end justify-center bg-black/40 px-4 py-4 backdrop-blur-sm md:items-center md:py-8">
      <div className="bible-paper max-h-[82vh] w-full max-w-xl overflow-y-auto rounded-[28px] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.28)] md:max-h-[76vh] md:rounded-[32px] md:p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-amber-500 font-bold">
              <Sparkles size={12} className="animate-pulse" />
              TON IDENTITÉ
            </div>
            <div className="font-bold text-lg">{target.ref}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon h-9 w-9 bg-white/80"
            aria-label="Fermer"
            title="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        {/* --- Section Surlignage (Couleurs) --- */}
        <div className="mt-4 flex items-center gap-3">
          <div className="text-xs font-semibold opacity-60">Surligner:</div>
          <div className="flex flex-1 items-center justify-between">
            {/* Jaune */}
            <button
              onClick={() => { onHighlight('yellow'); onClose(); }}
              className="h-8 w-8 rounded-full border-2 border-transparent bg-yellow-400/40 hover:border-yellow-400/80 transition-colors"
              aria-label="Surligner en jaune"
            />
            {/* Vert */}
            <button
              onClick={() => { onHighlight('green'); onClose(); }}
              className="h-8 w-8 rounded-full border-2 border-transparent bg-emerald-400/40 hover:border-emerald-400/80 transition-colors"
              aria-label="Surligner en vert"
            />
            {/* Bleu */}
            <button
              onClick={() => { onHighlight('blue'); onClose(); }}
              className="h-8 w-8 rounded-full border-2 border-transparent bg-sky-400/40 hover:border-sky-400/80 transition-colors"
              aria-label="Surligner en bleu"
            />
            {/* Rose */}
            <button
              onClick={() => { onHighlight('pink'); onClose(); }}
              className="h-8 w-8 rounded-full border-2 border-transparent bg-pink-400/40 hover:border-pink-400/80 transition-colors"
              aria-label="Surligner en rose"
            />
            {/* Orange */}
            <button
              onClick={() => { onHighlight('orange'); onClose(); }}
              className="h-8 w-8 rounded-full border-2 border-transparent bg-orange-400/40 hover:border-orange-400/80 transition-colors"
              aria-label="Surligner en orange"
            />
            {/* Violet */}
            <button
              onClick={() => { onHighlight('purple'); onClose(); }}
              className="h-8 w-8 rounded-full border-2 border-transparent bg-purple-400/40 hover:border-purple-400/80 transition-colors"
              aria-label="Surligner en violet"
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 pb-2">
          <button
            onClick={() => onAction('huios')}
            className="col-span-2 flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 px-6 py-4 text-sm font-black text-white shadow-lg shadow-amber-500/20 active:scale-95 transition-transform"
          >
            <Sparkles size={18} />
            VISION CHARIS ✨
          </button>

          {[
            { label: 'Pépite', icon: <Sparkles size={14} className="text-amber-500" />, action: 'pepite' as const },
            { label: 'Comparer', icon: <Search size={14} className="accent-text" />, action: 'compare' as const },
            { label: 'Strong', icon: <BookText size={14} className="accent-text" />, action: 'strong' as const },
            { label: 'Références', icon: <Link2 size={14} className="accent-text" />, action: 'refs' as const },
            { label: 'Prendre note', icon: <NotebookPen size={14} className="accent-text" />, action: 'note' as const },
            { label: 'Partager', icon: <Share2 size={14} className="accent-text" />, action: 'share' as const },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onAction(item.action)}
              className="btn-base btn-secondary flex items-center gap-2 rounded-xl border border-slate-200 bg-white/50 px-3 py-3.5 text-xs font-bold hover:bg-white transition-all shadow-sm"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
