'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { BookText, Link2, NotebookPen, Sparkles, X } from 'lucide-react';

export type RadarBubble = {
  id: 'strong' | 'refs' | 'note';
  title: string;
  subtitle?: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
};

export default function BibleStudyRadar({
  open,
  x,
  y,
  refLabel,
  bubbles,
  preferredBubbleId,
  onClose,
}: {
  open: boolean;
  x: number;
  y: number;
  refLabel: string;
  bubbles: RadarBubble[];
  preferredBubbleId?: RadarBubble['id'] | null;
  onClose: () => void;
}) {
  const icons = {
    strong: <BookText size={15} />,
    refs: <Link2 size={15} />,
    note: <NotebookPen size={15} />,
  } as const;

  const slots = [
    { dx: -132, dy: -96 },
    { dx: 0, dy: -148 },
    { dx: 132, dy: -96 },
  ];

  const linePaths = [
    { x1: -18, y1: -20, x2: -88, y2: -68 },
    { x1: 0, y1: -26, x2: 0, y2: -112 },
    { x1: 18, y1: -20, x2: 88, y2: -68 },
  ];

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[16000] bg-[rgba(3,6,18,0.52)] backdrop-blur-[8px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
          onTouchStart={onClose}
        >
          <div
            className="absolute"
            style={{
              left: x,
              top: y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <motion.div
              className="relative"
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            >
              {/* halo */}
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/10 blur-3xl" />
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400/8 blur-2xl" />

              {/* radial lines */}
              <svg
                className="pointer-events-none absolute left-1/2 top-1/2 overflow-visible"
                width="1"
                height="1"
                viewBox="-160 -170 320 220"
                style={{ transform: 'translate(-50%, -50%)' }}
              >
                {linePaths.map((line, index) => (
                  <line
                    key={index}
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke="rgba(255,255,255,0.16)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                ))}
              </svg>

              {/* centre */}
              <div className="relative flex h-[82px] w-[82px] items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl">
                <div className="absolute inset-[8px] rounded-full border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),rgba(255,255,255,0.04))]" />
                <div className="absolute inset-0 rounded-full shadow-[0_0_0_12px_rgba(255,255,255,0.05),0_0_0_24px_rgba(255,255,255,0.025)]" />
                <div className="relative z-10 flex flex-col items-center justify-center">
                  <Sun size={15} className="text-amber-300" />
                  <span className="mt-1 text-[9px] font-black uppercase tracking-[0.22em] text-white/80">
                    Étude
                  </span>
                </div>
              </div>
            </motion.div>

            {/* label du verset */}
            <motion.div
              className="pointer-events-none mt-3 text-center"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.06 }}
            >
              <div className="inline-flex items-center rounded-full border border-white/12 bg-black/35 px-3 py-1.5 text-[11px] font-extrabold text-white/90 shadow-lg backdrop-blur-md">
                {refLabel}
              </div>
            </motion.div>

            {/* close */}
            <button
              type="button"
              className="absolute -right-3 -top-3 grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/55 text-white/80 shadow-lg transition hover:bg-black/70 hover:text-white"
              onMouseDown={(event) => event.stopPropagation()}
              onTouchStart={(event) => event.stopPropagation()}
              onClick={onClose}
              aria-label="Fermer"
            >
              <X size={15} />
            </button>

            {/* bubbles */}
            {bubbles.slice(0, 3).map((bubble, index) => {
              const slot = slots[index] ?? slots[0];
              const isPreferred = preferredBubbleId === bubble.id && !bubble.disabled;

              return (
                <motion.button
                  key={bubble.id}
                  type="button"
                  disabled={bubble.disabled}
                  className={[
                    'absolute rounded-[22px] border px-3.5 py-3 text-left shadow-[0_22px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl transition',
                    bubble.disabled
                      ? 'cursor-not-allowed border-white/8 bg-white/8 text-white/50 opacity-45'
                      : isPreferred
                        ? 'border-amber-300/45 bg-[linear-gradient(180deg,rgba(255,214,102,0.18),rgba(255,255,255,0.10))] text-white ring-1 ring-amber-300/30'
                        : 'border-white/14 bg-white/12 text-white hover:bg-white/18 hover:border-white/22',
                  ].join(' ')}
                  style={{
                    width: 182,
                    transform: `translate(${slot.dx}px, ${slot.dy}px)`,
                  }}
                  initial={{ opacity: 0, scale: 0.88, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{
                    type: 'spring',
                    stiffness: 520,
                    damping: 34,
                    delay: 0.04 * index,
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                  onTouchStart={(event) => event.stopPropagation()}
                  onClick={() => {
                    if (!bubble.disabled) void bubble.onClick();
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={[
                        'grid h-10 w-10 shrink-0 place-items-center rounded-2xl border',
                        isPreferred
                          ? 'border-amber-200/35 bg-amber-300/12 text-amber-100'
                          : 'border-white/12 bg-white/10 text-white/90',
                      ].join(' ')}
                    >
                      {icons[bubble.id]}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold tracking-tight">
                        {bubble.title}
                      </div>
                      {bubble.subtitle ? (
                        <div className="mt-0.5 truncate text-[11px] text-white/65">
                          {bubble.subtitle}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {isPreferred ? (
                    <div className="mt-2 inline-flex rounded-full border border-amber-200/20 bg-amber-300/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-amber-100/90">
                      recommandé
                    </div>
                  ) : null}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
