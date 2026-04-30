/**
 * Bible Offline Store — IndexedDB-based caching for Bible translations.
 *
 * Provides transparent offline support: when online, fetches and caches
 * the Bible JSON in IndexedDB. When offline, serves from cache seamlessly.
 *
 * Usage:
 *   const bible = await getCachedBible('LSG');
 *   const status = await getOfflineStatus();
 */

import logger from '@/lib/logger';

const DB_NAME = 'charishub_offline';
const DB_VERSION = 1;
const STORE_BIBLES = 'bibles';
const STORE_META = 'meta';

// ─── Types ────────────────────────────────────────────────────
export interface OfflineBibleMeta {
  translationId: string;
  cachedAt: string; // ISO
  sizeBytes: number;
  version: string;
}

export interface OfflineStatus {
  available: boolean;
  cachedTranslations: OfflineBibleMeta[];
  totalSizeMb: number;
}

// ─── IndexedDB helpers ───────────────────────────────────────
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_BIBLES)) {
        db.createObjectStore(STORE_BIBLES, { keyPath: 'translationId' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'translationId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut<T>(db: IDBDatabase, store: string, data: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(data);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Public API ──────────────────────────────────────────────

/** Check if IndexedDB is available */
function isIdbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

/**
 * Cache a Bible translation in IndexedDB.
 * Called automatically by getCachedBible on first load.
 */
export async function cacheBible(translationId: string, data: unknown, version = 'unknown'): Promise<void> {
  if (!isIdbAvailable()) return;
  try {
    const db = await openDb();
    const json = JSON.stringify(data);
    await idbPut(db, STORE_BIBLES, { translationId, data: json });
    await idbPut<OfflineBibleMeta>(db, STORE_META, {
      translationId,
      cachedAt: new Date().toISOString(),
      sizeBytes: new Blob([json]).size,
      version,
    });
    logger.log(`[OfflineStore] Cached ${translationId} (${(new Blob([json]).size / 1024 / 1024).toFixed(1)} MB)`);
  } catch (err) {
    logger.error('[OfflineStore] Cache write failed:', err);
  }
}

/**
 * Get a Bible from IndexedDB cache.
 * Returns null if not cached.
 */
export async function getCachedBibleData(translationId: string): Promise<unknown | null> {
  if (!isIdbAvailable()) return null;
  try {
    const db = await openDb();
    const record = await idbGet<{ translationId: string; data: string }>(db, STORE_BIBLES, translationId);
    if (!record?.data) return null;
    return JSON.parse(record.data);
  } catch (err) {
    logger.error('[OfflineStore] Cache read failed:', err);
    return null;
  }
}

/**
 * Remove a cached Bible translation.
 */
export async function removeCachedBible(translationId: string): Promise<void> {
  if (!isIdbAvailable()) return;
  try {
    const db = await openDb();
    await idbDelete(db, STORE_BIBLES, translationId);
    await idbDelete(db, STORE_META, translationId);
    logger.log(`[OfflineStore] Removed ${translationId} from cache`);
  } catch (err) {
    logger.error('[OfflineStore] Cache delete failed:', err);
  }
}

/**
 * Get offline status: which translations are cached and total size.
 */
export async function getOfflineStatus(): Promise<OfflineStatus> {
  if (!isIdbAvailable()) {
    return { available: false, cachedTranslations: [], totalSizeMb: 0 };
  }
  try {
    const db = await openDb();
    const metas = await idbGetAll<OfflineBibleMeta>(db, STORE_META);
    const totalBytes = metas.reduce((sum, m) => sum + m.sizeBytes, 0);
    return {
      available: true,
      cachedTranslations: metas,
      totalSizeMb: Math.round((totalBytes / 1024 / 1024) * 10) / 10,
    };
  } catch {
    return { available: false, cachedTranslations: [], totalSizeMb: 0 };
  }
}

/**
 * Preload all known translations for full offline access.
 * Shows progress via callback.
 */
export async function preloadAllBibles(
  onProgress?: (loaded: number, total: number, current: string) => void
): Promise<{ cached: string[]; failed: string[] }> {
  const ALL_TRANSLATIONS = [
    'lsg', 'LSG1910', 'BDS', 'COLOMBE', 'DARBY', 'FRANCAIS_COURANT',
    'KJF', 'MARTIN', 'NOUVELLE_SEGOND', 'OECUMENIQUE', 'OSTERVALD', 'PAROLE_DE_VIE',
  ];

  const cached: string[] = [];
  const failed: string[] = [];

  for (let i = 0; i < ALL_TRANSLATIONS.length; i++) {
    const id = ALL_TRANSLATIONS[i];
    onProgress?.(i, ALL_TRANSLATIONS.length, id);

    try {
      // Check if already cached
      const existing = await getCachedBibleData(id);
      if (existing) {
        cached.push(id);
        continue;
      }

      const res = await fetch(`/bibles/${id}/bible.json`, { cache: 'force-cache' });
      if (!res.ok) {
        failed.push(id);
        continue;
      }
      const data = await res.json();
      await cacheBible(id, data, data.version || id);
      cached.push(id);
    } catch {
      failed.push(id);
    }
  }

  onProgress?.(ALL_TRANSLATIONS.length, ALL_TRANSLATIONS.length, 'done');
  return { cached, failed };
}
