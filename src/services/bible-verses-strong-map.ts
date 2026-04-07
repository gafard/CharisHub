// Mapping de correspondance entre les versets et les numéros Strong
// Structure simplifiée pour démonstration - dans une implémentation complète,
// cela serait alimenté par une base de données avec les positions exactes

interface StrongMapping {
  bookId: string;
  chapter: number;
  verse: number;
  wordMappings: Array<{
    word: string;        // Le mot dans la traduction (ex: "Dieu")
    strongNumber: string; // Numéro Strong (ex: "430")
    language: 'hebrew' | 'greek'; // Langue originale
    positionInVerse: number; // Position du mot dans le verset
    originalForm?: string;   // Forme originale (hébreu/grec)
    phonetic?: string;      // Transcription phonétique
  }>;
}

function normalizeBookId(bookId: string): string {
  const cleaned = (bookId || '').toLowerCase().trim();
  const aliases: Record<string, string> = {
    matt: 'mat',
    matthew: 'mat',
    mark: 'mrk',
    luke: 'luk',
    john: 'jhn',
    ps: 'psa',
    psalm: 'psa',
    psalms: 'psa',
    prov: 'pro',
  };
  return aliases[cleaned] || cleaned;
}

// Données de démonstration - dans une application réelle, ceci viendrait d'une base de données
const DEMO_STRONG_MAPPINGS: StrongMapping[] = [
  {
    bookId: 'matt', // Matthieu
    chapter: 1,
    verse: 22,
    wordMappings: [
      {
        word: "afin",
        strongNumber: "2443",
        language: 'greek',
        positionInVerse: 4,
        originalForm: "ἵνα",
        phonetic: "hin'-ah"
      },
      {
        word: "Seigneur",
        strongNumber: "2962",
        language: 'greek',
        positionInVerse: 6,
        originalForm: "Κύριος",
        phonetic: "koo'-ree-os"
      },
      {
        word: "prophète",
        strongNumber: "4396",
        language: 'greek',
        positionInVerse: 9,
        originalForm: "προφήτης",
        phonetic: "prof-AY-tace"
      }
    ]
  },
  {
    bookId: 'matt',
    chapter: 1,
    verse: 1,
    wordMappings: [
      {
        word: "Christ",
        strongNumber: "5547",
        language: 'greek',
        positionInVerse: 1,
        originalForm: "Χριστός",
        phonetic: "khris-tos'"
      }
    ]
  },
  {
    bookId: 'gen',
    chapter: 1,
    verse: 1,
    wordMappings: [
      {
        word: "Dieu",
        strongNumber: "430",
        language: 'hebrew',
        positionInVerse: 1,
        originalForm: "אֱלֹהִים",
        phonetic: "el-o-heem'"
      }
    ]
  }
];

class BibleVersesStrongMap {
  private static instance: BibleVersesStrongMap;
  private mappings: Map<string, StrongMapping> = new Map();

  public static getInstance(): BibleVersesStrongMap {
    if (!BibleVersesStrongMap.instance) {
      BibleVersesStrongMap.instance = new BibleVersesStrongMap();
      BibleVersesStrongMap.instance.initializeDemoData();
    }
    return BibleVersesStrongMap.instance;
  }

  private initializeDemoData() {
    // Charge les données de démonstration dans la map
    DEMO_STRONG_MAPPINGS.forEach(mapping => {
      const normalizedBookId = normalizeBookId(mapping.bookId);
      const key = `${normalizedBookId}_${mapping.chapter}_${mapping.verse}`;
      this.mappings.set(key, { ...mapping, bookId: normalizedBookId });
    });
  }

  /**
   * Trouve les correspondances Strong pour un verset spécifique
   */
  async getStrongMappingsForVerse(bookId: string, chapter: number, verse: number): Promise<StrongMapping | null> {
    try {
      const url = `/api/bible/interlinear?bookId=${bookId}&chapter=${chapter}&verse=${verse}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      
      const data = await res.json();
      if (!data.words) return null;

      return {
        bookId,
        chapter,
        verse,
        wordMappings: data.words.filter((w: any) => w.strongNumber).map((w: any, idx: number) => ({
          word: w.translation,
          strongNumber: w.strongNumber.replace(/^[HG]/, ''),
          language: w.strongNumber.startsWith('H') ? 'hebrew' : 'greek',
          positionInVerse: idx,
          originalForm: w.original,
          phonetic: w.phonetic
        }))
      };
    } catch (error) {
      console.error('Erreur BibleVersesStrongMap:', error);
      return null;
    }
  }

  /**
   * Trouve les correspondances Strong pour un texte de verset
   */
  async findStrongMappingsByText(bookId: string, chapter: number, verse: number, _verseText: string): Promise<StrongMapping | null> {
    return this.getStrongMappingsForVerse(bookId, chapter, verse);
  }

  /**
   * Obtient toutes les correspondances pour un chapitre
   */
  async getMappingsForChapter(bookId: string, chapter: number): Promise<StrongMapping[]> {
    // Note: Pour une implémentation optimale, il faudrait une route API par chapitre
    return [];
  }
}

export default BibleVersesStrongMap.getInstance();
