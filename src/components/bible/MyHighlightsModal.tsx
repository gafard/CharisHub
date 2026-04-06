'use client';

import { X, Search, BookOpen, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BIBLE_BOOKS, getBookById } from '../../lib/bibleCatalog';

export type HighlightColor = 'yellow' | 'green' | 'pink' | 'blue' | 'orange' | 'purple';
export type HighlightMap = Record<number, HighlightColor>;

interface MyHighlightsModalProps {
    isOpen: boolean;
    onClose: () => void;
    highlights: Record<string, HighlightMap>;
    onNavigate: (bookId: string, chapter: number, verse: number) => void;
    onRemoveHighlight: (referenceKey: string, verseNumber: number) => void;
}

export default function MyHighlightsModal({
    isOpen,
    onClose,
    highlights,
    onNavigate,
    onRemoveHighlight,
}: MyHighlightsModalProps) {
    const [search, setSearch] = useState('');

    // Convert the nested Record<string, HighlightMap> into a flat array of highlights
    const flatHighlights = useMemo(() => {
        const arr: Array<{
            bookId: string;
            bookName: string;
            chapter: number;
            verse: number;
            color: HighlightColor;
            refKey: string;
            displayRef: string;
        }> = [];

        Object.entries(highlights).forEach(([refKey, map]) => {
            // refKey format can be "LSG:gen:1" or legacy "LSG-gen-1"
            const parts = refKey.includes(':') ? refKey.split(':') : refKey.split('-');
            if (parts.length >= 3) {
                const bookId = parts[1];
                const chapter = parseInt(parts[2], 10);
                const book = getBookById(bookId);

                if (book) {
                    Object.entries(map).forEach(([verseStr, color]) => {
                        const verse = parseInt(verseStr, 10);
                        arr.push({
                            bookId,
                            bookName: book.name,
                            chapter,
                            verse,
                            color,
                            refKey,
                            displayRef: `${book.name} ${chapter}:${verse}`,
                        });
                    });
                }
            }
        });

        // Sort by book order, then chapter, then verse
        return arr.sort((a, b) => {
            const bookAIndex = BIBLE_BOOKS.findIndex((bk) => bk.id === a.bookId);
            const bookBIndex = BIBLE_BOOKS.findIndex((bk) => bk.id === b.bookId);
            if (bookAIndex !== bookBIndex) return bookAIndex - bookBIndex;
            if (a.chapter !== b.chapter) return a.chapter - b.chapter;
            return a.verse - b.verse;
        });
    }, [highlights]);

    const filteredHighlights = useMemo(() => {
        const lowerSearch = search.toLowerCase();
        return flatHighlights.filter((h) => h.displayRef.toLowerCase().includes(lowerSearch));
    }, [flatHighlights, search]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[15000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full h-[85vh] sm:h-auto sm:max-h-[85vh] sm:max-w-2xl bg-[#0a0a0a] border border-white/10 sm:rounded-3xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 duration-300 shadow-2xl">

                <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between bg-[#121212]">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-[#d9f94a]/10 flex items-center justify-center text-[#d9f94a]">
                            <BookOpen size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">Mes Surlignages</h2>
                            <p className="text-xs text-white/50">{flatHighlights.length} verset(s) sauvegardé(s)</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 border-b border-white/10 bg-[#0a0a0a]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                        <input
                            type="text"
                            placeholder="Rechercher un livre, un chapitre..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#d9f94a]/50 focus:ring-1 focus:ring-[#d9f94a]/50 transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {filteredHighlights.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                            <BookOpen size={48} className="mb-4 text-white/20" />
                            <p className="text-lg font-semibold text-white mb-1">Aucun surlignage</p>
                            <p className="text-sm text-white/60">
                                {search ? 'Aucun résultat pour cette recherche.' : 'Surlignez des versets pendant votre lecture pour les retrouver ici.'}
                            </p>
                        </div>
                    ) : (
                        filteredHighlights.map((highlight, idx) => {
                            // Map color names to Tailwind background classes for the dot indicator
                            const colorMaps: Record<HighlightColor, string> = {
                                yellow: 'bg-yellow-400',
                                green: 'bg-emerald-400',
                                pink: 'bg-pink-400',
                                blue: 'bg-sky-400',
                                orange: 'bg-orange-400',
                                purple: 'bg-purple-400',
                            };

                            return (
                                <div
                                    key={`${highlight.refKey}-${highlight.verse}-${idx}`}
                                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group"
                                >
                                    <div className={`w-3 h-3 rounded-full ${colorMaps[highlight.color]} shadow-[0_0_10px_rgba(255,255,255,0.2)]`} />

                                    <div className="flex-1 cursor-pointer" onClick={() => {
                                        onNavigate(highlight.bookId, highlight.chapter, highlight.verse);
                                        onClose();
                                    }}>
                                        <h3 className="font-bold text-white text-base group-hover:text-[#d9f94a] transition-colors">
                                            {highlight.displayRef}
                                        </h3>
                                    </div>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemoveHighlight(highlight.refKey, highlight.verse);
                                        }}
                                        className="p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 sm:opacity-100"
                                        title="Supprimer ce surlignage"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
