/**
 * LocalDB — Couche d'abstraction centralisée pour localStorage.
 *
 * Tous les accès à localStorage passent ici pour garantir:
 * - Cohérence et unicité des clés (plus de clés hardcodées dispersées)
 * - Sécurité SSR (pas d'accès window côté serveur)
 * - Gestion des erreurs JSON silencieuse
 * - Migrations automatiques des clés legacy
 * - Estimation de l'utilisation du stockage
 */

export const DB_KEYS = {
  // Étude biblique
  highlights:     'formation_biblique_bible_highlights_v1',
  notes:          'formation_biblique_bible_notes_v1',
  verseNotes:     'formation_biblique_bible_verse_notes_v1',
  bookmarks:      'bible_bookmarks',
  streak:         'formation_biblique_bible_streak_v1',
  readingHistory: 'formation_biblique_reading_history_v1',

  // Plans de lecture
  readingPlans:     'formation_biblique_reading_plans_v3',
  activeReadingPlan:'formation_biblique_active_reading_plan_v1',
  reflections:      'formation_biblique_reading_plan_reflections_v2',

  // Prière
  prayerFlow:    'formation_biblique_prayer_flow_v1',
  prayerJournal: 'formation_biblique_prayer_journal_v1',

  // Pépites
  pepites: 'mirror_pepites_v1',

  // Identité & synchronisation
  identity:      'formation_biblique_identity_v1',
  syncMetadata:  'user_sync_metadata',
  syncId:        'formation_biblique_sync_id',

  // Préférences UI
  textScale: 'formation_biblique_text_scale',
  theme:     'formation_biblique_theme',
  accent:    'formation_biblique_accent',

  // Communauté
  localGroups:       'formation_biblique_local_groups_v1',
  pwaPromptDismissed:'pwa-prompt-dismissed',
} as const;

export type DBKey = keyof typeof DB_KEYS;

// Migrations one-shot: ancienne clé → nouvelle clé
const MIGRATIONS: Partial<Record<string, string>> = {
  'huios_pepites_v1':                        DB_KEYS.pepites,
  'formation_biblique_reading_plans_v1':     DB_KEYS.readingPlans,
  'formation_biblique_reading_plans_v2':     DB_KEYS.readingPlans,
};

function applyMigrations(): void {
  for (const [oldKey, newKey] of Object.entries(MIGRATIONS)) {
    if (!newKey) continue;
    try {
      const old = localStorage.getItem(oldKey);
      if (old && !localStorage.getItem(newKey)) {
        localStorage.setItem(newKey, old);
        localStorage.removeItem(oldKey);
      }
    } catch { /* ignore */ }
  }
}

if (typeof window !== 'undefined') {
  try { applyMigrations(); } catch { /* ignore */ }
}

export const localDB = {
  get<T>(key: DBKey, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    try {
      const raw = localStorage.getItem(DB_KEYS[key]);
      return raw !== null ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },

  set<T>(key: DBKey, value: T): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(DB_KEYS[key], JSON.stringify(value));
    } catch (e) {
      console.warn(`[localDB] set "${key}" failed:`, e);
    }
  },

  remove(key: DBKey): void {
    if (typeof window === 'undefined') return;
    try { localStorage.removeItem(DB_KEYS[key]); } catch { /* ignore */ }
  },

  getRaw(key: DBKey): string | null {
    if (typeof window === 'undefined') return null;
    try { return localStorage.getItem(DB_KEYS[key]); } catch { return null; }
  },

  setRaw(key: DBKey, value: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(DB_KEYS[key], value);
    } catch (e) {
      console.warn(`[localDB] setRaw "${key}" failed:`, e);
    }
  },

  /** Estime l'utilisation du stockage par les clés connues (approx.) */
  estimateUsage(): { bytes: number; kb: string } {
    if (typeof window === 'undefined') return { bytes: 0, kb: '0' };
    const bytes = Object.values(DB_KEYS).reduce((sum, key) => {
      const val = localStorage.getItem(key);
      return sum + (val ? val.length * 2 : 0); // UTF-16 ≈ 2 bytes/char
    }, 0);
    return { bytes, kb: (bytes / 1024).toFixed(1) };
  },

  /** Exporte toutes les données connues pour sauvegarde manuelle */
  exportAll(): Record<string, unknown> {
    if (typeof window === 'undefined') return {};
    const result: Record<string, unknown> = {};
    for (const [alias, key] of Object.entries(DB_KEYS)) {
      const val = localStorage.getItem(key);
      if (val !== null) {
        try { result[alias] = JSON.parse(val); } catch { result[alias] = val; }
      }
    }
    return result;
  },
};
