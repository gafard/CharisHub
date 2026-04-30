'use client';

import { useState, useEffect } from 'react';
import { X, BookOpen, Search, Info, ExternalLink } from 'lucide-react';
import logger from '@/lib/logger';

// Types pour les données interlinéaires réelles
interface InterlinearWord {
  original: string;
  transliteration: string;
  strongNumber: string;
  translation: string;
  morphology?: string;
  phonetic?: string;
  definition?: string;
}

interface InterlinearVerse {
  verse: number;
  text: string;
  words: InterlinearWord[];
}

const InterlinearViewer = ({ 
  isOpen, 
  onClose, 
  bookId,
  chapter,
  verse,
  onStrongSelect
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  bookId: string;
  chapter: number;
  verse: number;
  onStrongSelect?: (strong: string) => void;
}) => {
  const [interlinearData, setInterlinearData] = useState<InterlinearVerse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);

  // Chargement des données interlinéaires réelles via l'API SQL
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);
    setSelectedWordIndex(null);

    const loadData = async () => {
      try {
        const url = `/api/bible/interlinear?bookId=${bookId}&chapter=${chapter}&verse=${verse}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load interlinear data');
        const data = await res.json();
        
        const formatted: InterlinearVerse = {
          verse: data.verse,
          text: data.text,
          words: data.words.filter((w: any) => w.strongNumber).map((w: any) => ({
            original: w.original,
            transliteration: w.transliteration,
            strongNumber: w.strongNumber,
            translation: w.translation,
            morphology: w.morphology,
            phonetic: w.phonetic,
            definition: w.definition
          }))
        };

        setInterlinearData(formatted);
      } catch (err) {
        setError("Impossible de charger les données interlinéaires pour ce verset.");
        logger.error('[InterlinearViewer] Load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, bookId, chapter, verse]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-[3px] flex items-center justify-center z-[15000] p-2 md:p-4"
      onMouseDown={onClose}
    >
      <div
        className="bible-paper rounded-[2rem] w-full max-w-5xl max-h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col text-foreground shadow-2xl border border-white/10"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b border-black/5 dark:border-white/5 bg-white/5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <BookOpen size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-foreground">
                Analyse Interlinéaire
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">
                Sources Originales & Concordance
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="h-10 w-10 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-all text-foreground/50 hover:text-foreground"
            aria-label="Fermer"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 border-b border-black/5 dark:border-white/5 bg-amber-50/30 dark:bg-black/20">
          <div className="text-center">
            <h3 className="text-2xl font-black text-foreground mb-1">
              {bookId} {chapter}:{verse}
            </h3>
            <p className="text-sm font-medium text-foreground/60 max-w-2xl mx-auto italic">
              {interlinearData?.text ? `« ${interlinearData.text} »` : "Chargement du texte..."}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          {loading && (
            <div className="flex flex-col justify-center items-center h-64 gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
              <p className="text-sm font-bold text-amber-500/60 animate-pulse">Extraction des racines originales...</p>
            </div>
          )}

          {error && !loading && (
            <div className="bg-red-500/10 text-red-500 rounded-2xl p-8 text-center border border-red-500/20 font-bold">
              {error}
            </div>
          )}

          {!loading && !error && interlinearData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Table d'analyse (2/3) */}
                <div className="lg:col-span-2 overflow-x-auto rounded-2xl border border-black/5 dark:border-white/5 shadow-sm">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-white/5">
                        <th className="p-4 text-left text-[10px] font-black uppercase tracking-wider text-foreground/40 border-b border-black/5 dark:border-white/5">Lexique</th>
                        <th className="p-4 text-left text-[10px] font-black uppercase tracking-wider text-foreground/40 border-b border-black/5 dark:border-white/5">Strong</th>
                        <th className="p-4 text-left text-[10px] font-black uppercase tracking-wider text-foreground/40 border-b border-black/5 dark:border-white/5">Français</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                      {interlinearData.words.map((word, index) => (
                        <tr 
                          key={`${word.strongNumber}-${index}`} 
                          onClick={() => setSelectedWordIndex(index)}
                          className={`cursor-pointer transition-all duration-200 ${selectedWordIndex === index ? 'bg-amber-500/10' : 'hover:bg-white/5'}`}
                        >
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className={`text-2xl font-black mb-1 ${word.strongNumber.startsWith('H') ? 'font-hebrew' : 'font-greek'}`}>
                                {word.original}
                              </span>
                              <span className="text-[10px] font-bold text-amber-600/80 uppercase tracking-tighter">
                                {word.transliteration}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onStrongSelect) onStrongSelect(word.strongNumber);
                              }}
                              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 border border-black/5 dark:border-white/5 text-[11px] font-black text-muted hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-all"
                            >
                              {word.strongNumber}
                              <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-foreground">
                                {word.translation}
                              </span>
                              {word.morphology && (
                                <span className="text-[9px] font-mono opacity-40">
                                  [{word.morphology}]
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Détails du mot sélectionné (1/3) */}
                <div className="lg:col-span-1">
                  <div className="sticky top-0 space-y-4">
                    {selectedWordIndex !== null ? (
                      <div className="glass-panel p-5 rounded-3xl border border-amber-500/20 bg-amber-500/5 shadow-xl animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center gap-2 mb-4">
                          <Info size={16} className="text-amber-500" />
                          <h4 className="text-sm font-black uppercase tracking-wider text-amber-500">Détails de l'analyse</h4>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] font-black text-foreground/40 uppercase mb-1">Translittération</p>
                            <p className="text-lg font-bold text-amber-600">{interlinearData.words[selectedWordIndex].transliteration}</p>
                            {interlinearData.words[selectedWordIndex].phonetic && (
                              <p className="text-xs italic opacity-60">/{interlinearData.words[selectedWordIndex].phonetic}/</p>
                            )}
                          </div>

                          {interlinearData.words[selectedWordIndex].definition && (
                            <div>
                              <p className="text-[10px] font-black text-foreground/40 uppercase mb-1">Définition courte</p>
                              <div 
                                className="text-sm leading-relaxed text-foreground/80 line-clamp-6"
                                dangerouslySetInnerHTML={{ __html: interlinearData.words[selectedWordIndex].definition! }}
                              />
                            </div>
                          )}

                          <button 
                            onClick={() => onStrongSelect && onStrongSelect(interlinearData.words[selectedWordIndex].strongNumber)}
                            className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-amber-500/20 transition-all active:scale-95"
                          >
                            <Search size={16} />
                            Fiche concordance complète
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-64 p-8 text-center border-2 border-dashed border-black/5 dark:border-white/5 rounded-3xl opacity-40">
                        <Info size={32} className="mb-4" />
                        <p className="text-sm font-bold">Sélectionnez un mot dans le tableau pour voir son analyse détaillée.</p>
                      </div>
                    )}

                    <div className="p-5 rounded-3xl bg-blue-500/5 border border-blue-500/10">
                      <h4 className="font-black text-[10px] uppercase text-blue-500 mb-2 tracking-widest">Aide à l'étude</h4>
                      <p className="text-[11px] leading-relaxed opacity-70">
                        Chaque mot original est lié à sa racine racine lexicale. Les numéros en crochets [] indiquent la morphologie (personne, temps, mode, genre).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-black/5 dark:border-white/5 text-[10px] font-bold text-foreground/30 text-center uppercase tracking-[0.2em] bg-white/5">
          Outil de Formation Biblique Intégré - Données Lexicographiques Réelles
        </div>
      </div>
    </div>
  );
};

export default InterlinearViewer;

