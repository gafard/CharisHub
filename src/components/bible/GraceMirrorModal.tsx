'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Heart,
  Shield,
  Star,
  X,
} from 'lucide-react';
import { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface GraceMirrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  loading: boolean;
  error: string | null;
  reference: string;
}

function FooterBadge({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/82 backdrop-blur-xl">
      <span className="text-amber-300">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

export default function GraceMirrorModal({
  isOpen,
  onClose,
  content,
  loading,
  error,
  reference,
}: GraceMirrorModalProps) {
  // Verrouiller le scroll du body quand le modal est ouvert
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  // Fermeture par touche Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-[15000] flex items-center justify-center p-4 sm:p-6">
          <motion.button
            type="button"
            aria-label="Fermer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[rgba(5,8,20,0.86)] backdrop-blur-xl"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.965, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.975, y: 12 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-[34px] border border-amber-300/20 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] shadow-[0_40px_120px_rgba(0,0,0,0.65)] ring-1 ring-white/8"
          >
            {/* Background glow layers */}
            <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-amber-400/12 blur-[110px]" />
            <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-sky-400/10 blur-[110px]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_70%)]" />

            <div className="relative flex max-h-[88vh] flex-col">
              {/* Header */}
              <div className="border-b border-white/8 bg-white/[0.03] px-5 py-5 backdrop-blur-2xl sm:px-7 sm:py-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 rounded-2xl bg-amber-400/20 blur-xl" />
                      <div className="relative grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/20 bg-amber-400/10 text-amber-300">
                        <Star size={24} />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-300/72">
                        Miroir de Grâce
                      </div>
                      <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-white sm:text-[2rem]">
                        Éclairage d’identité
                      </h2>
                      <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-bold text-white/72">
                        <Star size={12} className="text-amber-300" />
                        <span className="truncate">{reference}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/56 transition hover:bg-white/[0.08] hover:text-white active:scale-95"
                    aria-label="Fermer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7 sm:py-7">
                <div className="mx-auto max-w-3xl">
                  {loading ? (
                    <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                      <div className="relative mb-8">
                        <div className="absolute inset-0 rounded-full bg-amber-400/18 blur-3xl" />
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                          className="relative grid h-24 w-24 place-items-center rounded-full border border-dashed border-amber-300/30 bg-amber-400/6"
                        >
                          <Star size={34} className="text-amber-300" />
                        </motion.div>
                      </div>

                      <div className="text-[11px] font-black uppercase tracking-[0.28em] text-amber-300/72">
                        Révélation en cours
                      </div>
                      <div className="mt-3 text-2xl font-black tracking-[-0.04em] text-white">
                        La lumière se pose sur ce verset...
                      </div>
                      <div className="mt-3 max-w-md text-sm leading-7 text-white/50">
                        Reçois une lecture orientée grâce, identité et position en Christ.
                      </div>
                    </div>
                  ) : error ? (
                    <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
                      <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-rose-400/20 bg-rose-400/10 text-rose-300">
                        <AlertCircle size={28} />
                      </div>
                      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-rose-300/72">
                        Éclairage indisponible
                      </div>
                      <div className="mt-3 max-w-lg text-sm leading-7 text-white/55">
                        Une erreur a empêché l’ouverture du miroir pour ce passage.
                      </div>
                      <div className="mt-4 max-w-lg rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-left font-mono text-[11px] text-white/40">
                        {error}
                      </div>
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="
                        prose prose-invert max-w-none
                        prose-headings:mb-3 prose-headings:mt-7 prose-headings:text-amber-300 prose-headings:font-black prose-headings:tracking-[-0.03em]
                        prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
                        prose-p:text-[15px] prose-p:leading-8 prose-p:text-white/88
                        prose-strong:text-amber-200
                        prose-em:text-white/74
                        prose-ul:text-white/84
                        prose-ol:text-white/84
                        prose-li:my-1
                        prose-blockquote:border-l-amber-300/50 prose-blockquote:bg-white/[0.03] prose-blockquote:px-4 prose-blockquote:py-3 prose-blockquote:rounded-r-2xl prose-blockquote:text-white/80
                        prose-hr:border-white/8
                        prose-a:text-amber-300
                      "
                    >
                      <ReactMarkdown>{content}</ReactMarkdown>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Footer */}
              {!loading && !error ? (
                <div className="border-t border-white/8 bg-white/[0.03] px-5 py-5 backdrop-blur-2xl sm:px-7">
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <FooterBadge icon={<Heart size={12} className="fill-current" />} label="Amour reçu" />
                    <FooterBadge icon={<Shield size={12} />} label="Position assurée" />
                    <FooterBadge icon={<Star size={12} />} label="Grâce révélée" />
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
