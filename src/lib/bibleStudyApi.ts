import { parseNaveTopics, type NaveTopic } from './bibleStudyClient';

export type BibleCommentarySection = {
  key: string;
  html: string;
};

export type BibleCommentaryResponse = {
  id: string;
  locale: string;
  source: string;
  sections: BibleCommentarySection[];
};

export type BibleNaveResponse = {
  source: string;
  query: 'term' | 'verse';
  topics: NaveTopic[];
  id?: string;
  term?: string;
  limit?: number;
};

export type BibleTreasuryResponse = {
  id: string;
  source: string;
  sourceTable: 'VERSES' | 'COMMENTAIRES' | '';
  entries: string[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback?: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function parseCommentarySections(value: unknown): BibleCommentarySection[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      const row = asRecord(entry);
      const key = asString(row.key);
      const html = asString(row.html);
      if (!key && !html) return null;
      return { key, html };
    })
    .filter((entry): entry is BibleCommentarySection => Boolean(entry));
}

function parseTreasurySourceTable(value: unknown): BibleTreasuryResponse['sourceTable'] {
  return value === 'VERSES' || value === 'COMMENTAIRES' ? value : '';
}

export function createBibleCommentaryResponse(
  value: Pick<BibleCommentaryResponse, 'id' | 'locale' | 'source' | 'sections'>
): BibleCommentaryResponse {
  return parseBibleCommentaryResponse(value);
}

export function parseBibleCommentaryResponse(value: unknown): BibleCommentaryResponse {
  const row = asRecord(value);

  return {
    id: asString(row.id),
    locale: asString(row.locale),
    source: asString(row.source),
    sections: parseCommentarySections(row.sections),
  };
}

export function createBibleNaveResponse(
  value: Omit<BibleNaveResponse, 'topics'> & { topics: unknown }
): BibleNaveResponse {
  return parseBibleNaveResponse(value);
}

export function parseBibleNaveResponse(value: unknown): BibleNaveResponse {
  const row = asRecord(value);
  const query = row.query === 'term' ? 'term' : 'verse';

  return {
    source: asString(row.source),
    query,
    topics: parseNaveTopics(row.topics),
    id: asString(row.id) || undefined,
    term: asString(row.term) || undefined,
    limit: asNumber(row.limit),
  };
}

export function createBibleTreasuryResponse(
  value: Pick<BibleTreasuryResponse, 'id' | 'source' | 'sourceTable' | 'entries'>
): BibleTreasuryResponse {
  return parseBibleTreasuryResponse(value);
}

export function parseBibleTreasuryResponse(value: unknown): BibleTreasuryResponse {
  const row = asRecord(value);

  return {
    id: asString(row.id),
    source: asString(row.source),
    sourceTable: parseTreasurySourceTable(row.sourceTable),
    entries: Array.isArray(row.entries)
      ? row.entries.map((entry) => String(entry)).filter(Boolean)
      : [],
  };
}
