import { BibleBook } from '../../bibleCatalog';
import { BibleParser, VerseRow } from './types';
import { StandardJsonParser } from './standard';
import { IndexedParser } from './indexed';
import { SimpleArrayParser } from './simple-array';
import { OsisParser } from './osis';

const parsers: BibleParser[] = [
  new StandardJsonParser(),
  new IndexedParser(),
  new SimpleArrayParser(),
  new OsisParser(),
];

export function parseBibleJson(data: any, book: BibleBook, chapter: number): VerseRow[] {
  if (!data) return [];

  for (const parser of parsers) {
    if (parser.canParse(data)) {
      try {
        const result = parser.parse(data, book, chapter);
        if (result && result.length > 0) {
          return result;
        }
      } catch (err) {
        console.error(`[Parser] ${parser.name} failed:`, err);
        // Continue to next parser
      }
    }
  }

  return [];
}

export * from './types';
