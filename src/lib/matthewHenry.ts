import fs from 'node:fs';
import path from 'node:path';
import { BIBLE_BOOKS } from '@/lib/bibleCatalog';
import { runSqliteJsonQuery } from '@/lib/sqliteQuery';

export type MatthewHenrySection = {
  key: string;
  html: string;
};

function normalizeCommentaryPayload(raw: unknown): Record<string, string> {
  if (!raw) return {};

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const json = JSON.parse(trimmed);
        if (Array.isArray(json)) {
          return Object.fromEntries(json.map((value, idx) => [String(idx), String(value)]));
        }
        if (json && typeof json === 'object') {
          return json as Record<string, string>;
        }
      } catch {
        return { '0': raw };
      }
    }

    return { '0': raw };
  }

  if (typeof raw === 'object') {
    return raw as Record<string, string>;
  }

  return {};
}

function resolveBookNumber(bookId?: string | null): number | null {
  if (!bookId) return null;
  const index = BIBLE_BOOKS.findIndex((book) => book.id === bookId);
  if (index === -1) return null;
  return index + 1;
}

export function resolveMatthewHenryDbPath(): string | null {
  const homeDir = process.env.HOME ? path.join(process.env.HOME, 'Downloads', 'g', 'bible-strong-databases') : null;
  const baseFromStrong = process.env.STRONG_DB_PATH
    ? path.dirname(process.env.STRONG_DB_PATH)
    : null;
  const rawCandidates = [
    process.env.MATTHEW_HENRY_DB_PATH,
    baseFromStrong ? path.join(baseFromStrong, 'matthew_henry.sqlite') : null,
    homeDir ? path.join(homeDir, 'matthew_henry.sqlite') : null,
    path.join(process.cwd(), 'data', 'matthew_henry.sqlite'),
    path.join(process.cwd(), 'public', 'data', 'matthew_henry.sqlite'),
  ].filter(Boolean) as string[];

  for (const candidate of rawCandidates) {
    const resolved = path.resolve(candidate);
    try {
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        const inDir = path.join(resolved, 'matthew_henry.sqlite');
        if (fs.existsSync(inDir)) return inDir;
      } else if (stat.isFile()) {
        return resolved;
      }
    } catch {
      // Ignore invalid candidates and continue with the next location.
    }
  }

  return null;
}

export async function loadMatthewHenryCommentary({
  bookId,
  chapter,
  id,
}: {
  bookId?: string | null;
  chapter?: number | null;
  id?: string | null;
}) {
  let resolvedId = id?.trim() || null;
  if (!resolvedId && bookId && chapter) {
    const bookNumber = resolveBookNumber(bookId);
    if (!bookNumber) {
      throw new Error('Livre invalide.');
    }
    resolvedId = `${bookNumber}-${chapter}`;
  }

  if (!resolvedId) {
    throw new Error('Paramètres manquants: id ou (bookId, chapter).');
  }

  const dbPath = resolveMatthewHenryDbPath();
  if (!dbPath) {
    throw new Error('MATTHEW_HENRY_DB_PATH introuvable. Définis MATTHEW_HENRY_DB_PATH vers matthew_henry.sqlite.');
  }

  const rows = await runSqliteJsonQuery(
    dbPath,
    'SELECT commentaires FROM COMMENTAIRES WHERE id=@id LIMIT 1;',
    { '@id': resolvedId }
  );

  const raw = rows[0]?.commentaires;
  const parsed = normalizeCommentaryPayload(raw);
  const sections = Object.entries(parsed)
    .sort(([left], [right]) => {
      const leftNumber = Number(left);
      const rightNumber = Number(right);
      if (Number.isNaN(leftNumber) || Number.isNaN(rightNumber)) {
        return left.localeCompare(right, 'fr', { numeric: true });
      }
      return leftNumber - rightNumber;
    })
    .map(([key, html]) => ({ key, html: String(html ?? '') }))
    .filter((section) => section.html.trim().length > 0);

  return {
    id: resolvedId,
    dbPath,
    raw,
    rowsCount: rows.length,
    sections,
  };
}
