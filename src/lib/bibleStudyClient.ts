import { BIBLE_BOOKS } from './bibleCatalog';

export type NaveTopic = {
  name: string;
  name_lower: string;
  description: string;
};

export type TreasuryRef = {
  id: string;
  label: string;
  bookId: string;
  chapter: number;
  verse: number;
};

function parseNaveTopic(value: unknown): NaveTopic | null {
  if (!value || typeof value !== 'object') return null;

  const row = value as Record<string, unknown>;
  const name = typeof row.name === 'string' ? row.name : '';
  const nameLower = typeof row.name_lower === 'string' ? row.name_lower : '';
  const description = typeof row.description === 'string' ? row.description : '';

  if (!name && !nameLower && !description) return null;

  return {
    name,
    name_lower: nameLower,
    description,
  };
}

export function parseNaveTopics(value: unknown): NaveTopic[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => parseNaveTopic(entry))
    .filter((entry): entry is NaveTopic => Boolean(entry));
}

export function extractTreasuryRefs(value: unknown): TreasuryRef[] {
  if (!Array.isArray(value)) return [];

  const refs: TreasuryRef[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    const text = String(entry ?? '');
    const matches = text.matchAll(/\b(\d{1,2})-(\d{1,3})-(\d{1,3})\b/g);

    for (const match of matches) {
      const bookNumber = Number(match[1]);
      const chapter = Number(match[2]);
      const verse = Number(match[3]);
      const book = BIBLE_BOOKS[bookNumber - 1];

      if (!book || chapter <= 0 || verse <= 0) continue;

      const id = `${bookNumber}-${chapter}-${verse}`;
      if (seen.has(id)) continue;
      seen.add(id);

      refs.push({
        id,
        label: `${book.name} ${chapter}:${verse}`,
        bookId: book.id,
        chapter,
        verse,
      });
    }
  }

  return refs;
}
