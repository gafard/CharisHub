import { BibleBook } from '../../bibleData';
import { BibleParser, VerseRow } from './types';
import { extractVerseNumber, extractVerseText } from './utils';

export class SimpleArrayParser implements BibleParser {
  name = 'Simple Array JSON';

  canParse(data: any): boolean {
    return Array.isArray(data) || (data && Array.isArray(data.books)) || (data && Array.isArray(data.bible));
  }

  parse(data: any, book: BibleBook, chapter: number): VerseRow[] {
    const dataBooks = Array.isArray(data) ? data : data?.books ?? data?.bible ?? [];
    if (!Array.isArray(dataBooks) || dataBooks.length === 0) return [];

    // Find book by index usually for this format
    // In the original code, findBookIndex was used. I'll need that logic.
    // Let's assume for now we use the index if it's a raw array of books.
    
    // We'll need access to BIBLE_BOOKS for indexing
    const { BIBLE_BOOKS } = require('../../bibleCatalog');
    const bookIndex = BIBLE_BOOKS.findIndex((b: any) => b.id === book.id);
    const bookData = dataBooks[bookIndex] ?? dataBooks[0];

    const chapters = bookData?.chapters ?? bookData?.Chapters ?? [];
    const chapterData = Array.isArray(chapters)
      ? chapters[chapter - 1]
      : chapters?.[String(chapter)] || [];

    if (!chapterData) return [];

    if (Array.isArray(chapterData)) {
      return chapterData.map((verse: any, idx: number) => ({
        number: extractVerseNumber(verse, idx),
        text: extractVerseText(verse),
      })).filter((v) => v.text);
    }

    if (typeof chapterData === 'object') {
      const keys = Object.keys(chapterData).filter((key) => /^\d+$/.test(key));
      if (!keys.length) return [];
      return keys
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => ({
          number: Number(key),
          text: String(chapterData[key]).trim(),
        }))
        .filter((row) => row.text);
    }

    return [];
  }
}
