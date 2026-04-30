import { BibleBook } from '../../bibleData';
import { BibleParser, VerseRow } from './types';
import { normalize, extractVerseNumber, extractVerseText } from './utils';
import { BIBLE_BOOKS } from '../../bibleCatalog';

export class StandardJsonParser implements BibleParser {
  name = 'Standard JSON (Books/Chapters Array)';

  canParse(data: any): boolean {
    return (data && Array.isArray(data.books)) || (data && data.bible && Array.isArray(data.bible));
  }

  parse(data: any, book: BibleBook, chapter: number): VerseRow[] {
    const books = Array.isArray(data.books) ? data.books : data.bible;
    
    // 1. Find the book
    const bookNames = [book.name, book.apiName, book.slug];
    let bookData = null;
    
    for (const name of bookNames) {
      bookData = books.find((b: any) =>
        normalize(b.name || b.book || b.title || b.BookName || b.Book || '') === normalize(name)
      );
      if (bookData) break;
    }

    if (!bookData) {
      // Try by index if name matching fails
      const bookIndex = BIBLE_BOOKS.findIndex((b) => b.id === book.id);
      bookData = books[bookIndex];
    }

    if (!bookData) return [];

    // 2. Find the chapter
    const chapters = bookData.chapters || bookData.Chapters || bookData.chapter || [];
    const chapterData = chapters.find((ch: any) => 
      ch.chapter === chapter || 
      ch.number === chapter || 
      parseInt(ch.chapter) === chapter ||
      ch.id === chapter
    ) || chapters[chapter - 1];

    if (!chapterData) return [];

    // 3. Extract verses
    const verses = chapterData.verses || chapterData.Verses || chapterData.verse || chapterData.vs || [];
    if (!Array.isArray(verses)) {
        // Handle object-based verses if any
        if (typeof verses === 'object') {
             return Object.entries(verses)
                .filter(([key]) => /^\d+$/.test(key))
                .map(([key, value]) => ({
                    number: Number(key),
                    text: String(value ?? '').trim(),
                }))
                .filter(v => v.text);
        }
        return [];
    }

    return verses.map((verse: any, idx: number) => ({
      number: extractVerseNumber(verse, idx),
      text: extractVerseText(verse),
    })).filter((verse) => verse.text);
  }
}
