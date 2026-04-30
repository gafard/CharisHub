/**
 * Utilitaires partagés pour CharisHub.
 *
 * Ce module centralise les petites fonctions dupliquées dans le projet
 * (parseSafe, makeId, initials, normalize…) afin d'éviter les copies.
 */

/**
 * Parse une chaîne JSON sans lever d'exception.
 * Retourne `fallback` si la chaîne est null ou invalide.
 */
export function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Génère un identifiant unique.
 * Utilise `crypto.randomUUID` quand disponible, sinon un fallback timestamp.
 */
export function makeId(_prefix?: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Extrait les initiales (2 caractères max) d'un nom.
 */
export function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || '').toUpperCase();
  const b = (parts[1]?.[0] || '').toUpperCase();
  return (a + b) || 'G';
}

/**
 * Normalise une chaîne pour la comparaison : minuscules, sans accents,
 * sans caractères spéciaux.
 */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

/**
 * Vérifie si le code tourne dans un navigateur.
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Nettoie un UUID (supprime les préfixes timestamp ajoutés par certains ID locaux).
 */
export function cleanUuid(id: string | null | undefined): string {
  if (!id) return '';
  const parts = id.split('_');
  return parts.length > 1 && parts[0].length < 10 ? parts[parts.length - 1] : id;
}

/**
 * Transforme de manière sûre un JSON "lâche" (clés non quotées, trailing commas)
 * en JSON valide, SANS utiliser eval/Function.
 *
 * Stratégie :
 * 1. Tente JSON.parse directement.
 * 2. Si échec, tente de corriger les clés non quotées et de relancer JSON.parse.
 * 3. Sinon, lève une erreur explicite.
 */
export function safeParseLooseJson(raw: string): unknown {
  const cleaned = raw.replace(/^\uFEFF/, '').trim();
  if (!cleaned) throw new Error('Contenu vide');

  // 1. Tentative directe
  try {
    return JSON.parse(cleaned);
  } catch {
    // Continue
  }

  // 2. Corriger les clés non quotées : foo: → "foo":
  //    et les trailing commas avant } ou ]
  try {
    const fixed = cleaned
      // Ajoute des guillemets autour des clés non quotées
      .replace(/(?<=[{,]\s*)([a-zA-Z_$][\w$]*)\s*:/g, '"$1":')
      // Supprime les trailing commas
      .replace(/,\s*([}\]])/g, '$1')
      // Remplace les single quotes autour des valeurs par des double quotes
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
    return JSON.parse(fixed);
  } catch {
    // Continue
  }

  // 3. Même chose en aplatissant les sauts de ligne dans les chaînes
  try {
    const flattened = cleaned.replace(/\r?\n+/g, ' ');
    const fixed = flattened
      .replace(/(?<=[{,]\s*)([a-zA-Z_$][\w$]*)\s*:/g, '"$1":')
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
    return JSON.parse(fixed);
  } catch (err) {
    throw new Error(`Format JSON invalide: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
  }
}
