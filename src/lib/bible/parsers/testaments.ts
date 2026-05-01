import { BibleBook } from '../../bibleCatalog';
import { BibleParser, VerseRow } from './types';
import { extractVerseNumber, extractVerseText } from './utils';
import { BIBLE_BOOKS } from '../../bibleCatalog';

// Handles bibles structured as { Testaments: [{ Books: [...OT] }, { Books: [...NT] }] }
// Used by DARBY, MARTIN, OSTERVALD, COLOMBE, PAROLE_DE_VIE, NOUVELLE_SEGOND, etc.
export class TestamentsParser implements BibleParser {
  name = 'Testaments JSON (OT/NT split)';

  canParse(data: any): boolean {
    return (
      data &&
      typeof data === 'object' &&
      Array.isArray(data.Testaments) &&
      data.Testaments.length >= 1 &&
      Array.isArray(data.Testaments[0]?.Books)
    );
  }

  parse(data: any, book: BibleBook, chapter: number): VerseRow[] {
    const bookIndex = BIBLE_BOOKS.findIndex((b) => b.id === book.id);
    if (bookIndex < 0) return [];

    // OT = Testaments[0], NT = Testaments[1]
    let bookData: any;
    if (bookIndex < 39) {
      bookData = data.Testaments[0]?.Books?.[bookIndex];
    } else {
      bookData = data.Testaments[1]?.Books?.[bookIndex - 39];
    }

    if (!bookData) return [];

    const chapters: any[] = bookData.Chapters || bookData.chapters || [];
    const chapterData = chapters[chapter - 1];
    if (!chapterData) return [];

    const verses: any[] = chapterData.Verses || chapterData.verses || [];
    return verses
      .map((v: any, idx: number) => ({
        number: extractVerseNumber(v, idx),
        text: extractVerseText(v),
      }))
      .filter((v) => v.text);
  }
}
