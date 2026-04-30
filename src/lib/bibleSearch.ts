/**
 * Bible Full-Text Search — Cross-translation search engine.
 */
import logger from '@/lib/logger';
import { loadLocalBible, type LocalBible, type LocalVerse } from './localBible';

export interface SearchResult {
  verse: LocalVerse;
  translationId: string;
  score: number;
  highlights: string[];
}

export interface GroupedSearchResult {
  reference: string;
  bookName: string;
  chapter: number;
  verse: number;
  translations: SearchResult[];
  bestScore: number;
}

export interface SearchOptions {
  limit?: number;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  bookFilter?: string;
}

function norm(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function escRx(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function score(text: string, q: string): number {
  const lt = norm(text), lq = norm(q);
  if (!lt.includes(lq)) return 0;
  let s = 1;
  if (lt === lq) s += 10;
  if (lt.startsWith(lq)) s += 3;
  if (new RegExp(`\\b${escRx(lq)}\\b`).test(lt)) s += 2;
  s += (lq.length / lt.length) * 5;
  const count = lt.split(lq).length - 1;
  if (count > 1) s += count * 0.5;
  return Math.round(s * 100) / 100;
}

function highlight(text: string, q: string): string {
  const idx = norm(text).indexOf(norm(q));
  if (idx === -1) return text.slice(0, 100);
  const a = Math.max(0, idx - 40), b = Math.min(text.length, idx + q.length + 40);
  return (a > 0 ? '…' : '') + text.slice(a, b) + (b < text.length ? '…' : '');
}

export async function searchTranslation(
  query: string, translationId: string, opts: SearchOptions = {}
): Promise<SearchResult[]> {
  const { limit = 50, bookFilter } = opts;
  if (query.trim().length < 2) return [];
  let bible: LocalBible;
  try { bible = await loadLocalBible(translationId); }
  catch (e) { logger.error(`[BibleSearch] ${translationId}:`, e); return []; }
  const results: SearchResult[] = [];
  const nq = norm(query);
  for (const book of bible.books) {
    if (bookFilter && book.abbreviation.toLowerCase() !== bookFilter.toLowerCase()) continue;
    for (const ch of book.chapters) {
      for (const v of ch.verses) {
        if (!norm(v.text).includes(nq)) continue;
        const s = score(v.text, query);
        if (s <= 0) continue;
        results.push({
          verse: { version: bible.version, book: book.name, bookAbbr: book.abbreviation, chapter: ch.chapter, verse: v.verse, text: v.text },
          translationId, score: s, highlights: [highlight(v.text, query)],
        });
        if (results.length >= limit) break;
      }
      if (results.length >= limit) break;
    }
    if (results.length >= limit) break;
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

export async function searchAllTranslations(
  query: string, translationIds: string[] = ['lsg', 'BDS'], opts: SearchOptions = {}
): Promise<GroupedSearchResult[]> {
  if (query.trim().length < 2) return [];
  const all = await Promise.all(translationIds.map(id => searchTranslation(query, id, opts)));
  const groups = new Map<string, GroupedSearchResult>();
  for (const results of all) {
    for (const r of results) {
      const key = `${r.verse.book}:${r.verse.chapter}:${r.verse.verse}`;
      const g = groups.get(key);
      if (g) { g.translations.push(r); g.bestScore = Math.max(g.bestScore, r.score); }
      else groups.set(key, { reference: `${r.verse.book} ${r.verse.chapter}:${r.verse.verse}`, bookName: r.verse.book, chapter: r.verse.chapter, verse: r.verse.verse, translations: [r], bestScore: r.score });
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.bestScore - a.bestScore);
}

export function getSearchSuggestions(partial: string): string[] {
  const terms = ['amour','grâce','foi','espérance','paix','joie','miséricorde','justice','salut','rédemption','pardon','sagesse','force','lumière','vie éternelle','résurrection','prière','bénédiction','alliance','promesse','fidélité','berger','agneau','vigne','Saint-Esprit','royaume','gloire','sainteté','baptême'];
  const n = norm(partial);
  if (n.length < 2) return [];
  return terms.filter(t => norm(t).includes(n)).slice(0, 8);
}
