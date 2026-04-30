import { openDB, IDBPDatabase } from 'idb';
import { VerseRow } from './parsers/types';
import logger from '../logger';

const DB_NAME = 'charishub-bible-cache';
const STORE_NAME = 'chapters';
const CACHE_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, CACHE_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getCachedChapter(
  translationId: string,
  bookId: string,
  chapter: number
): Promise<VerseRow[] | null> {
  const db = await getDB();
  if (!db) return null;

  const key = `${translationId}:${bookId}:${chapter}`;
  try {
    const cached = await db.get(STORE_NAME, key);
    if (cached && Date.now() - cached.timestamp < 7 * 24 * 60 * 60 * 1000) {
      return cached.verses;
    }
  } catch (err) {
    logger.warn('[Cache] Error reading from IndexedDB:', err);
  }
  return null;
}

export async function cacheChapter(
  translationId: string,
  bookId: string,
  chapter: number,
  verses: VerseRow[]
) {
  const db = await getDB();
  if (!db) return;

  const key = `${translationId}:${bookId}:${chapter}`;
  try {
    await db.put(STORE_NAME, {
      key,
      verses,
      timestamp: Date.now(),
    });
  } catch (err) {
    logger.warn('[Cache] Error writing to IndexedDB:', err);
  }
}
