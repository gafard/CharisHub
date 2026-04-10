export type ReadingPlanCategory =
    | 'commencer'
    | 'priere'
    | 'croissance'
    | 'relations'
    | 'panorama'
    | 'saisonnier';

export interface PlanReading {
    id: string;
    bookId: string;
    bookName: string;
    chapters: number[];
    label?: string;
}

export interface PlanDay {
    note?: string;
    readings: PlanReading[];
}

export interface ReadingPlan {
    id: string;
    name: string;
    description: string;
    emoji: string;
    category: ReadingPlanCategory;
    featured?: boolean;
    days: PlanDay[];
}

type BookSpec = {
    bookId: string;
    bookName: string;
    chapters: number;
};

type ChapterUnit = {
    bookId: string;
    bookName: string;
    chapter: number;
};

function primaryReading(bookId: string, bookName: string, chapters: number[], label?: string): PlanReading {
    return { id: 'primary', bookId, bookName, chapters, label };
}

function secondaryReading(id: string, bookId: string, bookName: string, chapters: number[], label?: string): PlanReading {
    return { id, bookId, bookName, chapters, label };
}

function day(...readings: PlanReading[]): PlanDay {
    return { readings };
}

function dayWindows(bookId: string, bookName: string, windows: number[][]): PlanDay[] {
    return windows.map((chapters) => day(primaryReading(bookId, bookName, chapters)));
}

function sequentialDays(bookId: string, bookName: string, windows: number[][]): PlanDay[] {
    return dayWindows(bookId, bookName, windows);
}

function chapterUnits(books: BookSpec[]): ChapterUnit[] {
    return books.flatMap(({ bookId, bookName, chapters }) =>
        Array.from({ length: chapters }, (_, index) => ({
            bookId,
            bookName,
            chapter: index + 1,
        })),
    );
}

function mergeUnitsToReadings(units: ChapterUnit[]): PlanReading[] {
    const grouped: Array<{ bookId: string; bookName: string; chapters: number[] }> = [];

    for (const unit of units) {
        const current = grouped[grouped.length - 1];
        if (current && current.bookId === unit.bookId) {
            current.chapters.push(unit.chapter);
            continue;
        }

        grouped.push({
            bookId: unit.bookId,
            bookName: unit.bookName,
            chapters: [unit.chapter],
        });
    }

    if (grouped.length === 1) {
        const [single] = grouped;
        return [primaryReading(single.bookId, single.bookName, single.chapters)];
    }

    return grouped.map((reading, index) =>
        secondaryReading(`r${index + 1}`, reading.bookId, reading.bookName, reading.chapters),
    );
}

function buildSequentialMixedDays(books: BookSpec[], daySizes: number[]): PlanDay[] {
    const units = chapterUnits(books);
    const days: PlanDay[] = [];
    let cursor = 0;

    for (const daySize of daySizes) {
        const slice = units.slice(cursor, cursor + daySize);
        cursor += daySize;
        days.push(day(...mergeUnitsToReadings(slice)));
    }

    return days;
}

function buildBalancedDaySizes(totalDays: number, totalChapters: number): number[] {
    const twoChapterDays = totalDays * 3 - totalChapters;
    let placedTwoChapterDays = 0;

    return Array.from({ length: totalDays }, (_, index) => {
        const shouldUseTwoChapters = Math.floor(((index + 1) * twoChapterDays) / totalDays) > placedTwoChapterDays;
        if (shouldUseTwoChapters) {
            placedTwoChapterDays += 1;
            return 2;
        }

        return 3;
    });
}

function buildNewTestamentNinetyDays(): PlanDay[] {
    const books: BookSpec[] = [
        { bookId: 'mat', bookName: 'Matthieu', chapters: 28 },
        { bookId: 'mrk', bookName: 'Marc', chapters: 16 },
        { bookId: 'luk', bookName: 'Luc', chapters: 24 },
        { bookId: 'jhn', bookName: 'Jean', chapters: 21 },
        { bookId: 'act', bookName: 'Actes', chapters: 28 },
        { bookId: 'rom', bookName: 'Romains', chapters: 16 },
        { bookId: '1co', bookName: '1 Corinthiens', chapters: 16 },
        { bookId: '2co', bookName: '2 Corinthiens', chapters: 13 },
        { bookId: 'gal', bookName: 'Galates', chapters: 6 },
        { bookId: 'eph', bookName: 'Éphésiens', chapters: 6 },
        { bookId: 'php', bookName: 'Philippiens', chapters: 4 },
        { bookId: 'col', bookName: 'Colossiens', chapters: 4 },
        { bookId: '1th', bookName: '1 Thessaloniciens', chapters: 5 },
        { bookId: '2th', bookName: '2 Thessaloniciens', chapters: 3 },
        { bookId: '1ti', bookName: '1 Timothée', chapters: 6 },
        { bookId: '2ti', bookName: '2 Timothée', chapters: 4 },
        { bookId: 'tit', bookName: 'Tite', chapters: 3 },
        { bookId: 'phm', bookName: 'Philémon', chapters: 1 },
        { bookId: 'heb', bookName: 'Hébreux', chapters: 13 },
        { bookId: 'jas', bookName: 'Jacques', chapters: 5 },
        { bookId: '1pe', bookName: '1 Pierre', chapters: 5 },
        { bookId: '2pe', bookName: '2 Pierre', chapters: 3 },
        { bookId: '1jo', bookName: '1 Jean', chapters: 5 },
        { bookId: '2jo', bookName: '2 Jean', chapters: 1 },
        { bookId: '3jo', bookName: '3 Jean', chapters: 1 },
        { bookId: 'jud', bookName: 'Jude', chapters: 1 },
        { bookId: 'rev', bookName: 'Apocalypse', chapters: 22 },
    ];

    const totalChapters = books.reduce((sum, book) => sum + book.chapters, 0);
    const daySizes = buildBalancedDaySizes(90, totalChapters);

    return buildSequentialMixedDays(books, daySizes);
}

const DEUTERONOMY_WINDOWS = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    [10, 11, 12],
    [13, 14, 15],
    [16, 17, 18],
    [19, 20, 21],
    [22, 23, 24],
    [25, 26, 27],
    [28, 29, 30],
    [31, 32],
    [33],
    [34],
];

export const READING_PLANS: ReadingPlan[] = [
    {
        id: 'discover-jesus-14',
        name: 'Découvrir Jésus en 14 jours',
        description: 'Un parcours d’entrée dans les Évangiles pour rencontrer Jésus pas à pas.',
        emoji: '✝️',
        category: 'commencer',
        featured: true,
        days: [
            day(primaryReading('jhn', 'Jean', [1])),
            day(primaryReading('mrk', 'Marc', [1])),
            day(primaryReading('luk', 'Luc', [5])),
            day(primaryReading('jhn', 'Jean', [3])),
            day(primaryReading('mat', 'Matthieu', [5])),
            day(primaryReading('luk', 'Luc', [15])),
            day(primaryReading('jhn', 'Jean', [6])),
            day(primaryReading('mrk', 'Marc', [4])),
            day(primaryReading('jhn', 'Jean', [8])),
            day(primaryReading('mat', 'Matthieu', [11])),
            day(primaryReading('jhn', 'Jean', [10])),
            day(primaryReading('luk', 'Luc', [19])),
            day(primaryReading('jhn', 'Jean', [13, 14])),
            day(primaryReading('jhn', 'Jean', [20, 21])),
        ],
    },
    {
        id: 'new-believers-21',
        name: 'Nouveaux croyants en 21 jours',
        description: 'Un itinéraire clair pour poser des fondations solides dans la foi.',
        emoji: '🔥',
        category: 'commencer',
        featured: true,
        days: [
            day(primaryReading('jhn', 'Jean', [1])),
            day(primaryReading('jhn', 'Jean', [3])),
            day(primaryReading('jhn', 'Jean', [4])),
            day(primaryReading('jhn', 'Jean', [6])),
            day(primaryReading('jhn', 'Jean', [10])),
            day(primaryReading('jhn', 'Jean', [13])),
            day(primaryReading('jhn', 'Jean', [15])),
            day(primaryReading('jhn', 'Jean', [17])),
            day(primaryReading('jhn', 'Jean', [20])),
            day(primaryReading('act', 'Actes', [1])),
            day(primaryReading('act', 'Actes', [2])),
            day(primaryReading('act', 'Actes', [4])),
            day(primaryReading('act', 'Actes', [9])),
            day(primaryReading('act', 'Actes', [16])),
            day(primaryReading('rom', 'Romains', [5])),
            day(primaryReading('rom', 'Romains', [6])),
            day(primaryReading('rom', 'Romains', [8])),
            day(primaryReading('rom', 'Romains', [10])),
            day(primaryReading('jas', 'Jacques', [1])),
            day(primaryReading('jas', 'Jacques', [2])),
            day(primaryReading('jas', 'Jacques', [5])),
        ],
    },
    {
        id: 'inner-healing-14',
        name: 'Guérison intérieure en 14 jours',
        description: 'Un parcours de consolation, de restauration et de vérité.',
        emoji: '💎',
        category: 'croissance',
        featured: true,
        days: [
            day(secondaryReading('r1', 'psa', 'Psaumes', [6]), secondaryReading('r2', 'psa', 'Psaumes', [13])),
            day(secondaryReading('r1', 'psa', 'Psaumes', [23]), secondaryReading('r2', 'psa', 'Psaumes', [27])),
            day(secondaryReading('r1', 'psa', 'Psaumes', [34]), secondaryReading('r2', 'psa', 'Psaumes', [42])),
            day(secondaryReading('r1', 'psa', 'Psaumes', [51]), secondaryReading('r2', 'psa', 'Psaumes', [61])),
            day(primaryReading('isa', 'Ésaïe', [40])),
            day(primaryReading('isa', 'Ésaïe', [43])),
            day(primaryReading('isa', 'Ésaïe', [53])),
            day(primaryReading('mat', 'Matthieu', [8])),
            day(primaryReading('mat', 'Matthieu', [11])),
            day(primaryReading('mat', 'Matthieu', [14])),
            day(primaryReading('jhn', 'Jean', [4])),
            day(primaryReading('jhn', 'Jean', [9])),
            day(primaryReading('jhn', 'Jean', [11])),
            day(primaryReading('jhn', 'Jean', [14])),
        ],
    },
    {
        id: 'gospel-john-7',
        name: "L'Évangile de Jean en 7 jours",
        description: 'Découvrez Jésus à travers le regard de Jean, 3 chapitres par jour.',
        emoji: '📖',
        category: 'commencer',
        days: [
            day(primaryReading('jhn', 'Jean', [1, 2, 3])),
            day(primaryReading('jhn', 'Jean', [4, 5, 6])),
            day(primaryReading('jhn', 'Jean', [7, 8, 9])),
            day(primaryReading('jhn', 'Jean', [10, 11, 12])),
            day(primaryReading('jhn', 'Jean', [13, 14, 15])),
            day(primaryReading('jhn', 'Jean', [16, 17, 18])),
            day(primaryReading('jhn', 'Jean', [19, 20, 21])),
        ],
    },
    {
        id: 'battle-psalms-10',
        name: 'Les Psaumes de combat en 10 jours',
        description: 'Protection, confiance, détresse et victoire à travers des psaumes choisis.',
        emoji: '🛡️',
        category: 'priere',
        days: [
            day(secondaryReading('r1', 'psa', 'Psaumes', [3]), secondaryReading('r2', 'psa', 'Psaumes', [18])),
            day(secondaryReading('r1', 'psa', 'Psaumes', [27]), secondaryReading('r2', 'psa', 'Psaumes', [34])),
            day(secondaryReading('r1', 'psa', 'Psaumes', [35]), secondaryReading('r2', 'psa', 'Psaumes', [46])),
            day(secondaryReading('r1', 'psa', 'Psaumes', [56]), secondaryReading('r2', 'psa', 'Psaumes', [57])),
            day(secondaryReading('r1', 'psa', 'Psaumes', [59]), secondaryReading('r2', 'psa', 'Psaumes', [61])),
            day(secondaryReading('r1', 'psa', 'Psaumes', [91]), secondaryReading('r2', 'psa', 'Psaumes', [94])),
            day(secondaryReading('r1', 'psa', 'Psaumes', [121]), secondaryReading('r2', 'psa', 'Psaumes', [124])),
            day(secondaryReading('r1', 'psa', 'Psaumes', [138]), secondaryReading('r2', 'psa', 'Psaumes', [140])),
            day(secondaryReading('r1', 'psa', 'Psaumes', [142]), secondaryReading('r2', 'psa', 'Psaumes', [143])),
            day(secondaryReading('r1', 'psa', 'Psaumes', [144]), secondaryReading('r2', 'psa', 'Psaumes', [145])),
        ],
    },
    {
        id: 'prayers-of-jesus-7',
        name: 'Prières de Jésus en 7 jours',
        description: 'Un parcours court pour apprendre à prier avec Jésus.',
        emoji: '🙏',
        category: 'priere',
        days: [
            day(secondaryReading('r1', 'luk', 'Luc', [3]), secondaryReading('r2', 'luk', 'Luc', [5])),
            day(primaryReading('luk', 'Luc', [6])),
            day(primaryReading('luk', 'Luc', [9])),
            day(secondaryReading('r1', 'mat', 'Matthieu', [6]), secondaryReading('r2', 'luk', 'Luc', [11])),
            day(primaryReading('jhn', 'Jean', [17])),
            day(primaryReading('mat', 'Matthieu', [26])),
            day(primaryReading('luk', 'Luc', [23])),
        ],
    },
    {
        id: 'psalms-30',
        name: 'Les Psaumes en 30 jours',
        description: '5 Psaumes par jour pour un mois de louange et méditation.',
        emoji: '🎵',
        category: 'priere',
        days: Array.from({ length: 30 }, (_, index) =>
            day(primaryReading('psa', 'Psaumes', [index * 5 + 1, index * 5 + 2, index * 5 + 3, index * 5 + 4, index * 5 + 5])),
        ),
    },
    {
        id: 'proverbs-31',
        name: 'Proverbes en 31 jours',
        description: 'Un chapitre de sagesse par jour, un mois complet.',
        emoji: '💡',
        category: 'croissance',
        days: Array.from({ length: 31 }, (_, index) => day(primaryReading('pro', 'Proverbes', [index + 1]))),
    },
    {
        id: 'women-of-the-bible-14',
        name: 'Femmes de la Bible en 14 jours',
        description: 'Un parcours narratif, concret et partageable à travers des figures clés.',
        emoji: '👩',
        category: 'relations',
        days: [
            day(primaryReading('gen', 'Genèse', [2, 3])),
            day(primaryReading('gen', 'Genèse', [18])),
            day(primaryReading('gen', 'Genèse', [24])),
            day(primaryReading('gen', 'Genèse', [29, 30])),
            day(primaryReading('exo', 'Exode', [2])),
            day(primaryReading('jdg', 'Juges', [4, 5])),
            day(primaryReading('rut', 'Ruth', [1])),
            day(primaryReading('rut', 'Ruth', [2, 3])),
            day(primaryReading('1sa', '1 Samuel', [1, 2])),
            day(primaryReading('est', 'Esther', [4, 5])),
            day(primaryReading('luk', 'Luc', [1])),
            day(primaryReading('jhn', 'Jean', [4])),
            day(secondaryReading('r1', 'luk', 'Luc', [10]), secondaryReading('r2', 'jhn', 'Jean', [11])),
            day(primaryReading('jhn', 'Jean', [20])),
        ],
    },
    {
        id: 'identity-in-christ-10',
        name: 'Identité en Christ en 10 jours',
        description: 'Jean, Romains, Éphésiens et Colossiens pour ancrer l’identité chrétienne.',
        emoji: '🕊️',
        category: 'croissance',
        days: [
            day(primaryReading('jhn', 'Jean', [1])),
            day(primaryReading('jhn', 'Jean', [15])),
            day(primaryReading('rom', 'Romains', [5])),
            day(primaryReading('rom', 'Romains', [8])),
            day(primaryReading('eph', 'Éphésiens', [1])),
            day(primaryReading('eph', 'Éphésiens', [2])),
            day(primaryReading('eph', 'Éphésiens', [4])),
            day(primaryReading('col', 'Colossiens', [1])),
            day(primaryReading('col', 'Colossiens', [2])),
            day(primaryReading('col', 'Colossiens', [3])),
        ],
    },
    {
        id: 'romans-16',
        name: "L'Épître aux Romains en 16 jours",
        description: 'Plongez dans la doctrine chrétienne fondamentale, un chapitre par jour.',
        emoji: '🏛️',
        category: 'croissance',
        days: Array.from({ length: 16 }, (_, index) => day(primaryReading('rom', 'Romains', [index + 1]))),
    },
    {
        id: 'holy-spirit-14',
        name: 'Saint-Esprit en 14 jours',
        description: 'Une traversée de Jean, Actes, Romains et Galates autour de l’Esprit.',
        emoji: '🔥',
        category: 'croissance',
        days: [
            day(primaryReading('jhn', 'Jean', [3])),
            day(primaryReading('jhn', 'Jean', [7])),
            day(primaryReading('jhn', 'Jean', [14])),
            day(primaryReading('jhn', 'Jean', [16])),
            day(primaryReading('act', 'Actes', [1])),
            day(primaryReading('act', 'Actes', [2])),
            day(primaryReading('act', 'Actes', [4])),
            day(primaryReading('act', 'Actes', [8])),
            day(primaryReading('act', 'Actes', [10])),
            day(primaryReading('act', 'Actes', [13])),
            day(primaryReading('act', 'Actes', [19])),
            day(primaryReading('rom', 'Romains', [8])),
            day(primaryReading('rom', 'Romains', [12])),
            day(primaryReading('gal', 'Galates', [5, 6])),
        ],
    },
    {
        id: 'wisdom-21',
        name: 'La Sagesse en 21 jours',
        description: "Explorez Job, les Proverbes et l'Ecclésiaste pour une vie guidée par Dieu.",
        emoji: '💎',
        category: 'croissance',
        days: [
            ...Array.from({ length: 7 }, (_, index) => day(primaryReading('job', 'Job', [index + 1]))),
            ...Array.from({ length: 7 }, (_, index) => day(primaryReading('pro', 'Proverbes', [index + 1]))),
            ...Array.from({ length: 7 }, (_, index) => day(primaryReading('ecc', 'Ecclésiaste', [index + 1]))),
        ],
    },
    {
        id: 'hope-comfort-7',
        name: 'Espérance et consolation en 7 jours',
        description: 'Un parcours court pour traverser l’épreuve avec espérance.',
        emoji: '🌤️',
        category: 'croissance',
        days: [
            day(primaryReading('psa', 'Psaumes', [23])),
            day(primaryReading('psa', 'Psaumes', [34])),
            day(primaryReading('isa', 'Ésaïe', [40])),
            day(primaryReading('isa', 'Ésaïe', [43])),
            day(primaryReading('mat', 'Matthieu', [11])),
            day(primaryReading('jhn', 'Jean', [14])),
            day(primaryReading('rom', 'Romains', [8])),
        ],
    },
    {
        id: 'couple-family-10',
        name: 'Couple et famille en 10 jours',
        description: 'Proverbes, Éphésiens, Colossiens et 1 Pierre pour la vie relationnelle.',
        emoji: '🏠',
        category: 'relations',
        days: [
            day(primaryReading('pro', 'Proverbes', [1])),
            day(primaryReading('pro', 'Proverbes', [3])),
            day(primaryReading('pro', 'Proverbes', [10])),
            day(primaryReading('pro', 'Proverbes', [12])),
            day(primaryReading('pro', 'Proverbes', [17])),
            day(primaryReading('pro', 'Proverbes', [31])),
            day(primaryReading('eph', 'Éphésiens', [4])),
            day(primaryReading('eph', 'Éphésiens', [5, 6])),
            day(primaryReading('col', 'Colossiens', [3])),
            day(primaryReading('1pe', '1 Pierre', [3])),
        ],
    },
    {
        id: 'genesis-25',
        name: 'La Genèse en 25 jours',
        description: 'Les origines, les patriarches et le plan de Dieu, 2 chapitres par jour.',
        emoji: '🌱',
        category: 'panorama',
        days: Array.from({ length: 25 }, (_, index) => day(primaryReading('gen', 'Genèse', [index * 2 + 1, index * 2 + 2]))),
    },
    {
        id: 'acts-14',
        name: 'Les Actes en 14 jours',
        description: "L'histoire de l'Église primitive et la puissance du Saint-Esprit.",
        emoji: '🗺️',
        category: 'commencer',
        days: Array.from({ length: 14 }, (_, index) => day(primaryReading('act', 'Actes', [index * 2 + 1, index * 2 + 2]))),
    },
    {
        id: 'fasting-consecration-7',
        name: 'Jeûne et consécration en 7 jours',
        description: 'Ésaïe, Matthieu, Joël et Actes pour un parcours de consécration.',
        emoji: '⏳',
        category: 'priere',
        days: [
            day(primaryReading('isa', 'Ésaïe', [58])),
            day(primaryReading('mat', 'Matthieu', [6])),
            day(primaryReading('jol', 'Joël', [1])),
            day(primaryReading('jol', 'Joël', [2])),
            day(primaryReading('act', 'Actes', [1])),
            day(primaryReading('act', 'Actes', [13])),
            day(primaryReading('act', 'Actes', [14])),
        ],
    },
    {
        id: 'torah-90',
        name: 'La Torah en 90 jours',
        description: 'Les cinq premiers livres de la Bible, fondements et alliance.',
        emoji: '📜',
        category: 'panorama',
        days: [
            ...Array.from({ length: 25 }, (_, index) => day(primaryReading('gen', 'Genèse', [index * 2 + 1, index * 2 + 2]))),
            ...Array.from({ length: 20 }, (_, index) => day(primaryReading('exo', 'Exode', [index * 2 + 1, index * 2 + 2]))),
            ...Array.from({ length: 13 }, (_, index) => day(primaryReading('lev', 'Lévitique', [index * 2 + 1, index * 2 + 2]))),
            day(primaryReading('lev', 'Lévitique', [27])),
            ...Array.from({ length: 18 }, (_, index) => day(primaryReading('num', 'Nombres', [index * 2 + 1, index * 2 + 2]))),
            ...sequentialDays('deu', 'Deutéronome', DEUTERONOMY_WINDOWS),
        ],
    },
    {
        id: 'wisdom-60',
        name: 'Sagesse et Poésie en 60 jours',
        description: 'Job, Psaumes, Proverbes, Ecclésiaste et Cantique des Cantiques.',
        emoji: '👑',
        category: 'panorama',
        days: [
            ...Array.from({ length: 14 }, (_, index) => day(primaryReading('job', 'Job', [index * 3 + 1, index * 3 + 2, index * 3 + 3]))),
            ...Array.from({ length: 30 }, (_, index) => day(primaryReading('psa', 'Psaumes', [index * 5 + 1, index * 5 + 2, index * 5 + 3, index * 5 + 4, index * 5 + 5]))),
            ...Array.from({ length: 10 }, (_, index) => day(primaryReading('pro', 'Proverbes', [index * 3 + 1, index * 3 + 2, index * 3 + 3]))),
            day(primaryReading('pro', 'Proverbes', [31])),
            ...Array.from({ length: 3 }, (_, index) => day(primaryReading('ecc', 'Ecclésiaste', [index * 4 + 1, index * 4 + 2, index * 4 + 3, index * 4 + 4]))),
            day(primaryReading('sng', 'Cantique des Cantiques', [1, 2, 3, 4])),
            day(primaryReading('sng', 'Cantique des Cantiques', [5, 6, 7, 8])),
        ],
    },
    {
        id: 'new-testament-90',
        name: 'Le Nouveau Testament en 90 jours',
        description: 'Parcourez tout le Nouveau Testament de manière structurée, sans répétition.',
        emoji: '📚',
        category: 'panorama',
        days: buildNewTestamentNinetyDays(),
    },
    {
        id: 'advent-24',
        name: "L'Avent en 24 jours",
        description: 'Préparez votre cœur pour Noël avec les prophéties et la naissance de Jésus.',
        emoji: '🕯️',
        category: 'saisonnier',
        days: Array.from({ length: 24 }, (_, index) => day(primaryReading('luk', 'Luc', [index + 1]))),
    },
    {
        id: 'passion-resurrection-8',
        name: 'Passion et résurrection en 8 jours',
        description: 'Une traversée de la Passion jusqu’à la résurrection.',
        emoji: '🌅',
        category: 'saisonnier',
        days: [
            day(primaryReading('luk', 'Luc', [19])),
            day(primaryReading('jhn', 'Jean', [12])),
            day(primaryReading('jhn', 'Jean', [13])),
            day(primaryReading('jhn', 'Jean', [17])),
            day(primaryReading('mat', 'Matthieu', [26])),
            day(primaryReading('jhn', 'Jean', [18, 19])),
            day(primaryReading('luk', 'Luc', [24])),
            day(primaryReading('jhn', 'Jean', [20, 21])),
        ],
    },
];
