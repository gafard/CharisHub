export type BadgeCategory = 'streak' | 'reading' | 'pépites' | 'community' | 'special';

export interface Badge {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  icon: string; // Emoji or Lucide icon name
  threshold: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export const BADGE_CATALOG: Badge[] = [
  // Streak Badges
  {
    id: 'streak-3',
    name: 'Fidèle débutant',
    description: '3 jours de lecture consécutifs',
    category: 'streak',
    icon: '🌱',
    threshold: 3,
    rarity: 'common',
  },
  {
    id: 'streak-7',
    name: 'Disciple régulier',
    description: '7 jours de lecture consécutifs',
    category: 'streak',
    icon: '🔥',
    threshold: 7,
    rarity: 'common',
  },
  {
    id: 'streak-30',
    name: 'Pilier de la parole',
    description: '30 jours de lecture consécutifs',
    category: 'streak',
    icon: '💎',
    threshold: 30,
    rarity: 'rare',
  },

  // Reading Badges
  {
    id: 'reading-10',
    name: 'Explorateur',
    description: '10 chapitres lus',
    category: 'reading',
    icon: '📖',
    threshold: 10,
    rarity: 'common',
  },
  {
    id: 'reading-100',
    name: 'Scribe passionné',
    description: '100 chapitres lus',
    category: 'reading',
    icon: '📜',
    threshold: 100,
    rarity: 'rare',
  },

  // Pépites Badges
  {
    id: 'pepites-5',
    name: 'Chercheur d\'or',
    description: '5 pépites spirituelles trouvées',
    category: 'pépites',
    icon: '✨',
    threshold: 5,
    rarity: 'common',
  },
  {
    id: 'pepites-20',
    name: 'Mineur de trésors',
    description: '20 pépites spirituelles trouvées',
    category: 'pépites',
    icon: '💰',
    threshold: 20,
    rarity: 'rare',
  },

  // Community Badges
  {
    id: 'testimonial-1',
    name: 'Témoin de la Grace',
    description: 'Premier témoignage partagé',
    category: 'community',
    icon: '🗣️',
    threshold: 1,
    rarity: 'common',
  },
  {
    id: 'prayer-10',
    name: 'Intercesseur',
    description: '10 prières pour les autres',
    category: 'community',
    icon: '🙏',
    threshold: 10,
    rarity: 'common',
  },
];
