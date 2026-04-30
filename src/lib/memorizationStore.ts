/**
 * Memorization Store — Algorithme SM-2 pour la mémorisation de versets bibliques.
 *
 * SM-2 (SuperMemo 2): calcule l'intervalle optimal entre les révisions selon
 * la difficulté ressentie par l'utilisateur (Again/Hard/Good/Easy).
 */

import { localDB } from './localDB';

export type ReviewRating = 0 | 1 | 3 | 5; // Again | Hard | Good | Easy

export interface MemorizationCard {
  id: string;
  reference: string;        // "Jean 3:16"
  text: string;
  addedAt: string;          // ISO
  // SM-2 state
  easeFactor: number;       // starts at 2.5, min 1.3
  interval: number;         // days until next review
  repetitions: number;      // consecutive successful reviews
  nextReviewDate: string;   // YYYY-MM-DD
  lastReviewDate?: string;
  // Stats
  totalReviews: number;
  correctReviews: number;
}

// ─── SM-2 algorithm ──────────────────────────────────────────────────────────

function sm2(card: MemorizationCard, q: ReviewRating): Pick<MemorizationCard, 'easeFactor' | 'interval' | 'repetitions'> {
  let { easeFactor, interval, repetitions } = card;

  if (q < 3) {
    // Failed — reset
    repetitions = 0;
    interval = 1;
  } else {
    // Passed
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitions += 1;
  }

  // Update ease factor (SM-2 formula)
  easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));

  return { easeFactor, interval, repetitions };
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Store ───────────────────────────────────────────────────────────────────

const STORE_KEY = 'formation_biblique_memorization_v1';

function loadCards(): MemorizationCard[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as MemorizationCard[]) : [];
  } catch { return []; }
}

function saveCards(cards: MemorizationCard[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORE_KEY, JSON.stringify(cards));
}

export const memorizationStore = {
  getAll(): MemorizationCard[] {
    return loadCards();
  },

  /** Cartes dont la date de révision est aujourd'hui ou passée */
  getDueCards(): MemorizationCard[] {
    const t = today();
    return loadCards().filter(c => c.nextReviewDate <= t);
  },

  /** Nombre de cartes dues aujourd'hui */
  getDueCount(): number {
    return this.getDueCards().length;
  },

  add(reference: string, text: string): MemorizationCard {
    const cards = loadCards();
    // Éviter les doublons
    const existing = cards.find(c => c.reference === reference);
    if (existing) return existing;

    const card: MemorizationCard = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      reference,
      text,
      addedAt: new Date().toISOString(),
      easeFactor: 2.5,
      interval: 1,
      repetitions: 0,
      nextReviewDate: today(), // dispo immédiatement
      totalReviews: 0,
      correctReviews: 0,
    };
    cards.unshift(card);
    saveCards(cards);
    return card;
  },

  review(cardId: string, q: ReviewRating): MemorizationCard | null {
    const cards = loadCards();
    const idx = cards.findIndex(c => c.id === cardId);
    if (idx === -1) return null;

    const card = cards[idx];
    const updated = sm2(card, q);
    const t = today();

    cards[idx] = {
      ...card,
      ...updated,
      nextReviewDate: addDays(t, updated.interval),
      lastReviewDate: t,
      totalReviews: card.totalReviews + 1,
      correctReviews: card.correctReviews + (q >= 3 ? 1 : 0),
    };

    saveCards(cards);
    return cards[idx];
  },

  remove(cardId: string): void {
    saveCards(loadCards().filter(c => c.id !== cardId));
  },

  has(reference: string): boolean {
    return loadCards().some(c => c.reference === reference);
  },

  /** Masque une partie du texte pour l'entraînement */
  maskText(text: string, level: 1 | 2 | 3): string {
    const words = text.split(' ');
    if (level === 1) {
      // Masque 30% des mots (fins de phrases)
      return words.map((w, i) => (i > 0 && (i % 4 === 0)) ? '___' : w).join(' ');
    }
    if (level === 2) {
      // Masque 60% des mots
      return words.map((w, i) => (i % 2 === 0 && i > 0) ? '___' : w).join(' ');
    }
    // Masque tout sauf le premier mot
    return words.map((w, i) => i === 0 ? w : '___').join(' ');
  },
};
