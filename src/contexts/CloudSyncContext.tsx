/**
 * Cloud Sync Context — Gestion de la synchronisation cloud
 * 
 * Fournit :
 * - État de connexion (connecté/déconnecté)
 * - Sync automatique au démarrage et après modifications
 * - Backup périodique toutes les 5 minutes
 * - API pour sync manuelle, export, import
 */

'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import * as cloudSync from '../lib/cloudSync';
import type { SyncStatus, SyncProgress, FullUserData, ExportData } from '../lib/cloudSync';

// ============================================================
// Types
// ============================================================

interface CloudSyncContextValue {
  syncStatus: SyncStatus;
  syncToCloud: () => Promise<boolean>;
  syncFromCloud: () => Promise<boolean>;
  exportData: () => ExportData;
  importData: (data: ExportData) => { success: boolean; counts: Record<string, number> };
  isConnected: boolean;
}

const CloudSyncContext = createContext<CloudSyncContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    connected: !!supabase,
    lastSyncAt: null,
    syncing: false,
    syncProgress: null,
    error: null,
  });

  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const syncDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef(false);

  // ============================================================
  // Sync vers le cloud
  // ============================================================

  const collectLocalData = (): FullUserData => {
    if (typeof window === 'undefined') {
      return {
        highlights: [],
        notes: [],
        bookmarks: [],
        pepites: [],
        readingProgress: [],
        reflections: [],
        streak: null,
        prayerSessions: [],
        prayerJournal: [],
      };
    }

    // Récupérer les données locales et les transformer au format cloud
    const highlightsRaw = safeParse<Record<string, any>>(localStorage.getItem('formation_biblique_bible_highlights_v1'), {});
    const notesRaw = safeParse<Record<string, string>>(localStorage.getItem('formation_biblique_bible_notes_v1'), {});
    const verseNotesRaw = safeParse<Record<string, string>>(localStorage.getItem('formation_biblique_bible_verse_notes_v1'), {});
    const bookmarksRaw = safeParse<string[]>(localStorage.getItem('bible_bookmarks'), []);
    const pepitesRaw = safeParse<any[]>(localStorage.getItem('huios_pepites_v1'), []);
    const streakRaw = safeParse<any>(localStorage.getItem('formation_biblique_bible_streak_v1'), null);
    const prayerSessionsRaw = safeParse<any[]>(localStorage.getItem('formation_biblique_prayer_flow_v1'), []);
    const prayerJournalRaw = safeParse<any[]>(localStorage.getItem('formation_biblique_prayer_journal_v1'), []);
    const readingPlansRaw = safeParse<any>(localStorage.getItem('formation_biblique_reading_plans_v3'), {});

    // Transformer les highlights (object → array)
    const highlights: cloudSync.CloudHighlight[] = Object.entries(highlightsRaw).map(([key, value]: [string, any]) => {
      const [book_slug, chapterStr, verseStr] = key.split('_');
      return {
        id: `hl_${key}`,
        book_slug,
        chapter: parseInt(chapterStr, 10) || 1,
        verse: parseInt(verseStr, 10) || 1,
        translation: 'lsg',
        color: value.color || 'yellow',
        verse_text: value.verseText || '',
        note: value.note,
        created_at: value.createdAt || new Date().toISOString(),
        updated_at: value.updatedAt || new Date().toISOString(),
      };
    });

    // Transformer les notes
    const notes: cloudSync.CloudNote[] = Object.entries(notesRaw).map(([key, note], idx) => {
      const parts = key.split('_');
      return {
        id: `note_${idx}`,
        book_slug: parts[0] || '',
        chapter: parts[1] ? parseInt(parts[1], 10) : null,
        verse: parts[2] ? parseInt(parts[2], 10) : null,
        translation: 'lsg',
        note,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    // Ajouter les verse notes
    const verseNotes: cloudSync.CloudNote[] = Object.entries(verseNotesRaw).map(([key, note], idx) => {
      const parts = key.split('_');
      return {
        id: `vnote_${idx}`,
        book_slug: parts[0] || '',
        chapter: parts[1] ? parseInt(parts[1], 10) : null,
        verse: parts[2] ? parseInt(parts[2], 10) : null,
        translation: 'lsg',
        note,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    // Transformer les bookmarks
    const bookmarks: cloudSync.CloudBookmark[] = bookmarksRaw.map((ref, idx) => {
      const [book_slug, chapterStr] = ref.split('_');
      return {
        id: `bm_${idx}`,
        book_slug,
        chapter: parseInt(chapterStr, 10) || 1,
        translation: 'lsg',
        created_at: new Date().toISOString(),
      };
    });

    // Transformer les pépites
    const pepites: cloudSync.CloudPepite[] = pepitesRaw.map(p => ({
      id: p.id,
      reference: p.reference,
      verse_text: p.text,
      note: p.note,
      pepite_type: p.type || 'grace',
      created_at: p.createdAt || new Date().toISOString(),
    }));

    // Streak
    const streak: cloudSync.CloudStreak | null = streakRaw ? {
      current_streak: streakRaw.current || 0,
      best_streak: streakRaw.best || 0,
      last_read_date: streakRaw.lastReadDate || null,
      total_chapters: streakRaw.totalChapters || 0,
    } : null;

    // Prayer sessions (limiter à 60)
    const prayerSessions: cloudSync.CloudPrayerSession[] = prayerSessionsRaw.slice(0, 60).map(s => ({
      id: s.id,
      session_date: s.date,
      plan_id: s.planId,
      day_index: s.dayIndex,
      reading_summary: s.readingSummary,
      book_name: s.bookName,
      chapters: s.chapters,
      total_duration_sec: s.totalDurationSec || 0,
    }));

    // Prayer journal
    const prayerJournal: cloudSync.CloudPrayerJournal[] = prayerJournalRaw.map(j => ({
      id: j.id,
      step_type: j.stepType || 'other',
      step_label: j.stepLabel || '',
      content: j.content,
      category: j.category || 'other',
      answered: j.answered || false,
      created_at: j.createdAt || new Date().toISOString(),
      updated_at: j.updatedAt || new Date().toISOString(),
    }));

    // Reading progress (extrait des plans)
    const readingProgress: cloudSync.CloudReadingProgress[] = [];
    if (readingPlansRaw && readingPlansRaw.plans) {
      // TODO: Extraire la progression détaillée si disponible
    }

    // Reflections (from localStorage)
    const reflectionsRaw = safeParse<any[]>(localStorage.getItem('formation_biblique_reading_plan_reflections_v2'), []);
    const reflections: cloudSync.CloudReflection[] = Array.isArray(reflectionsRaw)
      ? reflectionsRaw.map((r: any, idx: number) => ({
          id: `ref_${idx}_${r.readingId || ''}_${r.chapter || ''}`,
          plan_id: r.planId || '',
          day_index: r.dayIndex || 0,
          reading_id: r.readingId || '',
          book_id: r.bookId || '',
          book_name: r.bookName || '',
          chapter: r.chapter || 1,
          answers: r.answers || {},
          daily_prompts: r.dailyPrompts || {},
          prayer_completed_at: r.prayerCompletedAt || null,
          created_at: r.createdAt || new Date().toISOString(),
          updated_at: r.updatedAt || new Date().toISOString(),
        }))
      : [];

    return {
      highlights,
      notes: [...notes, ...verseNotes],
      bookmarks,
      pepites,
      readingProgress,
      reflections,
      streak,
      prayerSessions,
      prayerJournal,
    };
  };

  const syncToCloud = useCallback(async (): Promise<boolean> => {
    if (!supabase || isSyncingRef.current) return false;

    isSyncingRef.current = true;
    setSyncStatus(prev => ({ ...prev, syncing: true, error: null }));

    try {
      const localData = collectLocalData();
      
      const success = await cloudSync.syncLocalToCloud(localData, (progress) => {
        setSyncStatus(prev => ({ ...prev, syncProgress: progress }));
      });

      setSyncStatus(prev => ({
        ...prev,
        syncing: false,
        lastSyncAt: success ? new Date() : prev.lastSyncAt,
        error: success ? null : 'Erreur lors de la synchronisation',
      }));

      return success;
    } catch (error) {
      setSyncStatus(prev => ({
        ...prev,
        syncing: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      }));
      return false;
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  const syncFromCloud = useCallback(async (): Promise<boolean> => {
    if (!supabase || isSyncingRef.current) return false;

    isSyncingRef.current = true;
    setSyncStatus(prev => ({ ...prev, syncing: true, error: null }));

    try {
      const result = await cloudSync.performInitialSync((progress) => {
        setSyncStatus(prev => ({ ...prev, syncProgress: progress }));
      });

      setSyncStatus(prev => ({
        ...prev,
        syncing: false,
        lastSyncAt: result.success ? new Date() : prev.lastSyncAt,
        error: result.success ? null : 'Erreur lors de la récupération des données',
      }));

      return result.success;
    } catch (error) {
      setSyncStatus(prev => ({
        ...prev,
        syncing: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      }));
      return false;
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  // ============================================================
  // Export/Import
  // ============================================================

  const exportData = useCallback((): ExportData => {
    return cloudSync.exportAllLocalData();
  }, []);

  const importDataFn = useCallback((data: ExportData) => {
    return cloudSync.importData(data);
  }, []);

  // ============================================================
  // Sync automatique
  // ============================================================

  // Sync au démarrage
  useEffect(() => {
    if (!supabase) return;

    console.log('[CloudSync] Starting initial sync...');
    
    // Délai de 3s pour laisser l'app se charger
    const timer = setTimeout(() => {
      syncFromCloud();
    }, 3000);

    return () => clearTimeout(timer);
  }, [syncFromCloud]);

  // Backup périodique toutes les 5 minutes
  useEffect(() => {
    if (!supabase) return;

    syncTimerRef.current = setInterval(() => {
      if (!isSyncingRef.current) {
        console.log('[CloudSync] Auto backup triggered');
        syncToCloud();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
      }
    };
  }, [syncToCloud]);

  // Sync après une modification (debounce 2s)
  const scheduleSync = useCallback(() => {
    if (!supabase) return;

    if (syncDebounceRef.current) {
      clearTimeout(syncDebounceRef.current);
    }

    syncDebounceRef.current = setTimeout(() => {
      if (!isSyncingRef.current) {
        syncToCloud();
      }
    }, 2000);
  }, [syncToCloud]);

  // Exposer scheduleSync pour que les composants puissent le déclencher
  // On attache à window pour les appels depuis d'autres modules
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__charishub_scheduleSync = scheduleSync;
    }
  }, [scheduleSync]);

  // ============================================================
  // Valeur du contexte
  // ============================================================

  const value: CloudSyncContextValue = {
    syncStatus,
    syncToCloud,
    syncFromCloud,
    exportData,
    importData: importDataFn,
    isConnected: !!supabase,
  };

  return (
    <CloudSyncContext.Provider value={value}>
      {children}
    </CloudSyncContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================

export function useCloudSync(): CloudSyncContextValue {
  const context = useContext(CloudSyncContext);
  if (!context) {
    throw new Error('useCloudSync must be used within CloudSyncProvider');
  }
  return context;
}

// ============================================================
// Helpers
// ============================================================

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// Hook pour déclencher la sync après une modification
export function useSyncAfterChange() {
  const { syncStatus } = useCloudSync();
  
  const scheduleSync = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).__charishub_scheduleSync) {
      (window as any).__charishub_scheduleSync();
    }
  }, []);

  return { scheduleSync, isSyncing: syncStatus.syncing };
}
