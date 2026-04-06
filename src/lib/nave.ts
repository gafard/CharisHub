import fs from 'node:fs';
import path from 'node:path';
import { BIBLE_BOOKS } from '@/lib/bibleCatalog';
import { runSqliteJsonQuery } from '@/lib/sqliteQuery';

export type NaveTopic = {
  name: string;
  name_lower: string;
  description: string;
};

const DEFAULT_LIMIT = 50;

function mapNaveTopic(row: Record<string, unknown>): NaveTopic {
  return {
    name: typeof row.name === 'string' ? row.name : '',
    name_lower: typeof row.name_lower === 'string' ? row.name_lower : '',
    description: typeof row.description === 'string' ? row.description : '',
  };
}

function resolveBookNumber(bookId?: string | null): number | null {
  if (!bookId) return null;
  const index = BIBLE_BOOKS.findIndex((book) => book.id === bookId);
  if (index === -1) return null;
  return index + 1;
}

export function resolveNaveDbPath(): string | null {
  const homeDir = process.env.HOME ? path.join(process.env.HOME, 'Downloads', 'g', 'bible-strong-databases') : null;
  const baseFromStrong = process.env.STRONG_DB_PATH
    ? path.dirname(process.env.STRONG_DB_PATH)
    : null;
  const rawCandidates = [
    process.env.NAVE_DB_PATH,
    baseFromStrong ? path.join(baseFromStrong, 'nave.sqlite') : null,
    homeDir ? path.join(homeDir, 'nave.sqlite') : null,
    path.join(process.cwd(), 'data', 'nave.sqlite'),
    path.join(process.cwd(), 'public', 'data', 'nave.sqlite'),
  ].filter(Boolean) as string[];

  for (const candidate of rawCandidates) {
    const resolved = path.resolve(candidate);
    try {
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        const inDir = path.join(resolved, 'nave.sqlite');
        if (fs.existsSync(inDir)) return inDir;
      } else if (stat.isFile()) {
        return resolved;
      }
    } catch {
      // Ignore invalid candidates and keep searching.
    }
  }

  return null;
}

async function runNaveQuery(sql: string, params: Record<string, string | number> = {}) {
  const dbPath = resolveNaveDbPath();
  if (!dbPath) {
    throw new Error('NAVE_DB_PATH introuvable. Définis NAVE_DB_PATH vers nave.sqlite.');
  }
  return runSqliteJsonQuery(dbPath, sql, params);
}

export async function loadNaveTopics({
  term,
  bookId,
  chapter,
  verse,
  limit,
}: {
  term?: string | null;
  bookId?: string | null;
  chapter?: number | null;
  verse?: number | null;
  limit?: number | null;
}) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit ?? DEFAULT_LIMIT), 200));
  const trimmedTerm = term?.trim() ?? '';

  if (trimmedTerm) {
    const rows = await runNaveQuery(
      `SELECT name, name_lower, description FROM TOPICS ` +
      `WHERE name_lower LIKE @term OR name LIKE @term ` +
      `ORDER BY name_lower ASC LIMIT ${normalizedLimit};`,
      { '@term': `%${trimmedTerm.toLowerCase()}%` }
    );

    return {
      query: 'term' as const,
      term: trimmedTerm,
      limit: normalizedLimit,
      topics: rows.map((row) => mapNaveTopic(row as Record<string, unknown>)),
    };
  }

  if (bookId && chapter && verse) {
    const bookNumber = resolveBookNumber(bookId);
    if (!bookNumber) {
      throw new Error('Livre invalide.');
    }

    const id = `${bookNumber}-${chapter}-${verse}`;
    const verseRows = await runNaveQuery(
      'SELECT ref FROM VERSES WHERE id=@id LIMIT 1;',
      { '@id': id }
    );
    const refValue = (verseRows[0] as { ref?: unknown } | undefined)?.ref;

    let topicIds: string[] = [];
    if (typeof refValue === 'string') {
      try {
        const parsed = JSON.parse(refValue);
        topicIds = Array.isArray(parsed)
          ? parsed.map((value) => String(value)).filter(Boolean)
          : [];
      } catch {
        topicIds = [];
      }
    }

    const uniqueTopics = Array.from(new Set(topicIds)).slice(0, 200);
    if (uniqueTopics.length === 0) {
      return {
        id,
        query: 'verse' as const,
        topics: [] as NaveTopic[],
      };
    }

    const params: Record<string, string> = {};
    const placeholders = uniqueTopics.map((topic, index) => {
      const key = `@t${index}`;
      params[key] = topic;
      return key;
    });
    const rows = await runNaveQuery(
      `SELECT name, name_lower, description FROM TOPICS ` +
      `WHERE name_lower IN (${placeholders.join(',')}) ORDER BY name_lower ASC;`,
      params
    );

    return {
      id,
      query: 'verse' as const,
      topics: rows.map((row) => mapNaveTopic(row as Record<string, unknown>)),
    };
  }

  throw new Error('Paramètres manquants: term ou (bookId, chapter, verse).');
}
