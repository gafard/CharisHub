/**
 * Bible Reading Streak — localStorage-based daily reading tracker.
 *
 * Records a "reading" each time the user loads a Bible chapter.
 * Tracks consecutive days of reading.
 */

const STREAK_KEY = 'formation_biblique_bible_streak_v1';

export interface StreakData {
    /** Current consecutive days count */
    current: number;
    /** Longest streak ever */
    best: number;
    /** ISO date string of the last reading day (YYYY-MM-DD) */
    lastReadDate: string;
    /** Total chapters read all-time */
    totalChapters: number;
}

function todayStr(): string {
    return new Date().toISOString().slice(0, 10); // "2026-02-28"
}

function yesterdayStr(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
}

function load(): StreakData {
    if (typeof window === 'undefined') {
        return { current: 0, best: 0, lastReadDate: '', totalChapters: 0 };
    }
    try {
        const raw = localStorage.getItem(STREAK_KEY);
        if (!raw) return { current: 0, best: 0, lastReadDate: '', totalChapters: 0 };
        return JSON.parse(raw) as StreakData;
    } catch {
        return { current: 0, best: 0, lastReadDate: '', totalChapters: 0 };
    }
}

function save(data: StreakData): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STREAK_KEY, JSON.stringify(data));
}

import { syncLocalToCloud, exportAllLocalData } from './cloudSync';

/**
 * Call this when the user reads a Bible chapter.
 * Safe to call multiple times per day — it only increments the streak once per day.
 */
export function recordReading(): StreakData {
    const data = load();
    const today = todayStr();
    const yesterday = yesterdayStr();

    // Already read today — just bump chapter count
    if (data.lastReadDate === today) {
        data.totalChapters += 1;
        save(data);
    } else {
        // Read yesterday — streak continues!
        if (data.lastReadDate === yesterday) {
            data.current += 1;
        }
        // First read ever or missed a day — restart streak
        else {
            data.current = 1;
        }

        data.lastReadDate = today;
        data.totalChapters += 1;
        data.best = Math.max(data.best, data.current);
        save(data);
    }
    
    // Synchroniser vers le cloud en arrière-plan
    try {
        const fullData = exportAllLocalData();
        const cloudStreak = {
            current_streak: data.current,
            best_streak: data.best,
            last_read_date: data.lastReadDate,
            total_chapters: data.totalChapters
        };
        void syncLocalToCloud({ 
            highlights: Object.entries(fullData.highlights).map(([id, h]: any) => ({ ...h, id })),
            notes: Object.entries(fullData.notes).map(([id, n]: any) => ({ note: n, id })),
            bookmarks: fullData.bookmarks.map(id => ({ id })),
            pepites: fullData.pepites.map(p => ({ ...p, pepite_type: p.type })),
            readingProgress: [],
            reflections: [],
            streak: cloudStreak,
            prayerSessions: fullData.prayerSessions.map(s => ({ ...s, id: s.id || Math.random().toString() })),
            prayerJournal: fullData.prayerJournal
        } as any);
    } catch (e) {
        // Ignorer les erreurs de sync silencieusement
    }

    return data;
}

/**
 * Get current streak data (read-only).
 * Automatically checks if the streak is still valid (not expired).
 */
export function getStreak(): StreakData {
    const data = load();
    const today = todayStr();
    const yesterday = yesterdayStr();

    // If last read was today or yesterday, streak is valid
    if (data.lastReadDate === today || data.lastReadDate === yesterday) {
        return data;
    }

    // Streak expired — reset current but keep best
    if (data.current > 0) {
        data.current = 0;
        save(data);
    }

    return data;
}

/**
 * Check if the user has read today.
 */
export function hasReadToday(): boolean {
    const data = load();
    return data.lastReadDate === todayStr();
}
