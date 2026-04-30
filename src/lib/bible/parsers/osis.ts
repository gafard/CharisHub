import { BibleBook } from '../../bibleData';
import { BibleParser, VerseRow } from './types';

// Map for OSIS IDs if they differ from our internal IDs
const OSIS_MAP: Record<string, string> = {
  'gen': 'Gen', 'exo': 'Exod', 'lev': 'Lev', 'num': 'Num', 'deu': 'Deut',
  'jos': 'Josh', 'jdg': 'Judg', 'rut': 'Ruth', '1sa': '1Sam', '2sa': '2Sam',
  '1ki': '1Kgs', '2ki': '2Kgs', '1ch': '1Chron', '2ch': '2Chron', 'ezr': 'Ezra',
  'neh': 'Neh', 'est': 'Esth', 'job': 'Job', 'psa': 'Ps', 'pro': 'Prov',
  'ecc': 'Eccl', 'sng': 'Song', 'isa': 'Isa', 'jer': 'Jer', 'lam': 'Lam',
  'eze': 'Ezek', 'dan': 'Dan', 'hos': 'Hos', 'jol': 'Joel', 'amo': 'Amos',
  'oba': 'Obad', 'jon': 'Jonah', 'mic': 'Mic', 'nam': 'Nah', 'hab': 'Hab',
  'zep': 'Zeph', 'hag': 'Hag', 'zec': 'Zech', 'mal': 'Mal',
  'mat': 'Matt', 'mrk': 'Mark', 'luk': 'Luke', 'jhn': 'John', 'act': 'Acts',
  'rom': 'Rom', '1co': '1Cor', '2co': '2Cor', 'gal': 'Gal', 'eph': 'Eph',
  'php': 'Phil', 'col': 'Col', '1th': '1Thess', '2th': '2Thess', '1ti': '1Tim',
  '2ti': '2Tim', 'tit': 'Titus', 'phm': 'Phlm', 'heb': 'Heb', 'jas': 'Jas',
  '1pe': '1Pet', '2pe': '2Pet', '1jn': '1John', '2jn': '2John', '3jn': '3John',
  'jud': 'Jude', 'rev': 'Rev'
};

export class OsisParser implements BibleParser {
  name = 'OSIS XML Parser';

  canParse(data: any): boolean {
    return data instanceof Document || (data && data.nodeType === 9);
  }

  parse(data: Document, book: BibleBook, chapter: number): VerseRow[] {
    const osis = OSIS_MAP[book.id] || book.apiName;
    const bookNode = data.querySelector(`div[osisID="${osis}"]`);
    if (!bookNode) return [];
    
    const chapterNode =
      bookNode.querySelector(`chapter[osisID="${osis}.${chapter}"]`) ||
      bookNode.querySelector(`chapter[osisID="${osis} ${chapter}"]`);
    
    if (!chapterNode) return [];
    
    const verseNodes = Array.from(chapterNode.querySelectorAll('verse'));
    return verseNodes
      .map((node, idx) => {
        const osisId = node.getAttribute('osisID') || '';
        const numberMatch = osisId.split('.').pop() || '';
        const number = Number(numberMatch) || idx + 1;
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text) return null;
        return { number, text };
      })
      .filter(Boolean) as VerseRow[];
  }
}
