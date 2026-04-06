import { NextResponse } from 'next/server';
import { BIBLE_BOOKS } from '@/lib/bibleCatalog';

export const runtime = 'nodejs';

// French book name aliases → book id lookup
const BOOK_ALIASES: Record<string, string> = {
    // Pentateuch
    'genèse': 'GEN', 'gn': 'GEN', 'gen': 'GEN',
    'exode': 'EXO', 'ex': 'EXO',
    'lévitique': 'LEV', 'lev': 'LEV', 'lv': 'LEV',
    'nombres': 'NUM', 'nb': 'NUM', 'num': 'NUM',
    'deutéronome': 'DEU', 'dt': 'DEU', 'deu': 'DEU',
    // Historical
    'josué': 'JOS', 'jos': 'JOS',
    'juges': 'JDG', 'jg': 'JDG',
    'ruth': 'RUT', 'rt': 'RUT',
    '1 samuel': '1SA', '1sa': '1SA', '1sm': '1SA',
    '2 samuel': '2SA', '2sa': '2SA', '2sm': '2SA',
    '1 rois': '1KI', '1ro': '1KI', '1r': '1KI',
    '2 rois': '2KI', '2ro': '2KI', '2r': '2KI',
    '1 chroniques': '1CH', '1ch': '1CH',
    '2 chroniques': '2CH', '2ch': '2CH',
    'esdras': 'EZR', 'esd': 'EZR',
    'néhémie': 'NEH', 'né': 'NEH', 'neh': 'NEH',
    'esther': 'EST', 'est': 'EST',
    // Poetry
    'job': 'JOB',
    'psaumes': 'PSA', 'ps': 'PSA', 'psa': 'PSA',
    'proverbes': 'PRO', 'pr': 'PRO', 'pro': 'PRO',
    'ecclésiaste': 'ECC', 'ec': 'ECC', 'qo': 'ECC',
    'cantique des cantiques': 'SNG', 'ct': 'SNG', 'ca': 'SNG',
    // Major prophets
    'ésaïe': 'ISA', 'és': 'ISA', 'isa': 'ISA', 'es': 'ISA',
    'jérémie': 'JER', 'jér': 'JER', 'jr': 'JER', 'jer': 'JER',
    'lamentations': 'LAM', 'la': 'LAM',
    'ézéchiel': 'EZK', 'éz': 'EZK', 'ez': 'EZK',
    'daniel': 'DAN', 'dn': 'DAN', 'da': 'DAN',
    // Minor prophets
    'osée': 'HOS', 'os': 'HOS',
    'joël': 'JOL', 'jl': 'JOL',
    'amos': 'AMO', 'am': 'AMO',
    'abdias': 'OBA', 'ab': 'OBA',
    'jonas': 'JON', 'jon': 'JON',
    'michée': 'MIC', 'mi': 'MIC',
    'nahoum': 'NAM', 'na': 'NAM',
    'habacuc': 'HAB', 'ha': 'HAB',
    'sophonie': 'ZEP', 'so': 'ZEP',
    'aggée': 'HAG', 'ag': 'HAG',
    'zacharie': 'ZEC', 'za': 'ZEC',
    'malachie': 'MAL', 'ml': 'MAL',
    // NT Gospels
    'matthieu': 'MAT', 'mt': 'MAT', 'mat': 'MAT',
    'marc': 'MRK', 'mc': 'MRK',
    'luc': 'LUK', 'lc': 'LUK',
    'jean': 'JHN', 'jn': 'JHN', 'joh': 'JHN',
    'actes': 'ACT', 'ac': 'ACT', 'act': 'ACT',
    // Pauline
    'romains': 'ROM', 'rm': 'ROM', 'ro': 'ROM',
    '1 corinthiens': '1CO', '1co': '1CO', '1cor': '1CO',
    '2 corinthiens': '2CO', '2co': '2CO', '2cor': '2CO',
    'galates': 'GAL', 'ga': 'GAL',
    'éphésiens': 'EPH', 'ép': 'EPH', 'ep': 'EPH',
    'philippiens': 'PHP', 'ph': 'PHP', 'phi': 'PHP',
    'colossiens': 'COL', 'col': 'COL',
    '1 thessaloniciens': '1TH', '1th': '1TH',
    '2 thessaloniciens': '2TH', '2th': '2TH',
    '1 timothée': '1TI', '1ti': '1TI', '1tm': '1TI',
    '2 timothée': '2TI', '2ti': '2TI', '2tm': '2TI',
    'tite': 'TIT', 'tt': 'TIT',
    'philémon': 'PHM', 'phm': 'PHM',
    'hébreux': 'HEB', 'hé': 'HEB', 'heb': 'HEB',
    // General
    'jacques': 'JAS', 'jac': 'JAS', 'ja': 'JAS',
    '1 pierre': '1PE', '1pe': '1PE', '1pi': '1PE',
    '2 pierre': '2PE', '2pe': '2PE', '2pi': '2PE',
    '1 jean': '1JN', '1jn': '1JN',
    '2 jean': '2JN', '2jn': '2JN',
    '3 jean': '3JN', '3jn': '3JN',
    'jude': 'JUD',
    'apocalypse': 'REV', 'ap': 'REV', 'apo': 'REV', 'rev': 'REV',
};

function resolveBookId(bookName: string): string | null {
    const clean = bookName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    // Direct alias match
    const fromAlias = BOOK_ALIASES[clean];
    if (fromAlias) return fromAlias;
    // Try with diacritics too
    const fromAlias2 = BOOK_ALIASES[bookName.toLowerCase().trim()];
    if (fromAlias2) return fromAlias2;
    // Try partial match against BIBLE_BOOKS
    const matched = BIBLE_BOOKS.find((b) =>
        b.name.toLowerCase().startsWith(clean.slice(0, 3)) ||
        b.id.toLowerCase() === clean
    );
    return matched?.id ?? null;
}

export async function GET(req: Request) {
    const { searchParams, origin } = new URL(req.url);
    const bookName = searchParams.get('book') ?? '';
    const chapter = parseInt(searchParams.get('chapter') ?? '0');
    const verse = parseInt(searchParams.get('verse') ?? '0');

    if (!bookName || !chapter || !verse) {
        return NextResponse.json({ error: 'book, chapter et verse sont requis.' }, { status: 400 });
    }

    try {
        const bookId = resolveBookId(bookName);
        if (!bookId) {
            return NextResponse.json({ error: `Livre non reconnu: ${bookName}` }, { status: 404 });
        }

        // Fetch from our own origin — public/ files are served at root on Vercel
        const bibleUrl = `${origin}/bibles/lsg/bible.json`;
        const res = await fetch(bibleUrl, { cache: 'force-cache' });
        if (!res.ok) throw new Error(`Bible JSON introuvable (${res.status})`);
        const payload = await res.json();

        let booksArr: any[] = [];
        if (Array.isArray(payload)) booksArr = payload;
        else if (payload.books) booksArr = payload.books;
        else if (payload.data) booksArr = payload.data;

        // BIBLE_BOOKS in memory matches the order of books in the LSG dump
        const bookIndex = BIBLE_BOOKS.findIndex((b) => b.id === bookId);
        if (bookIndex === -1 || !booksArr[bookIndex]) {
            throw new Error('Données du livre introuvables');
        }

        const bookData = booksArr[bookIndex];
        const chapters = bookData.chapters || [];

        // Handle 0-indexed vs 1-indexed chapters in French dumps
        const parsedChapters = chapters.map((c: any) => ({ entry: c, number: Number(c?.chapter ?? c?.number ?? c?.id) }));
        const numbers = parsedChapters.map((c: any) => c.number).filter((n: number) => !isNaN(n));
        const hasZero = numbers.includes(0);
        const hasOne = numbers.includes(1);

        let chapterData;
        if (hasZero && !hasOne) {
            const maxNumber = Math.max(...numbers);
            const target = maxNumber >= chapters.length ? (chapter === 1 ? 0 : chapter) : chapter - 1;
            chapterData = parsedChapters.find((c: any) => c.number === target)?.entry ?? chapters[target];
        } else {
            chapterData = parsedChapters.find((c: any) => c.number === chapter)?.entry ?? chapters[chapter - 1];
        }

        if (!chapterData) {
            return NextResponse.json({ error: 'Chapitre introuvable.' }, { status: 404 });
        }

        const rawVerses: any[] = chapterData?.verses ?? chapterData?.verse ?? [];

        const verseRows = rawVerses.map((v: any, idx: number) => {
            let n = Number(v?.number ?? v?.verse ?? v?.id);
            if (isNaN(n)) n = idx + 1;
            return { number: n, text: String(v?.text ?? v?.content ?? '').trim() };
        }).filter(r => r.text);

        // Find context: verse - 1, verse, verse + 1
        const centerIndex = verseRows.findIndex(v => v.number === verse);
        let startIdx = 0;
        let endIdx = 0;

        if (centerIndex >= 0) {
            startIdx = Math.max(0, centerIndex - 1);
            endIdx = Math.min(verseRows.length, centerIndex + 2);
        } else {
            // Verse number not explicitly found? Fallback to index-based lookup
            const fallbackIndex = Math.max(0, verse - 1);
            if (fallbackIndex < verseRows.length) {
                startIdx = Math.max(0, fallbackIndex - 1);
                endIdx = Math.min(verseRows.length, fallbackIndex + 2);
            } else {
                return NextResponse.json({ error: 'Verset introuvable.' }, { status: 404 });
            }
        }

        const rows = verseRows.slice(startIdx, endIdx).map((r) => ({
            number: r.number === 0 ? 1 : r.number, // normalize 0-indexed Genesis 1:1 if needed
            text: r.text
        }));

        return NextResponse.json({ bookId, chapter, verse, rows });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? 'Erreur interne.' }, { status: 500 });
    }
}

