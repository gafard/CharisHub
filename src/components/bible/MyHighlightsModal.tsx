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
        <div className="w-full h-[85vh] sm:h-auto sm:max-h-[85vh] sm:max-w-2xl bg-background border border-border-soft sm:rounded-3xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 duration-300 shadow-2xl">

                <div className="p-4 sm:p-6 border-b border-border-soft flex items-center justify-between bg-surface">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                            <BookOpen size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground tracking-tight">Mes Surlignages</h2>
                            <p className="text-xs text-muted/50">{flatHighlights.length} verset(s) sauvegardé(s)</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-10 w-10 flex items-center justify-center rounded-full bg-foreground/5 hover:bg-foreground/10 text-muted transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="px-4 py-3 sm:px-6 bg-surface-strong/50 border-b border-border-soft">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                        <input
                            type="text"
                            placeholder="Rechercher un verset..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-surface border border-border-soft rounded-xl text-sm font-medium focus:outline-none focus:border-accent/40 placeholder:text-muted/40"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {filteredHighlights.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                            <BookOpen size={48} className="mb-4 text-foreground/20" />
                            <p className="text-lg font-semibold text-foreground mb-1">Aucun surlignage</p>
                            <p className="text-sm text-muted">
                                {search ? 'Aucun résultat pour cette recherche.' : 'Surlignez des versets pendant votre lecture pour les retrouver ici.'}
                            </p>
                        </div>
                    ) : (
                        filteredHighlights.map((h, idx) => {
                            return (
                                <div
                                    key={`${h.refKey}-${h.verse}-${idx}`}
                                    className="flex items-center rounded-2xl bg-surface-strong border border-border-soft overflow-hidden group"
                                >
                                    <button
                                        onClick={() => {
                                            onNavigate(h.bookId, h.chapter, h.verse);
                                            onClose();
                                        }}
                                        className="flex-1 flex flex-col items-start p-4 hover:bg-surface-strong/80 transition-colors"
                                    >
                                        <span className="text-sm font-bold text-foreground">{h.displayRef}</span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className={`h-2 w-2 rounded-full bg-${h.color}-400`} />
                                            <span className="text-[10px] uppercase tracking-wider text-muted font-bold">
                                                Surligné en {h.color}
                                            </span>
                                        </div>
                                    </button>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemoveHighlight(h.refKey, h.verse);
                                        }}
                                        className="p-4 hover:bg-rose-500/10 text-muted/40 hover:text-rose-400 transition-colors"
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
