/**
 * Middleware d'authentification pour les API routes.
 *
 * Vérifie le token Bearer JWT Supabase et retourne l'utilisateur authentifié.
 * Usage dans une route API :
 *
 * ```ts
 * const auth = await verifyAuth(req);
 * if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * // auth.userId est disponible
 * ```
 */

import { supabaseServer } from './supabaseServer';
import logger from './logger';

export type AuthResult = {
  userId: string;
  email?: string;
};

/**
 * Vérifie l'authentification d'une requête API.
 * Retourne null si non authentifié.
 */
export async function verifyAuth(req: Request): Promise<AuthResult | null> {
  if (!supabaseServer) {
    logger.warn('[apiAuth] Supabase server client not configured');
    return null;
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  if (!token) return null;

  try {
    const { data: { user }, error } = await supabaseServer.auth.getUser(token);
    if (error || !user) {
      logger.warn('[apiAuth] Invalid token:', error?.message);
      return null;
    }

    return {
      userId: user.id,
      email: user.email,
    };
  } catch (err) {
    logger.error('[apiAuth] Unexpected error verifying token:', err);
    return null;
  }
}

/**
 * Vérifie l'authentification avec fallback gracieux.
 * En mode dégradé (pas de token), log un warning mais ne bloque pas.
 * Utile pour la transition progressive vers l'auth obligatoire.
 */
export async function verifyAuthSoft(req: Request): Promise<AuthResult | null> {
  const auth = await verifyAuth(req);
  if (!auth) {
    logger.warn('[apiAuth] Unauthenticated API call to:', new URL(req.url).pathname);
  }
  return auth;
}
