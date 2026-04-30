import localforage from 'localforage';
import logger from '@/lib/logger';

// Configuration of the IndexedDB storage
localforage.config({
  name: 'CharisHub',
  storeName: 'offline_store',
  description: 'Long-term offline storage for user data',
});

const CRITICAL_KEYS = [
  'formation_biblique_reading_plans_v3',
  'formation_biblique_active_reading_plan_v1',
  'formation_biblique_bible_highlights_v1',
  'formation_biblique_bible_notes_v1',
  'formation_biblique_bible_verse_notes_v1',
  'bible_bookmarks',
  'formation_biblique_bible_streak_v1',
  'pepites_v1',
  'formation_biblique_prayer_sessions_v1',
  'formation_biblique_identity_v1'
];

/**
 * Backups critical localStorage keys into IndexedDB.
 * This should be called whenever data is modified, or periodically.
 */
export async function backupToIndexedDB() {
  if (typeof window === 'undefined') return;

  try {
    for (const key of CRITICAL_KEYS) {
      const data = localStorage.getItem(key);
      if (data) {
        await localforage.setItem(key, data);
      }
    }
    logger.log('[OfflineStore] Backup to IndexedDB complete.');
  } catch (err) {
    logger.error('[OfflineStore] Failed to backup to IndexedDB:', err);
  }
}

/**
 * Restores critical data from IndexedDB to localStorage if localStorage is empty.
 * This protects against iOS Safari clearing localStorage after 7 days of inactivity.
 */
export async function restoreFromIndexedDB() {
  if (typeof window === 'undefined') return;

  let restoredCount = 0;
  try {
    for (const key of CRITICAL_KEYS) {
      const localData = localStorage.getItem(key);
      if (!localData) {
        const idbData = await localforage.getItem<string>(key);
        if (idbData) {
          localStorage.setItem(key, idbData);
          restoredCount++;
        }
      }
    }
    
    if (restoredCount > 0) {
      logger.log(`[OfflineStore] Restored ${restoredCount} keys from IndexedDB to localStorage.`);
    }
  } catch (err) {
    logger.error('[OfflineStore] Failed to restore from IndexedDB:', err);
  }
}

/**
 * Clears the IndexedDB offline storage (useful on logout)
 */
export async function clearOfflineStorage() {
  try {
    await localforage.clear();
    logger.log('[OfflineStore] Cleared IndexedDB storage.');
  } catch (err) {
    logger.error('[OfflineStore] Failed to clear IndexedDB:', err);
  }
}
