import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { BIBLE_BOOKS } from '@/lib/bibleCatalog';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get('bookId');
  const chapter = searchParams.get('chapter');
  const verse = searchParams.get('verse');

  if (!bookId || !chapter || !verse) {
    return NextResponse.json({ error: 'bookId, chapter, and verse are required' }, { status: 400 });
  }

  const dbPath = path.join(process.cwd(), 'data', 'strong.sqlite');
  let db;

  try {
    db = new Database(dbPath, { readonly: true });

    // 1. Trouver l'index du livre (1-66)
    const bookIndex = BIBLE_BOOKS.findIndex(b => b.id === bookId.toLowerCase());
    if (bookIndex === -1) {
      return NextResponse.json({ error: 'Invalid bookId' }, { status: 400 });
    }
    const bookNo = bookIndex + 1;
    const bookInfo = BIBLE_BOOKS[bookIndex];
    const isOT = bookInfo.testament === 'OT';
    const tableName = isOT ? 'LSGSAT2' : 'LSGSNT2';
    const langTable = isOT ? 'Hebreu' : 'Grec';

    // 2. Récupérer le texte enrichi de codes Strong
    const verseRow = db.prepare(`SELECT Texte FROM ${tableName} WHERE Livre = ? AND Chapitre = ? AND Verset = ?`).get(bookNo, chapter, verse) as { Texte: string } | undefined;

    if (!verseRow) {
      return NextResponse.json({ error: 'Verse not found' }, { status: 404 });
    }

    const rawText = verseRow.Texte;
    
    // 3. Parser le texte
    // Format typique: "Car 1063 Dieu 2316 a tant 3779 aimé 25 (5656)..."
    const words: any[] = [];
    const tokens = rawText.split(/\s+/);
    
    let currentWord: string | null = null;
    
    for (const token of tokens) {
      // Si c'est un numéro Strong
      if (/^\d+$/.test(token)) {
        const strongCode = token;
        // Chercher les détails dans le lexique
        const lexique = db.prepare(`SELECT * FROM ${langTable} WHERE Code = ?`).get(strongCode) as any;
        
        if (currentWord) {
          words.push({
            translation: currentWord,
            strongNumber: (isOT ? 'H' : 'G') + strongCode,
            original: lexique ? lexique[isOT ? 'Hebreu' : 'Grec'] : '?',
            transliteration: lexique ? lexique.Mot : '?',
            phonetic: lexique ? lexique.Phonetique : '',
            definition: lexique ? lexique.Definition : '',
            morphology: '' // Sera rempli par le token suivant si présent
          });
          currentWord = null;
        }
      } 
      // Si c'est une morphologie (ex: (5656))
      else if (/^\(\d+\)$/.test(token)) {
        if (words.length > 0) {
          words[words.length - 1].morphology = token.slice(1, -1);
        }
      }
      // Sinon c'est un mot de la traduction
      else {
        if (currentWord) {
          // Si on avait un mot sans Strong (rare mais possible), on le pousse
          words.push({ translation: currentWord, strongNumber: null });
        }
        currentWord = token;
      }
    }
    
    // Dernier mot si non suivi d'un code
    if (currentWord) {
      words.push({ translation: currentWord, strongNumber: null });
    }

    return NextResponse.json({
      bookId,
      chapter: parseInt(chapter),
      verse: parseInt(verse),
      text: rawText.replace(/\s+\d+(\s+\(\d+\))?/g, ''), // Version propre sans codes
      words
    });

  } catch (error: any) {
    console.error('Interlinear API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (db) db.close();
  }
}
