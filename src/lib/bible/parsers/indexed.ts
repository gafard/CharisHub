import { BibleBook } from '../../bibleData';
import { BibleParser, VerseRow } from './types';
import { BIBLE_BOOKS } from '../../bibleCatalog';

export class IndexedParser implements BibleParser {
  name = 'Indexed JSON (BookNum -> ChapterNum -> VerseNum)';

  canParse(data: any): boolean {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        const numericBookKeys = Object.keys(data).filter((key) => /^\d+$/.test(key));
        return numericBookKeys.length >= 60; // Most likely a Bible if it has 60+ numeric keys
    }
    return false;
  }

  parse(data: any, book: BibleBook, chapter: number): VerseRow[] {
    const bookIndex = BIBLE_BOOKS.findIndex((b) => b.id === book.id) + 1;
    const bookData = data[String(bookIndex)];
    
    if (!bookData || typeof bookData !== 'object') return [];
    
    const chapterData = (bookData as Record<string, unknown>)[String(chapter)];
    if (!chapterData || typeof chapterData !== 'object') return [];
    
    return Object.entries(chapterData as Record<string, unknown>)
      .filter(([key]) => /^\d+$/.test(key))
      .map(([key, value]) => ({
        number: Number(key),
        text: String(value ?? '').trim(),
      }))
      .filter((row) => row.number > 0 && row.text)
      .sort((a, b) => a.number - b.number);
  }
}
