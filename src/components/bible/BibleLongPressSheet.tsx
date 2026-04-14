'use client';

import {
  BookText,
  Link2,
  NotebookPen,
  Search,
  Share2,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';

type LongPressAction =
  | 'strong'
  | 'refs'
  | 'note'
  | 'compare'
  | 'share'
  | 'pepite'
  | 'mirror';

type BibleLongPressTarget = {
  ref: string;
};

type BibleLongPressSheetProps = {
  target: BibleLongPressTarget | null;
  onClose: () => void;
  onAction: (action: LongPressAction) => void;
  onHighlight: (color: 'yellow' | 'green' | 'pink' | 'blue' | 'orange' | 'purple') => void;
};

const highlightColors: Array<{
  color: 'yellow' | 'green' | 'pink' | 'blue' | 'orange' | 'purple';
  className: string;
  label: string;
}> = [
  {
    color: 'yellow',
    className: 'bg-yellow-400/50 hover:border-yellow-500',
    label: 'Jaune',
  },
  {
    color: 'green',
    className: 'bg-emerald-400/50 hover:border-emerald-500',
    label: 'Vert',
  },
  {
    color: 'blue',
    className: 'bg-sky-400/50 hover:border-sky-500',
    label: 'Bleu',
  },
  {
    color: 'pink',
    className: 'bg-pink-400/50 hover:border-pink-500',
    label: 'Rose',
  },
  {
    color: 'orange',
    className: 'bg-orange-400/50 hover:border-orange-500',
    label: 'Orange',
  },
  {
    color: 'purple',
    className: 'bg-purple-400/50 hover:border-purple-500',
    label: 'Violet',
  },
];

const actions: Array<{
  label: string;
  action: LongPressAction;
  icon: React.ReactNode;
}> = [
  {
    label: 'Comparer',
    action: 'compare',
    icon: <Search size={15} className="text-[color:var(--accent)]" />,
  },
  {
    label: 'Strong',
    action: 'strong',
    icon: <BookText size={15} className="text-[color:var(--accent)]" />,
  },
  {
    label: 'Références',
    action: 'refs',
    icon: <Link2 size={15} className="text-[color:var(--accent)]" />,
  },
  {
    label: 'Prendre note',
    action: 'note',
    icon: <NotebookPen size={15} className="text-[color:var(--accent)]" />,
  },
  {
    label: 'Partager',
    action: 'share',
    icon: <Share2 size={15} className="text-[color:var(--accent)]" />,
  },
  {
    label: 'Pépite',
    action: 'pepite',
    icon: <Sparkles size={15} className="text-[color:var(--accent)]" />,
  },
];

export default function BibleLongPressSheet({
  target,
  onClose,
  onAction,
  onHighlight,
}: BibleLongPressSheetProps) {
  if (!target) return null;

  return (
    <div className="fixed inset-0 z-[14000] flex items-end justify-center bg-black/45 px-4 py-4 backdrop-blur-sm md:items-center md:py-8">
      <div className="bible-paper w-full max-w-xl overflow-hidden rounded-[28px] border border-white/50 bg-white/95 shadow-[0_30px_90px_rgba(0,0,0,0.22)] md:rounded-[32px]">
        <div className="border-b border-slate-200/80 px-5 pb-4 pt-5 md:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-amber-600">
                <Sun size={12} />
                Miroir de grâce
              </div>
              <div className="mt-3 text-xl font-black tracking-tight text-foreground">
                {target.ref}
              </div>
              <p className="mt-1 text-sm text-muted">
                Choisissez une action d’étude ou appliquez un surlignage.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border-soft bg-surface text-muted transition hover:bg-surface-strong hover:text-slate-700"
              aria-label="Fermer"
              title="Fermer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="px-5 py-5 md:px-6">
          <div className="rounded-[24px] border border-amber-200/70 bg-gradient-to-r from-amber-50 via-[#fff8eb] to-amber-100/70 p-4 shadow-sm">
            <button
              type="button"
              onClick={() => onAction('mirror')}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 px-6 py-4 text-sm font-black uppercase tracking-[0.08em] text-white shadow-[0_12px_30px_rgba(245,158,11,0.28)] transition hover:scale-[1.01] active:scale-[0.98]"
            >
              <Sun size={18} />
              Miroir de grâce
            </button>

            <p className="mt-3 text-center text-xs leading-5 text-amber-700/85">
              Accédez rapidement à une lecture orientée identité, grâce et révélation.
            </p>
          </div>

          <div className="mt-5 rounded-[24px] border border-border-soft bg-slate-50/70 p-4">
            <div className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-muted">
              Surligner
            </div>

            <div className="flex flex-wrap gap-3">
              {highlightColors.map((item) => (
                <button
                  key={item.color}
                  type="button"
                  onClick={() => {
                    onHighlight(item.color);
                    onClose();
                  }}
                  className={`group flex items-center gap-2 rounded-full border border-transparent px-3 py-2 transition ${item.className}`}
                  aria-label={`Surligner en ${item.label.toLowerCase()}`}
                  title={item.label}
                >
                  <span className="h-5 w-5 rounded-full border border-white/70 bg-white/40 shadow-sm" />
                  <span className="text-xs font-bold text-slate-700">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-muted">
              Outils
            </div>

            <div className="grid grid-cols-2 gap-3">
              {actions.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onAction(item.action)}
                  className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface px-4 py-3.5 text-left text-sm font-bold text-slate-800 shadow-sm transition hover:-translate-y-[1px] hover:border-slate-300 hover:bg-surface-strong"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[color:var(--accent-soft)]/35">
                    {item.icon}
                  </span>
                  <span className="leading-tight">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
