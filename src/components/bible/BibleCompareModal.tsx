'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

type CompareRow = {
  id: string;
  label: string;
  sourceLabel: string;
  text: string | null;
  error?: string;
};

type BibleCompareModalProps = {
  isOpen: boolean;
  bookName: string;
  chapter: number;
  verseNumber: number | null;
  compareLoading: boolean;
  compareRows: CompareRow[];
  onClose: () => void;
};

export default function BibleCompareModal({
  isOpen,
  bookName,
  chapter,
  verseNumber,
  compareLoading,
  compareRows,
  onClose,
}: BibleCompareModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || verseNumber === null) return null;

  return (
    <div
      className="fixed inset-0 z-[14500] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[85vh] rounded-[40px] border border-white/10 bg-[#161c35] overflow-hidden flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-white/5">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#D4FF33]/80">
              Comparer les versions
            </div>
            <div className="text-2xl font-black text-white">
              {bookName} {chapter}:{verseNumber}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-all ring-1 ring-white/10"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {compareLoading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#D4FF33]/20 border-t-[#D4FF33]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[#D4FF33]">Chargement...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {compareRows.map((row) => (
                <div key={row.id} className="rounded-3xl border border-white/5 bg-white/[0.03] p-6 hover:bg-white/[0.05] transition-colors">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <span className="text-[10px] font-black bg-[#D4FF33] text-black px-2 py-0.5 rounded-lg uppercase tracking-wider">{row.id}</span>
                       <h4 className="text-sm font-bold text-white tracking-wide">{row.label}</h4>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">
                      {row.sourceLabel}
                    </span>
                  </div>
                  {row.text ? (
                    <p className="text-base leading-[1.8] text-white/80 font-medium">
                      {row.text}
                    </p>
                  ) : (
                    <p className="text-sm text-white/40 italic">
                      {row.error
                        ? `Indisponible: ${row.error}`
                        : 'Aucun texte trouvé pour ce verset dans cette traduction.'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with Big Close Button */}
        <div className="p-8 border-t border-white/5 flex justify-center">
            <button 
              onClick={onClose}
              className="px-12 py-4 rounded-2xl bg-surface text-black text-sm font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl active:scale-95"
            >
                Retour à la lecture
            </button>
        </div>
      </div>
    </div>
  );
}
