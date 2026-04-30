import logger from '@/lib/logger';
/**
 * Cloud Sync Service — Synchronisation localStorage ↔ Supabase
 * 
 * Fonctionnalités :
 * - Sync automatique au démarrage et après modifications
 * - Merge intelligent avec résolution de conflits (dernière modification gagne)
 * - Export/Import manuel de données
 * - Backup périodique toutes les 5 minutes
 */

import { supabase } from './supabase';
import type { Pepite } from './pepitesStore';
import type { PrayerFlowSession } from './prayerFlowStore';
import type { StreakData } from './bibleStreak';

// ============================================================
// Types
// ============================================================

export interface SyncStatus {
  connected: boolean;
  lastSyncAt: Date | null;
  syncing: boolean;
  syncProgress: SyncProgress | null;
  error: string | null;
}

export interface SyncProgress {
  total: number;
  completed: number;
  current: string;
}

export interface CloudHighlight {
  id: string;
  book_slug: string;
  chapter: number;
  verse: number;
  translation: string;
  color: string;
  verse_text: string;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface CloudNote {
  id: string;
  book_slug: string;
  chapter: number | null;
  verse: number | null;
  translation: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface CloudBookmark {
  id: string;
  book_slug: string;
  chapter: number;
  translation: string;
  created_at: string;
}

export interface CloudPepite {
  id: string;
  reference: string;
  verse_text: string;
  note?: string;
  pepite_type: 'grace' | 'identity' | 'promise';
  created_at: string;
}

export interface CloudReadingProgress {
  id: string;
  plan_id: string;
  day_index: number;
  reading_index: number;
  book_slug: string;
  chapter: number;
  completed: boolean;
  completed_at: string | null;
}

export interface CloudReflection {
  id: string;
  plan_id: string;
  day_index: number;
  reading_id: string;
  book_id: string;
  book_name: string;
  chapter: number;
  answers: Record<string, string>;
  daily_prompts: Record<string, string>;
  prayer_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CloudStreak {
  current_streak: number;
  best_streak: number;
  last_read_date: string | null;
  total_chapters: number;
}

export interface CloudPrayerSession {
  id: string;
  session_date: string;
  plan_id: string;
  day_index: number;
  reading_summary?: string;
  book_name?: string;
  chapters?: number[];
  total_duration_sec: number;
}

export interface CloudPrayerJournal {
  id: string;
  session_id?: string;
  step_type: string;
  step_label: string;
  content: string;
  category: string;
  answered: boolean;
  created_at: string;
  updated_at: string;
}

export interface FullUserData {
  highlights: CloudHighlight[];
  notes: CloudNote[];
  bookmarks: CloudBookmark[];
  pepites: CloudPepite[];
  readingProgress: CloudReadingProgress[];
  reflections: CloudReflection[];
  streak: CloudStreak | null;
  prayerSessions: CloudPrayerSession[];
  prayerJournal: CloudPrayerJournal[];
}

export interface ExportData {
  version: string;
  exportedAt: string;
  deviceId: string;
  highlights: Record<string, any>;
  notes: Record<string, string>;
  verseNotes: Record<string, string>;
  bookmarks: string[];
  pepites: Pepite[];
  readingPlans: Record<string, any>;
  readingStreak: StreakData;
  prayerSessions: PrayerFlowSession[];
  prayerJournal: any[];
}

// ============================================================
// Helpers
// ============================================================

function getDeviceId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('formation_biblique_identity_v1');
    if (!raw) return null;
    const identity = JSON.parse(raw);
    return identity.deviceId || null;
  } catch {
    return null;
  }
}

function isSupabaseConfigured(): boolean {
  return !!supabase;
}

// ============================================================
// Récupération des données depuis Supabase
// ============================================================

export async function fetchAllCloudData(): Promise<FullUserData | null> {
  if (!isSupabaseConfigured()) return null;
  
  const deviceId = getDeviceId();
  const session = (await supabase.auth.getSession()).data.session;
  const authId = session?.user?.id;

  if (!authId && !deviceId) return null;

  try {
    const [
      highlightsResult,
      notesResult,
      bookmarksResult,
      pepitesResult,
      readingProgressResult,
      reflectionsResult,
      streakResult,
      prayerSessionsResult,
      prayerJournalResult,
    ] = await Promise.all([
      supabase
        .from('user_bible_highlights')
        .select('*')
        .or(`user_id.eq.${authId},device_id.eq.${deviceId}`)
        .order('updated_at', { ascending: false }),

      supabase
        .from('user_bible_notes')
        .select('*')
        .or(`user_id.eq.${authId},device_id.eq.${deviceId}`)
        .order('updated_at', { ascending: false }),

      supabase
        .from('user_bible_bookmarks')
        .select('*')
        .or(`user_id.eq.${authId},device_id.eq.${deviceId}`)
        .order('created_at', { ascending: false }),

      supabase
        .from('user_pepites')
        .select('*')
        .or(`user_id.eq.${authId},device_id.eq.${deviceId}`)
        .order('created_at', { ascending: false }),

      supabase
        .from('user_reading_progress')
        .select('*')
        .or(`user_id.eq.${authId},device_id.eq.${deviceId}`),

      supabase
        .from('user_reading_reflections')
        .select('*')
        .or(`user_id.eq.${authId},device_id.eq.${deviceId}`)
        .order('updated_at', { ascending: false }),

      supabase
        .from('user_reading_streak')
        .select('*')
        .or(`user_id.eq.${authId},device_id.eq.${deviceId}`)
        .single(),

      supabase
        .from('user_prayer_sessions')
        .select('*')
        .or(`user_id.eq.${authId},device_id.eq.${deviceId}`)
        .order('session_date', { ascending: false }),

      supabase
        .from('user_prayer_journal')
        .select('*')
        .or(`user_id.eq.${authId},device_id.eq.${deviceId}`)
        .order('updated_at', { ascending: false }),
    ]);

    if (highlightsResult.error) throw highlightsResult.error;
    if (notesResult.error) throw notesResult.error;
    if (bookmarksResult.error) throw bookmarksResult.error;
    if (pepitesResult.error) throw pepitesResult.error;
    if (readingProgressResult.error) throw readingProgressResult.error;
    if (reflectionsResult.error) throw reflectionsResult.error;
    if (streakResult.error && streakResult.error.code !== 'PGRST116') throw streakResult.error;
    if (prayerSessionsResult.error) throw prayerSessionsResult.error;
    if (prayerJournalResult.error) throw prayerJournalResult.error;

    return {
      highlights: highlightsResult.data || [],
      notes: notesResult.data || [],
      bookmarks: bookmarksResult.data || [],
      pepites: pepitesResult.data || [],
      readingProgress: readingProgressResult.data || [],
      reflections: reflectionsResult.data || [],
      streak: streakResult.data || null,
      prayerSessions: prayerSessionsResult.data || [],
      prayerJournal: prayerJournalResult.data || [],
    };
  } catch (error: any) {
    // Erreur attendue si les tables n'existent pas encore
    const errorMessage = error?.message || error?.details || error?.hint || (typeof error === 'string' ? error : 'Erreur inconnue');
    
    if (errorMessage.includes('relation') || errorMessage.includes('does not exist')) {
      logger.warn('[CloudSync] ⚠️ Tables de backup non initialisées.');
      logger.warn('[CloudSync] Exécutez le schéma SQL : supabase-backup-sync.sql');
      logger.warn('[CloudSync] Ou utilisez l\'API : POST /api/admin/init-backup-schema');
    } else {
      logger.error('[CloudSync] Error fetching data:', errorMessage, error?.code ? `(Code: ${error.code})` : '');
    }
    
    return null;
  }
}

// ============================================================
// Sync — Local vers Cloud
// ============================================================

export async function syncLocalToCloud(
  data: FullUserData,
  onProgress?: (progress: SyncProgress) => void
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  
  const deviceId = getDeviceId();
  const session = (await supabase.auth.getSession()).data.session;
  const authId = session?.user?.id;

  if (!authId && !deviceId) return false;

  try {
    const total = Object.values(data).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 1), 0);
    let completed = 0;

    const reportProgress = (current: string) => {
      completed++;
      onProgress?.({ total, completed, current });
    };

    // 1. Sync highlights (upsert)
    reportProgress('Surlignages');
    if (data.highlights.length > 0) {
      const { error } = await supabase
        .from('user_bible_highlights')
        .upsert(
          data.highlights.map(h => ({ ...h, device_id: deviceId, user_id: authId || null })),
          { onConflict: 'device_id,book_slug,chapter,verse,translation' }
        );
      if (error) logger.error('[CloudSync] Highlights sync error:', error);
    }

    // 2. Sync notes (upsert)
    reportProgress('Notes');
    if (data.notes.length > 0) {
      const { error } = await supabase
        .from('user_bible_notes')
        .upsert(
          data.notes.map(n => ({ ...n, device_id: deviceId, user_id: authId || null })),
          { onConflict: 'id' }
        );
      if (error) logger.error('[CloudSync] Notes sync error:', error);
    }

    // 3. Sync bookmarks
    reportProgress('Bookmarks');
    if (data.bookmarks.length > 0) {
      const { error } = await supabase
        .from('user_bible_bookmarks')
        .upsert(
          data.bookmarks.map(b => ({ ...b, device_id: deviceId, user_id: authId || null })),
          { onConflict: 'device_id,book_slug,chapter,translation' }
        );
      if (error) logger.error('[CloudSync] Bookmarks sync error:', error);
    }

    // 4. Sync pépites
    reportProgress('Pépites');
    if (data.pepites.length > 0) {
      const { error } = await supabase
        .from('user_pepites')
        .upsert(
          data.pepites.map(p => ({ ...p, device_id: deviceId, user_id: authId || null })),
          { onConflict: 'device_id,reference,verse_text' }
        );
      if (error) logger.error('[CloudSync] Pepites sync error:', error);
    }

    // 5. Sync reading progress
    reportProgress('Progression lecture');
    if (data.readingProgress.length > 0) {
      const { error } = await supabase
        .from('user_reading_progress')
        .upsert(
          data.readingProgress.map(r => ({ ...r, device_id: deviceId, user_id: authId || null })),
          { onConflict: 'device_id,plan_id,day_index,reading_index' }
        );
      if (error) logger.error('[CloudSync] Reading progress sync error:', error);
    }

    // 5b. Sync reflections
    reportProgress('Réflexions');
    if (data.reflections.length > 0) {
      const { error } = await supabase
        .from('user_reading_reflections')
        .upsert(
          data.reflections.map(r => ({
            ...r,
            device_id: deviceId,
            user_id: authId || null,
            answers: JSON.stringify(r.answers),
            daily_prompts: JSON.stringify(r.daily_prompts),
          })),
          { onConflict: 'device_id,plan_id,day_index,reading_id,chapter' }
        );
      if (error) logger.error('[CloudSync] Reflections sync error:', error);
    }

    // 6. Sync streak
    reportProgress('Série de lecture');
    if (data.streak) {
      // Upsert without onConflict (table has unique constraint on device_id)
      const { error } = await supabase
        .from('user_reading_streak')
        .upsert({
          device_id: deviceId,
          user_id: authId || null,
          current_streak: data.streak.current_streak,
          best_streak: data.streak.best_streak,
          last_read_date: data.streak.last_read_date,
          total_chapters: data.streak.total_chapters,
        }, { onConflict: 'device_id' });

      if (error) {
        logger.warn('[CloudSync] Streak sync warning:', error.message || 'Unknown');
      }
    }

    // 7. Sync prayer sessions
    reportProgress('Sessions de prière');
    if (data.prayerSessions.length > 0) {
      const { error } = await supabase
        .from('user_prayer_sessions')
        .upsert(
          data.prayerSessions.map(s => ({ ...s, device_id: deviceId, user_id: authId || null })),
          { onConflict: 'device_id,session_date,plan_id,day_index' }
        );
      if (error) logger.error('[CloudSync] Prayer sessions sync error:', error);
    }

    // 8. Sync prayer journal
    reportProgress('Journal de prière');
    if (data.prayerJournal.length > 0) {
      const { error } = await supabase
        .from('user_prayer_journal')
        .upsert(
          data.prayerJournal.map(j => ({ ...j, device_id: deviceId, user_id: authId || null })),
          { onConflict: 'id' }
        );
      if (error) logger.error('[CloudSync] Prayer journal sync error:', error);
    }

    // 9. Update sync metadata
    await supabase
      .from('user_sync_metadata')
      .upsert({
        device_id: deviceId,
        user_id: authId || null,
        last_sync_at: new Date().toISOString(),
        sync_version: 'v1',
      }, { onConflict: 'device_id' });

    logger.log('[CloudSync] Sync completed successfully');
    return true;
  } catch (error) {
    logger.error('[CloudSync] Sync failed:', error);
    return false;
  }
}

// ============================================================
// Merge — Cloud vers Local (résolution de conflits)
// ============================================================

export function mergeCloudToLocal(
  cloudData: FullUserData,
  onProgress?: (progress: SyncProgress) => void
): { success: boolean; counts: Record<string, number> } {
  if (typeof window === 'undefined') return { success: false, counts: {} };

  try {
    const counts: Record<string, number> = {};
    const total = Object.values(cloudData).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 1), 0);
    let completed = 0;

    const reportProgress = (current: string) => {
      completed++;
      onProgress?.({ total, completed, current });
    };

    // 1. Merge highlights
    reportProgress('Fusion des surlignages');
    if (cloudData.highlights.length > 0) {
      const localHighlightsRaw = localStorage.getItem('formation_biblique_bible_highlights_v1');
      const localHighlights: Record<string, any> = localHighlightsRaw ? JSON.parse(localHighlightsRaw) : {};
      
      for (const h of cloudData.highlights) {
        const key = `${h.book_slug}_${h.chapter}_${h.verse}`;
        // Cloud gagne si plus récent
        if (!localHighlights[key] || new Date(h.updated_at) > new Date(localHighlights[key].updatedAt || 0)) {
          localHighlights[key] = {
            color: h.color,
            verseText: h.verse_text,
            note: h.note,
            updatedAt: h.updated_at,
          };
        }
      }
      
      localStorage.setItem('formation_biblique_bible_highlights_v1', JSON.stringify(localHighlights));
      counts.highlights = cloudData.highlights.length;
    }

    // 2. Merge notes
    reportProgress('Fusion des notes');
    if (cloudData.notes.length > 0) {
      const localNotesRaw = localStorage.getItem('formation_biblique_bible_notes_v1');
      const localNotes: Record<string, string> = localNotesRaw ? JSON.parse(localNotesRaw) : {};
      
      for (const n of cloudData.notes) {
        const key = n.verse ? `${n.book_slug}_${n.chapter}_${n.verse}` : `${n.book_slug}_${n.chapter}`;
        if (!localNotes[key] || new Date(n.updated_at) > new Date()) {
          localNotes[key] = n.note;
        }
      }
      
      localStorage.setItem('formation_biblique_bible_notes_v1', JSON.stringify(localNotes));
      counts.notes = cloudData.notes.length;
    }

    // 3. Merge bookmarks
    reportProgress('Fusion des bookmarks');
    if (cloudData.bookmarks.length > 0) {
      const localBookmarksRaw = localStorage.getItem('bible_bookmarks');
      const localBookmarks: string[] = localBookmarksRaw ? JSON.parse(localBookmarksRaw) : [];
      
      for (const b of cloudData.bookmarks) {
        const ref = `${b.book_slug}_${b.chapter}`;
        if (!localBookmarks.includes(ref)) {
          localBookmarks.push(ref);
        }
      }
      
      localStorage.setItem('bible_bookmarks', JSON.stringify(localBookmarks));
      counts.bookmarks = cloudData.bookmarks.length;
    }

    // 4. Merge pépites
    reportProgress('Fusion des pépites');
    if (cloudData.pepites.length > 0) {
      const localPepitesRaw = localStorage.getItem('mirror_pepites_v1');
      const localPepites: Pepite[] = localPepitesRaw ? JSON.parse(localPepitesRaw) : [];
      
      for (const p of cloudData.pepites) {
        const exists = localPepites.some(lp => lp.reference === p.reference && lp.text === p.verse_text);
        if (!exists) {
          localPepites.unshift({
            id: p.id,
            reference: p.reference,
            text: p.verse_text,
            note: p.note,
            type: p.pepite_type,
            createdAt: p.created_at,
          });
        }
      }
      
      localStorage.setItem('mirror_pepites_v1', JSON.stringify(localPepites));
      counts.pepites = cloudData.pepites.length;
    }

    // 4b. Merge reflections
    reportProgress('Fusion des réflexions');
    if (cloudData.reflections.length > 0) {
      const localReflectionsRaw = localStorage.getItem('formation_biblique_reading_plan_reflections_v2');
      const localReflections: any[] = localReflectionsRaw ? JSON.parse(localReflectionsRaw) : [];

      for (const r of cloudData.reflections) {
        const idx = localReflections.findIndex(lr =>
          lr.planId === r.plan_id && lr.dayIndex === r.day_index &&
          lr.readingId === r.reading_id && lr.chapter === r.chapter
        );

        const reflectionEntry = {
          planId: r.plan_id,
          dayIndex: r.day_index,
          readingId: r.reading_id,
          bookId: r.book_id,
          bookName: r.book_name,
          chapter: r.chapter,
          answers: r.answers,
          dailyPrompts: r.daily_prompts,
          prayerCompletedAt: r.prayer_completed_at,
          updatedAt: r.updated_at,
          createdAt: r.created_at,
        };

        if (idx >= 0) {
          // Cloud gagne si plus récent
          if (new Date(r.updated_at) > new Date(localReflections[idx].updatedAt || 0)) {
            localReflections[idx] = reflectionEntry;
          }
        } else {
          localReflections.push(reflectionEntry);
        }
      }

      localStorage.setItem('formation_biblique_reading_plan_reflections_v2', JSON.stringify(localReflections));
      counts.reflections = cloudData.reflections.length;
    }

    // 5. Merge reading streak
    reportProgress('Fusion de la série');
    if (cloudData.streak) {
      localStorage.setItem('formation_biblique_bible_streak_v1', JSON.stringify({
        current: cloudData.streak.current_streak,
        best: cloudData.streak.best_streak,
        lastReadDate: cloudData.streak.last_read_date,
        totalChapters: cloudData.streak.total_chapters,
      }));
      counts.streak = 1;
    }

    logger.log('[CloudSync] Merge completed:', counts);
    return { success: true, counts };
  } catch (error) {
    logger.error('[CloudSync] Merge failed:', error);
    return { success: false, counts: {} };
  }
}

// ============================================================
// Export complet des données locales
// ============================================================

export function exportAllLocalData(): ExportData {
  if (typeof window === 'undefined') {
    throw new Error('Cannot export data in SSR');
  }

  const deviceId = getDeviceId() || 'unknown';

  return {
    version: 'v1',
    exportedAt: new Date().toISOString(),
    deviceId,
    highlights: safeParse(localStorage.getItem('formation_biblique_bible_highlights_v1'), {}),
    notes: safeParse(localStorage.getItem('formation_biblique_bible_notes_v1'), {}),
    verseNotes: safeParse(localStorage.getItem('formation_biblique_bible_verse_notes_v1'), {}),
    bookmarks: safeParse(localStorage.getItem('bible_bookmarks'), []),
    pepites: safeParse(localStorage.getItem('mirror_pepites_v1'), []),
    readingPlans: safeParse(localStorage.getItem('formation_biblique_reading_plans_v3'), {}),
    readingStreak: safeParse(localStorage.getItem('formation_biblique_bible_streak_v1'), {
      current: 0,
      best: 0,
      lastReadDate: '',
      totalChapters: 0,
    }),
    prayerSessions: safeParse(localStorage.getItem('formation_biblique_prayer_flow_v1'), []),
    prayerJournal: safeParse(localStorage.getItem('formation_biblique_prayer_journal_v1'), []),
  };
}

export function downloadExportData(data: ExportData) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `charishub-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function triggerExport() {
  const data = exportAllLocalData();
  downloadExportData(data);
  return data;
}

// ============================================================
// Import des données
// ============================================================

export function importData(data: ExportData): { success: boolean; counts: Record<string, number> } {
  if (typeof window === 'undefined') {
    return { success: false, counts: {} };
  }

  const counts: Record<string, number> = {};

  try {
    if (data.highlights && Object.keys(data.highlights).length > 0) {
      localStorage.setItem('formation_biblique_bible_highlights_v1', JSON.stringify(data.highlights));
      counts.highlights = Object.keys(data.highlights).length;
    }

    if (data.notes && Object.keys(data.notes).length > 0) {
      localStorage.setItem('formation_biblique_bible_notes_v1', JSON.stringify(data.notes));
      counts.notes = Object.keys(data.notes).length;
    }

    if (data.verseNotes && Object.keys(data.verseNotes).length > 0) {
      localStorage.setItem('formation_biblique_bible_verse_notes_v1', JSON.stringify(data.verseNotes));
      counts.verseNotes = Object.keys(data.verseNotes).length;
    }

    if (data.bookmarks && data.bookmarks.length > 0) {
      localStorage.setItem('bible_bookmarks', JSON.stringify(data.bookmarks));
      counts.bookmarks = data.bookmarks.length;
    }

    if (data.pepites && data.pepites.length > 0) {
      localStorage.setItem('mirror_pepites_v1', JSON.stringify(data.pepites));
      counts.pepites = data.pepites.length;
    }

    if (data.readingPlans && Object.keys(data.readingPlans).length > 0) {
      localStorage.setItem('formation_biblique_reading_plans_v3', JSON.stringify(data.readingPlans));
      counts.readingPlans = 1;
    }

    if (data.readingStreak) {
      localStorage.setItem('formation_biblique_bible_streak_v1', JSON.stringify(data.readingStreak));
      counts.readingStreak = 1;
    }

    if (data.prayerSessions && data.prayerSessions.length > 0) {
      localStorage.setItem('formation_biblique_prayer_flow_v1', JSON.stringify(data.prayerSessions));
      counts.prayerSessions = data.prayerSessions.length;
    }

    if (data.prayerJournal && data.prayerJournal.length > 0) {
      localStorage.setItem('formation_biblique_prayer_journal_v1', JSON.stringify(data.prayerJournal));
      counts.prayerJournal = data.prayerJournal.length;
    }

    return { success: true, counts };
  } catch (error) {
    logger.error('[CloudSync] Import failed:', error);
    return { success: false, counts };
  }
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

// ============================================================
// Backfill — Rattachement des données Orphelines (deviceId -> userId)
// ============================================================

/**
 * Parcourt les tables pour attribuer un user_id aux lignes qui n'en ont pas
 * mais qui correspondent au device_id actuel.
 */
export async function claimLegacyData(deviceId: string, userId: string) {
  if (!supabase || !deviceId || !userId) return;

  logger.log('[CloudSync] 🔄 Tentative de récupération des données legacy pour ce compte...');

  const userDataTables = [
    'user_bible_highlights',
    'user_bible_notes',
    'user_bible_bookmarks',
    'user_pepites',
    'user_reading_progress',
    'user_reading_streak',
    'user_prayer_sessions',
    'user_prayer_journal',
    'user_sync_metadata'
  ];

  // 1. Tables User Data
  for (const table of userDataTables) {
    try {
      const { error } = await supabase
        .from(table)
        .update({ user_id: userId })
        .eq('device_id', deviceId)
        .is('user_id', null);
      
      if (error) logger.warn(`[claimLegacyData] Erreur backfill ${table}:`, error.message);
    } catch (e) {
      // Ignore
    }
  }

  // 2. Tables Communautaires (Noms de colonnes variables)
  const commTables = [
    { name: 'charishub_groups', col: 'created_by_device_id' },
    { name: 'charishub_posts', col: 'author_device_id' },
    { name: 'charishub_comments', col: 'author_device_id' },
    { name: 'charishub_group_members', col: 'device_id' }
  ];

  for (const table of commTables) {
    try {
      const { error } = await supabase
        .from(table.name)
        .update({ user_id: userId })
        .eq(table.col, deviceId)
        .is('user_id', null);
      
      if (error) logger.warn(`[claimLegacyData] Erreur backfill ${table.name}:`, error.message);
    } catch (e) {
      // Ignore
    }
  }

  logger.log('[CloudSync] ✅ Backfill terminé.');
}

// Sync automatique au démarrage (optionnel)
let syncInProgress = false;

export async function performInitialSync(
  onProgress?: (progress: SyncProgress) => void
): Promise<{ success: boolean; direction: 'local-to-cloud' | 'cloud-to-local' | 'none' }> {
  if (!isSupabaseConfigured()) {
    logger.log('[CloudSync] Supabase not configured, skipping sync');
    return { success: false, direction: 'none' };
  }

  if (syncInProgress) {
    logger.log('[CloudSync] Sync already in progress, skipping');
    return { success: false, direction: 'none' };
  }

  syncInProgress = true;

  try {
    // Stratégie : Cloud gagne (premier appareil qui sync)
    logger.log('[CloudSync] Starting cloud-to-local sync...');
    
    // BACKFILL : Si on est connecté, on tente de rattacher les données legacy avant de fetch
    const sessionRes = await supabase.auth.getSession();
    const authId = sessionRes.data.session?.user?.id;
    const deviceId = getDeviceId();
    if (authId && deviceId) {
      await claimLegacyData(deviceId, authId);
    }

    const cloudData = await fetchAllCloudData();
    
    if (cloudData) {
      onProgress?.({ total: 8, completed: 0, current: 'Téléchargement...' });
      const result = mergeCloudToLocal(cloudData, onProgress);
      syncInProgress = false;
      
      if (result.success) {
        logger.log('[CloudSync] Cloud-to-local sync completed');
        return { success: true, direction: 'cloud-to-local' };
      }
    }

    syncInProgress = false;
    return { success: false, direction: 'none' };
  } catch (error) {
    logger.error('[CloudSync] Initial sync failed:', error);
    syncInProgress = false;
    return { success: false, direction: 'none' };
  }
}
