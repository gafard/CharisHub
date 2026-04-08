/**
 * Pepites Store — Identité & Grâce.
 * Sauvegarde les "Trésors d'Identité" (Pépites) découverts pendant la lecture.
 */

export interface Pepite {
    id: string;
    reference: string;
    text: string;
    note?: string;
    createdAt: string;
    type: 'grace' | 'identity' | 'promise';
}

const STORE_KEY = 'huios_pepites_v1';

import { syncLocalToCloud, exportAllLocalData } from './cloudSync';

export const pepitesStore = {
    load(): Pepite[] {
        if (typeof window === 'undefined') return [];
        try {
            const raw = localStorage.getItem(STORE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    },

    save(pepite: Omit<Pepite, 'id' | 'createdAt'>): Pepite {
        const entry: Pepite = {
            ...pepite,
            id: `pep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            createdAt: new Date().toISOString(),
        };
        const all = this.load();
        all.unshift(entry);
        localStorage.setItem(STORE_KEY, JSON.stringify(all));

        // Synchroniser vers le cloud en arrière-plan
        try {
            const fullData = exportAllLocalData();
            void syncLocalToCloud({
                highlights: Object.entries(fullData.highlights).map(([id, h]: any) => ({ ...h, id })),
                notes: Object.entries(fullData.notes).map(([id, n]: any) => ({ note: n, id })),
                bookmarks: fullData.bookmarks.map(id => ({ id })),
                pepites: all.map(p => ({ ...p, pepite_type: p.type, verse_text: p.text })),
                readingProgress: [],
                reflections: [],
                streak: {
                    current_streak: fullData.readingStreak.current,
                    best_streak: fullData.readingStreak.best,
                    last_read_date: fullData.readingStreak.lastReadDate,
                    total_chapters: fullData.readingStreak.totalChapters
                },
                prayerSessions: fullData.prayerSessions.map((s: any) => ({
                    id: s.id,
                    session_date: s.date,
                    plan_id: s.planId,
                    day_index: s.dayIndex,
                    total_duration_sec: s.totalDurationSec
                })),
                prayerJournal: fullData.prayerJournal
            } as any);
        } catch (e) {}

        return entry;
    },

    remove(id: string) {
        const all = this.load().filter(p => p.id !== id);
        localStorage.setItem(STORE_KEY, JSON.stringify(all));
        
        // Synchro après suppression
        try {
            const fullData = exportAllLocalData();
            void syncLocalToCloud({ ...fullData, pepites: all.map(p => ({ ...p, pepite_type: p.type, verse_text: p.text })) } as any);
        } catch (e) {}
    }
};
