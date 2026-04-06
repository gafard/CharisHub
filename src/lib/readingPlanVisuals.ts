import type { ReadingPlan, ReadingPlanCategory } from './readingPlanCatalog';

export type PlanVisualVariant = 'featured-photo' | 'category-photo' | 'texture-editorial';
export type PlanVisualTone = 'warm' | 'stone' | 'linen' | 'night' | 'ceremonial';
export type PlanCategoryId = ReadingPlanCategory;
export type PlanSymbolId =
    | 'book-open'
    | 'book-open-text'
    | 'cross'
    | 'fish-symbol'
    | 'music'
    | 'lightbulb'
    | 'landmark'
    | 'shield-check'
    | 'sprout'
    | 'tree-pine'
    | 'flame'
    | 'waypoints'
    | 'gem'
    | 'crown'
    | 'scroll'
    | 'scroll-text'
    | 'sunrise'
    | 'library-big'
    | 'sparkles';

export type PlanArtDirection = {
    planId: string;
    variant: PlanVisualVariant;
    imageSrc: string;
    textureSrc?: string;
    objectPosition: string;
    tone: PlanVisualTone;
    eyebrow: string;
    focus: string;
    symbolId: PlanSymbolId;
};

type ToneTheme = {
    accent: string;
    accentSoft: string;
    borderColor: string;
    overlay: string;
    panelBackground: string;
    mutedText: string;
    shadow: string;
};

export type ReadingPlanPresentation = {
    art: PlanArtDirection;
    cadence: string;
    categoryId: PlanCategoryId;
    categoryLabel: string;
    categoryDescription: string;
    featured: boolean;
    imageAlt: string;
    theme: ToneTheme;
};

export const PLAN_GROUPS: Array<{
    id: PlanCategoryId;
    label: string;
    description: string;
}> = [
    {
        id: 'commencer',
        label: 'Commencer',
        description: 'Des parcours d entree, clairs et immediats, pour revenir au coeur du texte.',
    },
    {
        id: 'priere',
        label: 'Priere et combat',
        description: 'Des parcours de souffle, de jeûne, de combat et de prière guidée.',
    },
    {
        id: 'croissance',
        label: 'Croissance interieure',
        description: 'Des parcours de transformation, de consolation et d enracinement.',
    },
    {
        id: 'relations',
        label: 'Vie et relations',
        description: 'Des lectures pour la famille, la vie relationnelle et les figures bibliques.',
    },
    {
        id: 'panorama',
        label: 'Panorama',
        description: 'Des traversees larges pour lire de grands ensembles et comprendre la structure.',
    },
    {
        id: 'saisonnier',
        label: 'Saisonnier',
        description: 'Des parcours courts lies a un temps fort spirituel ou liturgique.',
    },
];

const TONE_THEMES: Record<PlanVisualTone, ToneTheme> = {
    warm: {
        accent: '#D6B27A',
        accentSoft: 'rgba(214, 178, 122, 0.18)',
        borderColor: 'rgba(242, 224, 192, 0.14)',
        overlay: 'linear-gradient(180deg, rgba(12, 8, 6, 0.05) 0%, rgba(12, 8, 6, 0.42) 58%, rgba(12, 8, 6, 0.82) 100%)',
        panelBackground: 'linear-gradient(180deg, rgba(22, 16, 12, 0.94) 0%, rgba(11, 8, 6, 0.98) 100%)',
        mutedText: 'rgba(255, 240, 221, 0.68)',
        shadow: 'rgba(0, 0, 0, 0.34)',
    },
    stone: {
        accent: '#E3D6C4',
        accentSoft: 'rgba(227, 214, 196, 0.18)',
        borderColor: 'rgba(236, 229, 220, 0.14)',
        overlay: 'linear-gradient(180deg, rgba(10, 10, 10, 0.06) 0%, rgba(14, 12, 10, 0.40) 54%, rgba(10, 9, 8, 0.86) 100%)',
        panelBackground: 'linear-gradient(180deg, rgba(20, 18, 16, 0.94) 0%, rgba(12, 11, 10, 0.98) 100%)',
        mutedText: 'rgba(244, 237, 228, 0.70)',
        shadow: 'rgba(0, 0, 0, 0.30)',
    },
    linen: {
        accent: '#D8C0A3',
        accentSoft: 'rgba(216, 192, 163, 0.18)',
        borderColor: 'rgba(241, 226, 205, 0.14)',
        overlay: 'linear-gradient(180deg, rgba(12, 10, 8, 0.02) 0%, rgba(18, 14, 11, 0.30) 54%, rgba(11, 9, 8, 0.80) 100%)',
        panelBackground: 'linear-gradient(180deg, rgba(24, 18, 14, 0.92) 0%, rgba(13, 10, 8, 0.98) 100%)',
        mutedText: 'rgba(255, 243, 228, 0.70)',
        shadow: 'rgba(0, 0, 0, 0.28)',
    },
    night: {
        accent: '#C7CFF3',
        accentSoft: 'rgba(199, 207, 243, 0.16)',
        borderColor: 'rgba(214, 220, 248, 0.14)',
        overlay: 'linear-gradient(180deg, rgba(7, 9, 18, 0.02) 0%, rgba(8, 10, 18, 0.44) 50%, rgba(5, 6, 10, 0.90) 100%)',
        panelBackground: 'linear-gradient(180deg, rgba(14, 16, 24, 0.94) 0%, rgba(8, 9, 14, 0.99) 100%)',
        mutedText: 'rgba(234, 238, 255, 0.72)',
        shadow: 'rgba(0, 0, 0, 0.42)',
    },
    ceremonial: {
        accent: '#F0C27B',
        accentSoft: 'rgba(240, 194, 123, 0.18)',
        borderColor: 'rgba(247, 223, 186, 0.16)',
        overlay: 'linear-gradient(180deg, rgba(14, 9, 5, 0.02) 0%, rgba(16, 10, 6, 0.46) 54%, rgba(10, 7, 5, 0.88) 100%)',
        panelBackground: 'linear-gradient(180deg, rgba(27, 17, 10, 0.94) 0%, rgba(12, 8, 6, 0.99) 100%)',
        mutedText: 'rgba(255, 241, 219, 0.70)',
        shadow: 'rgba(0, 0, 0, 0.36)',
    },
};

const CATEGORY_DEFAULTS: Record<PlanCategoryId, Omit<ReadingPlanPresentation, 'art' | 'cadence' | 'featured' | 'imageAlt'>> = {
    commencer: {
        categoryId: 'commencer',
        categoryLabel: 'Commencer',
        categoryDescription: 'Des lectures directes pour entrer ou revenir dans la foi avec clarte.',
        theme: TONE_THEMES.warm,
    },
    priere: {
        categoryId: 'priere',
        categoryLabel: 'Priere et louange',
        categoryDescription: 'Des parcours de souffle, de combat et de recueillement.',
        theme: TONE_THEMES.night,
    },
    croissance: {
        categoryId: 'croissance',
        categoryLabel: 'Croissance interieure',
        categoryDescription: 'Des lectures pour grandir, être consolé et s enraciner.',
        theme: TONE_THEMES.stone,
    },
    relations: {
        categoryId: 'relations',
        categoryLabel: 'Vie et relations',
        categoryDescription: 'Des parcours pour la vie relationnelle, le foyer et les figures bibliques.',
        theme: TONE_THEMES.warm,
    },
    panorama: {
        categoryId: 'panorama',
        categoryLabel: 'Panorama',
        categoryDescription: 'De longues traversees pour lire de grands ensembles bibliques.',
        theme: TONE_THEMES.linen,
    },
    saisonnier: {
        categoryId: 'saisonnier',
        categoryLabel: 'Saisonnier',
        categoryDescription: 'Des parcours brefs pour un temps fort spirituel.',
        theme: TONE_THEMES.ceremonial,
    },
};

const DEFAULT_TEXTURES = {
    warm: '/reading-plans/texture-paper.webp',
    stone: '/reading-plans/texture-linen.webp',
    linen: '/reading-plans/texture-paper.webp',
    night: '/reading-plans/texture-dark-grain.webp',
    ceremonial: '/reading-plans/texture-paper.webp',
} as const;

const PLAN_PRESETS: Record<
    string,
    {
        categoryId: PlanCategoryId;
        featured?: boolean;
        art: Omit<PlanArtDirection, 'planId'>;
    }
> = {
    'discover-jesus-14': {
        categoryId: 'commencer',
        featured: true,
        art: {
            variant: 'featured-photo',
            imageSrc: '/reading-plans/hero-discover-jesus.webp',
            textureSrc: '/reading-plans/texture-paper.webp',
            objectPosition: '50% 54%',
            tone: 'ceremonial',
            eyebrow: 'Evangile',
            focus: 'Approcher Jesus lentement, jour apres jour',
            symbolId: 'fish-symbol',
        },
    },
    'new-believers-21': {
        categoryId: 'commencer',
        featured: true,
        art: {
            variant: 'featured-photo',
            imageSrc: '/reading-plans/hero-new-believers.webp',
            textureSrc: '/reading-plans/texture-linen.webp',
            objectPosition: '52% 50%',
            tone: 'warm',
            eyebrow: 'Fondations',
            focus: 'Poser des bases solides dans la foi',
            symbolId: 'waypoints',
        },
    },
    'inner-healing-14': {
        categoryId: 'croissance',
        featured: true,
        art: {
            variant: 'featured-photo',
            imageSrc: '/reading-plans/hero-inner-healing.webp',
            textureSrc: '/reading-plans/texture-linen.webp',
            objectPosition: '60% 50%',
            tone: 'stone',
            eyebrow: 'Restauration',
            focus: 'Recevoir la consolation, la vérité et la paix',
            symbolId: 'gem',
        },
    },
    'gospel-john-7': {
        categoryId: 'commencer',
        art: {
            variant: 'featured-photo',
            imageSrc: '/reading-plans/hero-discover-jesus.webp',
            textureSrc: '/reading-plans/texture-paper.webp',
            objectPosition: '50% 54%',
            tone: 'ceremonial',
            eyebrow: 'Evangile',
            focus: 'Approcher Jesus lentement, jour apres jour',
            symbolId: 'fish-symbol',
        },
    },
    'battle-psalms-10': {
        categoryId: 'priere',
        art: {
            variant: 'category-photo',
            imageSrc: '/reading-plans/category-prayer.webp',
            textureSrc: '/reading-plans/texture-dark-grain.webp',
            objectPosition: '52% 24%',
            tone: 'night',
            eyebrow: 'Combat',
            focus: 'Tenir ferme dans la prière et la confiance',
            symbolId: 'shield-check',
        },
    },
    'prayers-of-jesus-7': {
        categoryId: 'priere',
        art: {
            variant: 'category-photo',
            imageSrc: '/reading-plans/category-prayer.webp',
            textureSrc: '/reading-plans/texture-dark-grain.webp',
            objectPosition: '50% 28%',
            tone: 'night',
            eyebrow: 'Priere',
            focus: 'Apprendre à prier à l école de Jésus',
            symbolId: 'cross',
        },
    },
    'acts-14': {
        categoryId: 'commencer',
        art: {
            variant: 'featured-photo',
            imageSrc: '/reading-plans/hero-new-believers.webp',
            textureSrc: '/reading-plans/texture-linen.webp',
            objectPosition: '52% 50%',
            tone: 'warm',
            eyebrow: 'Mission',
            focus: "Voir l'Eglise prendre la route",
            symbolId: 'waypoints',
        },
    },
    'psalms-30': {
        categoryId: 'priere',
        art: {
            variant: 'category-photo',
            imageSrc: '/reading-plans/category-prayer.webp',
            textureSrc: '/reading-plans/texture-dark-grain.webp',
            objectPosition: '50% 24%',
            tone: 'night',
            eyebrow: 'Louange',
            focus: 'Respirer, louer, combattre',
            symbolId: 'music',
        },
    },
    'women-of-the-bible-14': {
        categoryId: 'relations',
        art: {
            variant: 'category-photo',
            imageSrc: '/reading-plans/category-growth.webp',
            textureSrc: '/reading-plans/texture-paper.webp',
            objectPosition: '50% 42%',
            tone: 'warm',
            eyebrow: 'Figures',
            focus: 'Voir des vies, des choix et des fidélités qui traversent la Bible',
            symbolId: 'crown',
        },
    },
    'identity-in-christ-10': {
        categoryId: 'croissance',
        art: {
            variant: 'category-photo',
            imageSrc: '/reading-plans/category-growth.webp',
            textureSrc: '/reading-plans/texture-linen.webp',
            objectPosition: '58% 34%',
            tone: 'stone',
            eyebrow: 'Identite',
            focus: 'Ancrer la foi dans ce que Christ dit de nous',
            symbolId: 'shield-check',
        },
    },
    'proverbs-31': {
        categoryId: 'croissance',
        art: {
            variant: 'category-photo',
            imageSrc: '/reading-plans/category-panorama.webp',
            textureSrc: '/reading-plans/texture-paper.webp',
            objectPosition: '48% 36%',
            tone: 'linen',
            eyebrow: 'Sagesse',
            focus: 'Une sagesse pour la vie ordinaire',
            symbolId: 'lightbulb',
        },
    },
    'romans-16': {
        categoryId: 'croissance',
        art: {
            variant: 'category-photo',
            imageSrc: '/reading-plans/category-growth.webp',
            textureSrc: '/reading-plans/texture-linen.webp',
            objectPosition: '62% 34%',
            tone: 'stone',
            eyebrow: 'Fondations',
            focus: 'Ancrer la foi sur des bases solides',
            symbolId: 'landmark',
        },
    },
    'holy-spirit-14': {
        categoryId: 'croissance',
        art: {
            variant: 'category-photo',
            imageSrc: '/reading-plans/category-growth.webp',
            textureSrc: '/reading-plans/texture-linen.webp',
            objectPosition: '56% 36%',
            tone: 'stone',
            eyebrow: 'Esprit',
            focus: 'Recevoir la puissance, la direction et le fruit de l Esprit',
            symbolId: 'flame',
        },
    },
    'wisdom-21': {
        categoryId: 'croissance',
        art: {
            variant: 'texture-editorial',
            imageSrc: '/reading-plans/category-growth.webp',
            textureSrc: '/reading-plans/texture-linen.webp',
            objectPosition: '60% 50%',
            tone: 'stone',
            eyebrow: 'Contemplation',
            focus: 'Ralentir, discerner, habiter la sagesse',
            symbolId: 'gem',
        },
    },
    'hope-comfort-7': {
        categoryId: 'croissance',
        art: {
            variant: 'category-photo',
            imageSrc: '/reading-plans/category-growth.webp',
            textureSrc: '/reading-plans/texture-linen.webp',
            objectPosition: '54% 36%',
            tone: 'stone',
            eyebrow: 'Consolation',
            focus: 'Traverser l épreuve avec espérance et présence de Dieu',
            symbolId: 'sunrise',
        },
    },
    'couple-family-10': {
        categoryId: 'relations',
        art: {
            variant: 'category-photo',
            imageSrc: '/reading-plans/category-commencer.webp',
            textureSrc: '/reading-plans/texture-paper.webp',
            objectPosition: '50% 48%',
            tone: 'warm',
            eyebrow: 'Foyer',
            focus: 'Former le coeur du couple et de la famille dans la Parole',
            symbolId: 'sparkles',
        },
    },
    'genesis-25': {
        categoryId: 'panorama',
        art: {
            variant: 'category-photo',
            imageSrc: '/reading-plans/category-commencer.webp',
            textureSrc: '/reading-plans/texture-paper.webp',
            objectPosition: '50% 52%',
            tone: 'warm',
            eyebrow: 'Origines',
            focus: 'Voir les commencements et les promesses',
            symbolId: 'sprout',
        },
    },
    'fasting-consecration-7': {
        categoryId: 'priere',
        art: {
            variant: 'category-photo',
            imageSrc: '/reading-plans/category-prayer.webp',
            textureSrc: '/reading-plans/texture-dark-grain.webp',
            objectPosition: '52% 26%',
            tone: 'night',
            eyebrow: 'Consecration',
            focus: 'Entrer dans un rythme de jeûne, d écoute et de disponibilité',
            symbolId: 'sparkles',
        },
    },
    'torah-90': {
        categoryId: 'panorama',
        art: {
            variant: 'category-photo',
            imageSrc: '/reading-plans/category-panorama.webp',
            textureSrc: '/reading-plans/texture-paper.webp',
            objectPosition: '52% 40%',
            tone: 'linen',
            eyebrow: 'Fondations',
            focus: 'Une grande traversee des premiers livres',
            symbolId: 'scroll',
        },
    },
    'wisdom-60': {
        categoryId: 'panorama',
        art: {
            variant: 'texture-editorial',
            imageSrc: '/reading-plans/category-growth.webp',
            textureSrc: '/reading-plans/texture-linen.webp',
            objectPosition: '52% 44%',
            tone: 'stone',
            eyebrow: 'Poesie',
            focus: 'Un long bain de psaumes et de sagesse',
            symbolId: 'crown',
        },
    },
    'new-testament-90': {
        categoryId: 'panorama',
        art: {
            variant: 'category-photo',
            imageSrc: '/reading-plans/category-panorama.webp',
            textureSrc: '/reading-plans/texture-paper.webp',
            objectPosition: '52% 40%',
            tone: 'linen',
            eyebrow: 'Panorama',
            focus: 'Tout le Nouveau Testament en continu',
            symbolId: 'book-open-text',
        },
    },
    'advent-24': {
        categoryId: 'saisonnier',
        art: {
            variant: 'category-photo',
            imageSrc: '/reading-plans/category-seasonal.webp',
            textureSrc: '/reading-plans/texture-paper.webp',
            objectPosition: '50% 55%',
            tone: 'ceremonial',
            eyebrow: 'Saison',
            focus: 'Attendre, contempler, accueillir',
            symbolId: 'sunrise',
        },
    },
    'passion-resurrection-8': {
        categoryId: 'saisonnier',
        art: {
            variant: 'category-photo',
            imageSrc: '/reading-plans/category-seasonal.webp',
            textureSrc: '/reading-plans/texture-paper.webp',
            objectPosition: '52% 52%',
            tone: 'ceremonial',
            eyebrow: 'Paques',
            focus: 'Traverser la Passion jusqu à la résurrection avec gravité et espérance',
            symbolId: 'sunrise',
        },
    },
};

function formatCadence(plan: ReadingPlan): string {
    const chapterCounts = plan.days.map((day) =>
        day.readings.reduce((sum, reading) => sum + reading.chapters.length, 0),
    );
    const min = Math.min(...chapterCounts);
    const max = Math.max(...chapterCounts);

    if (min === max) {
        return `${min} ${min > 1 ? 'chapitres' : 'chapitre'} / jour`;
    }

    return `${min}-${max} chapitres / jour`;
}

function getFallbackArtDirection(): Omit<PlanArtDirection, 'planId'> {
    return {
        variant: 'category-photo',
        imageSrc: '/reading-plans/category-commencer.webp',
        textureSrc: DEFAULT_TEXTURES.warm,
        objectPosition: '50% 50%',
        tone: 'warm',
        eyebrow: 'Parcours',
        focus: 'Lecture guidee au quotidien',
        symbolId: 'book-open',
    };
}

export function getReadingPlanPresentation(plan: ReadingPlan): ReadingPlanPresentation {
    const preset = PLAN_PRESETS[plan.id];
    const art = preset?.art ?? getFallbackArtDirection();
    const group = CATEGORY_DEFAULTS[preset?.categoryId ?? plan.category ?? 'commencer'];

    return {
        art: {
            planId: plan.id,
            ...art,
            textureSrc: art.textureSrc ?? DEFAULT_TEXTURES[art.tone],
        },
        cadence: formatCadence(plan),
        categoryId: group.categoryId,
        categoryLabel: group.categoryLabel,
        categoryDescription: group.categoryDescription,
        featured: Boolean(preset?.featured ?? plan.featured),
        imageAlt: `${plan.name} cover editorial`,
        theme: group.theme,
    };
}
