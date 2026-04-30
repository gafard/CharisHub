/**
 * Reading Statistics — Advanced analytics for Bible reading habits.
 *
 * Tracks time per book, reading trends, and engagement patterns
 * from localStorage reading history.
 */

import { getStreak, type StreakData } from './bibleStreak';
import { getAllSessions, type PrayerFlowSession } from './prayerFlowStore';

const HISTORY_KEY = 'formation_biblique_reading_history_v1';
const MAX_ENTRIES = 500;

export interface ReadingEntry {
  bookName: string;
  bookAbbr: string;
  chapter: number;
  timestamp: string; // ISO
  durationSec: number;
  translationId: string;
}

export interface BookStat {
  bookName: string;
  bookAbbr: string;
  chaptersRead: number;
  totalTimeSec: number;
  lastRead: string;
}

export interface WeeklyTrend {
  weekLabel: string; // "Sem 1", "Sem 2"...
  startDate: string;
  chaptersRead: number;
  prayerMinutes: number;
  readingMinutes: number;
}

export interface ReadingStats {
  streak: StreakData;
  totalReadingTimeSec: number;
  totalPrayerTimeSec: number;
  totalChaptersRead: number;
  averageChaptersPerDay: number;
  favoriteBook: BookStat | null;
  bookStats: BookStat[];
  weeklyTrends: WeeklyTrend[];
  totalSessions: number;
  longestSessionSec: number;
  readingDaysCount: number;
}

// ─── Storage ──────────────────────────────────────────────────

function loadHistory(): ReadingEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as ReadingEntry[]) : [];
  } catch { return []; }
}

function saveHistory(entries: ReadingEntry[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Record a reading session for stats tracking.
 */
export function recordReadingSession(entry: Omit<ReadingEntry, 'timestamp'>): void {
  const entries = loadHistory();
  entries.unshift({ ...entry, timestamp: new Date().toISOString() });
  saveHistory(entries);
}

/**
 * Compute advanced reading statistics.
 */
export function computeStats(): ReadingStats {
  const streak = getStreak();
  const history = loadHistory();
  const sessions = getAllSessions();

  // ─── Book stats ─────────────────────────────
  const bookMap = new Map<string, BookStat>();
  for (const entry of history) {
    const key = entry.bookAbbr || entry.bookName;
    const existing = bookMap.get(key);
    if (existing) {
      existing.chaptersRead += 1;
      existing.totalTimeSec += entry.durationSec;
      if (entry.timestamp > existing.lastRead) existing.lastRead = entry.timestamp;
    } else {
      bookMap.set(key, {
        bookName: entry.bookName,
        bookAbbr: entry.bookAbbr,
        chaptersRead: 1,
        totalTimeSec: entry.durationSec,
        lastRead: entry.timestamp,
      });
    }
  }
  const bookStats = Array.from(bookMap.values()).sort((a, b) => b.chaptersRead - a.chaptersRead);
  const favoriteBook = bookStats.length > 0 ? bookStats[0] : null;

  // ─── Reading time ───────────────────────────
  const totalReadingTimeSec = history.reduce((sum, e) => sum + e.durationSec, 0);
  const totalPrayerTimeSec = sessions.reduce((sum, s) => sum + s.totalDurationSec, 0);

  // ─── Unique reading days ────────────────────
  const readingDays = new Set(history.map(e => e.timestamp.slice(0, 10)));
  const readingDaysCount = readingDays.size;
  const averageChaptersPerDay = readingDaysCount > 0
    ? Math.round((history.length / readingDaysCount) * 10) / 10
    : 0;

  // ─── Longest session ────────────────────────
  const longestSessionSec = history.length > 0
    ? Math.max(...history.map(e => e.durationSec))
    : 0;

  // ─── Weekly trends (last 8 weeks) ──────────
  const weeklyTrends: WeeklyTrend[] = [];
  const now = new Date();
  for (let w = 7; w >= 0; w--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() - w * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const startStr = weekStart.toISOString().slice(0, 10);
    const endStr = weekEnd.toISOString().slice(0, 10);

    const weekEntries = history.filter(e => {
      const d = e.timestamp.slice(0, 10);
      return d >= startStr && d < endStr;
    });

    const weekSessions = sessions.filter(s => {
      const d = s.date.slice(0, 10);
      return d >= startStr && d < endStr;
    });

    weeklyTrends.push({
      weekLabel: `Sem ${8 - w}`,
      startDate: startStr,
      chaptersRead: weekEntries.length,
      readingMinutes: Math.round(weekEntries.reduce((s, e) => s + e.durationSec, 0) / 60),
      prayerMinutes: Math.round(weekSessions.reduce((s, e) => s + e.totalDurationSec, 0) / 60),
    });
  }

  return {
    streak,
    totalReadingTimeSec,
    totalPrayerTimeSec,
    totalChaptersRead: streak.totalChapters,
    averageChaptersPerDay,
    favoriteBook,
    bookStats,
    weeklyTrends,
    totalSessions: sessions.length,
    longestSessionSec,
    readingDaysCount,
  };
}

/**
 * Get a human-readable summary of stats.
 */
export function getStatsSummary(): string {
  const s = computeStats();
  const lines: string[] = [];
  lines.push(`📊 ${s.totalChaptersRead} chapitres lus au total`);
  lines.push(`🔥 Série actuelle : ${s.streak.current} jour${s.streak.current > 1 ? 's' : ''}`);
  lines.push(`⏱️ ${Math.round(s.totalReadingTimeSec / 60)} min de lecture`);
  lines.push(`🙏 ${Math.round(s.totalPrayerTimeSec / 60)} min de prière`);
  if (s.favoriteBook) lines.push(`📖 Livre préféré : ${s.favoriteBook.bookName}`);
  lines.push(`📅 ${s.readingDaysCount} jours de lecture`);
  return lines.join('\n');
}
