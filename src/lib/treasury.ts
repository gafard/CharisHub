import fs from 'node:fs';
import path from 'node:path';
import { BIBLE_BOOKS } from '@/lib/bibleCatalog';
import { runSqliteJsonQuery } from '@/lib/sqliteQuery';

function resolveBookNumber(bookId?: string | null): number | null {
  if (!bookId) return null;
  const index = BIBLE_BOOKS.findIndex((book) => book.id === bookId);
  if (index === -1) return null;
  return index + 1;
}

export function resolveTreasuryDbPath(): string | null {
  const homeDir = process.env.HOME ? path.join(process.env.HOME, 'Downloads', 'g', 'bible-strong-databases') : null;
  const baseFromStrong = process.env.STRONG_DB_PATH
    ? path.dirname(process.env.STRONG_DB_PATH)
    : null;
  const rawCandidates = [
    process.env.TREASURY_DB_PATH,
    baseFromStrong ? path.join(baseFromStrong, 'treasury.sqlite') : null,
    homeDir ? path.join(homeDir, 'treasury.sqlite') : null,
    path.join(process.cwd(), 'data', 'treasury.sqlite'),
    path.join(process.cwd(), 'public', 'data', 'treasury.sqlite'),
  ].filter(Boolean) as string[];

  for (const candidate of rawCandidates) {
    const resolved = path.resolve(candidate);
    try {
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        const inDir = path.join(resolved, 'treasury.sqlite');
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

async function runTreasuryQuery(sql: string, params: Record<string, string | number> = {}) {
  const dbPath = resolveTreasuryDbPath();
  if (!dbPath) {
    throw new Error('TREASURY_DB_PATH introuvable. Définis TREASURY_DB_PATH vers treasury.sqlite.');
  }
  return runSqliteJsonQuery(dbPath, sql, params);
}

async function detectTreasuryTable() {
  const rows = await runTreasuryQuery(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('VERSES', 'COMMENTAIRES');"
  );
  const tables = new Set(
    rows
      .map((row) => String((row as { name?: unknown }).name ?? ''))
      .filter(Boolean)
  );
  if (tables.has('VERSES')) return 'VERSES' as const;
  if (tables.has('COMMENTAIRES')) return 'COMMENTAIRES' as const;
  return null;
}

export async function loadTreasuryEntries({
  bookId,
  chapter,
  verse,
  id,
}: {
  bookId?: string | null;
  chapter?: number | null;
  verse?: number | null;
  id?: string | null;
}) {
  let resolvedId = id?.trim() || null;
  if (!resolvedId && bookId && chapter && verse) {
    const bookNumber = resolveBookNumber(bookId);
    if (!bookNumber) {
      throw new Error('Livre invalide.');
    }
    resolvedId = `${bookNumber}-${chapter}-${verse}`;
  }

  if (!resolvedId) {
    throw new Error('Paramètres manquants: id ou (bookId, chapter, verse).');
  }

  const sourceTable = await detectTreasuryTable();
  if (!sourceTable) {
    throw new Error('Schéma Treasury inconnu: table VERSES ou COMMENTAIRES introuvable.');
  }

  const rows =
    sourceTable === 'VERSES'
      ? await runTreasuryQuery(
          'SELECT ref FROM VERSES WHERE id=@id LIMIT 1;',
          { '@id': resolvedId }
        )
      : await runTreasuryQuery(
          'SELECT commentaires AS ref FROM COMMENTAIRES WHERE id=@id LIMIT 1;',
          { '@id': resolvedId }
        );

  const raw = (rows[0] as { ref?: unknown } | undefined)?.ref;
  let entries: string[] = [];

  if (Array.isArray(raw)) {
    entries = raw.map((value) => String(value)).filter(Boolean);
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      entries = Array.isArray(parsed)
        ? parsed.map((value) => String(value)).filter(Boolean)
        : [];
    } catch {
      entries = [];
    }
  }

  return {
    id: resolvedId,
    sourceTable,
    entries,
  };
}
