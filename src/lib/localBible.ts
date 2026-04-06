export type LocalBible = {
  version: string;
  language: string;
  books: {
    name: string;
    abbreviation: string;
    chapters: {
      chapter: number; // TOUJOURS 1-indexé après normalisation
      verses: { verse: number; text: string }[]; // TOUJOURS 1-indexé après normalisation
    }[];
  }[];
};

export type LocalVerse = {
  version: string;
  book: string;
  bookAbbr: string;
  chapter: number; // TOUJOURS 1-indexé
  verse: number; // TOUJOURS 1-indexé
  text: string;
};

// Nouvelle fonction de normalisation
function normalizeBible(raw: LocalBible): LocalBible {
  return {
    ...raw,
    books: (raw.books || []).map((b) => ({
      ...b,
      chapters: (b.chapters || [])
        .map((ch) => ({
          ...ch,
          // Conversion en 1-indexé
          chapter: ch.chapter === 0 ? 1 : ch.chapter,
          verses: (ch.verses || [])
            .map((v) => ({
              ...v,
              // Conversion en 1-indexé
              verse: v.verse === 0 ? 1 : v.verse,
              text: String(v.text || '').trim(),
            }))
            // Filtrer les versets vides
            .filter((v) => v.text.length > 0),
        }))
        // Trier les chapitres par numéro
        .sort((a, c) => a.chapter - c.chapter),
    })),
  };
}

// Cache par traduction
const bibleCache = new Map<string, Promise<LocalBible>>();

function readErrorMessage(err: unknown, fallback = 'Erreur inconnue') {
  return err instanceof Error ? err.message : fallback;
}

function parseBiblePayload(raw: string) {
  const cleaned = raw.replace(/^\uFEFF/, '').trim();
  if (!cleaned) throw new Error('Fichier Bible vide');
  try {
    return JSON.parse(cleaned);
  } catch {
    try {
      return Function(`"use strict"; return (${cleaned});`)();
    } catch {
      const flattened = cleaned.replace(/\r?\n+/g, ' ');
      return Function(`"use strict"; return (${flattened});`)();
    }
  }
}

export async function loadLocalBible(translationId: string = 'LSG'): Promise<LocalBible> {
  if (bibleCache.has(translationId)) return bibleCache.get(translationId)!;

  const p = (async () => {
    const candidateIds = Array.from(
      new Set(
        [
          translationId,
          translationId.toUpperCase(),
          translationId.toLowerCase(),
          translationId === 'LSG' ? 'lsg' : null,
        ].filter(Boolean) as string[]
      )
    );
    const errors: string[] = [];

    for (const id of candidateIds) {
      const url = `/bibles/${id}/bible.json`;
      try {
        const res = await fetch(url, { cache: 'force-cache' });
        if (!res.ok) {
          errors.push(`${url} (${res.status})`);
          continue;
        }
        const text = await res.text();
        const raw = parseBiblePayload(text);
        return normalizeBible(raw as LocalBible);
      } catch (err) {
        errors.push(`${url} (${readErrorMessage(err)})`);
      }
    }

    throw new Error(
      `Impossible de charger bible.json pour la traduction ${translationId}: ${errors.join(', ')}`
    );
  })();

  bibleCache.set(translationId, p);
  return p;
}

function pickRandomIndex(max: number) {
  if (max <= 0) return 0;
  // crypto si dispo (plus propre)
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const x = new Uint32Array(1);
    crypto.getRandomValues(x);
    return x[0] % max;
  }
  return Math.floor(Math.random() * max);
}

export async function getRandomLocalVerse(translationId: string = 'LSG'): Promise<LocalVerse | null> {
  const bible = await loadLocalBible(translationId);
  const books = bible.books || [];
  if (!books.length) return null;

  for (let tries = 0; tries < 40; tries += 1) {
    const b = books[pickRandomIndex(books.length)];
    const chapters = b?.chapters || [];
    if (!chapters.length) continue;

    const c = chapters[pickRandomIndex(chapters.length)];
    const verses = c?.verses || [];
    if (!verses.length) continue;

    const v = verses[pickRandomIndex(verses.length)];
    const text = (v?.text || '').trim();
    if (!text) continue;

    return {
      version: bible.version,
      book: b.name,
      bookAbbr: b.abbreviation,
      chapter: c.chapter, // Maintenant TOUJOURS 1-indexé
      verse: v.verse,     // Maintenant TOUJOURS 1-indexé
      text,
    };
  }

  return null;
}

/**
 * Returns a stable index using a numeric seed.
 */
function getSeededIndex(max: number, seed: number) {
  if (max <= 0) return 0;
  // A simple stable pseudo-random result between 0 and 1
  const x = Math.sin(seed) * 10000;
  const rand = x - Math.floor(x);
  return Math.floor(rand * max);
}

export async function getDailyLocalVerse(seed: number, translationId: string = 'LSG'): Promise<LocalVerse | null> {
  const bible = await loadLocalBible(translationId);
  const books = bible.books || [];
  if (!books.length) return null;

  // Use seed to pick book, then chapter, then verse
  let currentSeed = seed;
  const b = books[getSeededIndex(books.length, currentSeed++)];
  const chapters = b?.chapters || [];
  if (!chapters.length) return null;

  const c = chapters[getSeededIndex(chapters.length, currentSeed++)];
  const verses = c?.verses || [];
  if (!verses.length) return null;

  const v = verses[getSeededIndex(verses.length, currentSeed++)];
  const text = (v?.text || '').trim();

  return {
    version: bible.version,
    book: b.name,
    bookAbbr: b.abbreviation,
    chapter: c.chapter,
    verse: v.verse,
    text,
  };
}

export async function getLocalVerse(params: {
  bookName?: string;
  bookAbbr?: string;
  chapter: number;          // 1-indexé
  verse: number;            // 1-indexé
  translationId?: string;
}) {
  const bible = await loadLocalBible(params.translationId || 'LSG');

  const book = bible.books.find((b) => {
    if (params.bookAbbr) return b.abbreviation.toLowerCase() === params.bookAbbr.toLowerCase();
    if (params.bookName) return b.name.toLowerCase() === params.bookName.toLowerCase();
    return false;
  });

  if (!book) return null;

  // Recherche directe sans conversion
  const chapterObj = book.chapters.find((c) => c.chapter === params.chapter);
  if (!chapterObj) return null;

  // Recherche exacte du verset (certains chapitres ont des versets manquants)
  const verseObj = chapterObj.verses.find((v) => v.verse === params.verse);
  if (!verseObj) return null;

  return {
    version: bible.version,
    book: book.name,
    bookAbbr: book.abbreviation,
    chapter: params.chapter, // Déjà 1-indexé
    verse: params.verse,     // Déjà 1-indexé
    text: verseObj.text,
  };
}

export async function searchBible(query: string, translationId = 'LSG', limit = 20) {
  const bible = await loadLocalBible(translationId);
  const results: LocalVerse[] = [];
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  for (const book of bible.books) {
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        if (verse.text.toLowerCase().includes(q)) {
          results.push({
            version: bible.version,
            book: book.name,
            bookAbbr: book.abbreviation,
            chapter: chapter.chapter,
            verse: verse.verse,
            text: verse.text,
          });
          if (results.length >= limit) return results;
        }
      }
    }
  }
  return results;
}

export async function getBibleStructure(translationId = 'LSG') {
  const bible = await loadLocalBible(translationId);
  return bible.books.map(b => ({
    name: b.name,
    abbreviation: b.abbreviation,
    chaptersCount: b.chapters.length,
    chapters: b.chapters.map(c => ({
      number: c.chapter,
      versesCount: c.verses.length
    }))
  }));
}
