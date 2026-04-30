import { BibleBook } from '../../bibleCatalog';

export interface VerseRow {
  number: number;
  text: string;
}

export interface BibleParser {
  name: string;
  canParse(data: any): boolean;
  parse(data: any, book: BibleBook, chapter: number): VerseRow[];
}
