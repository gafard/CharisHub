import logger from '@/lib/logger';
import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

const tablesToCheck = [
  'user_sync_metadata',
  'user_bible_highlights',
  'user_bible_notes',
  'user_bible_bookmarks',
  'user_pepites',
  'user_reading_progress',
  'user_reading_streak',
  'user_prayer_sessions',
  'user_prayer_journal',
  'user_study_tags',
  'user_data_exports',
  'user_reading_reflections',
];

async function requireAdminClient(req: Request) {
  if (!supabaseServer) {
    return {
      response: NextResponse.json(
        { error: 'Supabase server client is not configured.' },
        { status: 503 }
      ),
      client: null,
    };
  }

  const admin = await verifyAdmin(req);
  if (!admin) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      client: null,
    };
  }

  return { response: null, client: supabaseServer };
}

/**
 * API pour initialiser le schéma de backup-sync dans Supabase
 * Méthode: POST
 * Endpoint: /api/admin/init-backup-schema
 * 
 * ⚠️ À exécuter UNE SEULE FOIS pour créer les tables de backup
 */
export async function POST(req: Request) {
  const guard = await requireAdminClient(req);
  if (!guard.client) return guard.response;

  try {
    const createdTables = [];
    const errors = [];

    // Créer chaque table
    for (const table of tablesToCheck) {
      try {
        // Vérifier si la table existe déjà
        const { error: checkError } = await guard.client
          .from(table)
          .select('id')
          .limit(1);

        if (!checkError) {
          logger.log(`[InitBackup] Table ${table} existe déjà`);
          createdTables.push({ name: table, status: 'already_exists' });
          continue;
        }

        // La table n'existe pas, on va utiliser SQL direct
        // On ne peut pas créer des tables via l'API JS, il faut le faire via le dashboard
        errors.push({
          table,
          message: 'Table non trouvée. Veuillez exécuter le schéma SQL manuellement.',
        });
      } catch (err) {
        errors.push({
          table,
          message: err instanceof Error ? err.message : 'Erreur inconnue',
        });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({
        message: 'Les tables n\'existent pas encore. Vous devez exécuter le schéma SQL.',
        instructions: {
          step1: 'Ouvrez le dashboard Supabase de votre projet',
          step2: 'Dashboard → SQL Editor',
          step3: 'Copiez le contenu de supabase-backup-sync.sql',
          step4: 'Exécutez le script',
        },
        missingTables: errors.map(e => e.table),
        createdTables,
      }, { status: 400 });
    }

    return NextResponse.json({
      message: 'Schéma de backup déjà initialisé ✅',
      createdTables,
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur inattendue', details: error },
      { status: 500 }
    );
  }
}

// GET pour vérifier l'état des tables
export async function GET(req: Request) {
  const guard = await requireAdminClient(req);
  if (!guard.client) return guard.response;

  const results = await Promise.all(
    tablesToCheck.map(async (table) => {
      try {
        const { error } = await guard.client
          .from(table)
          .select('id')
          .limit(1);

        return {
          table,
          exists: !error,
          error: error?.message || null,
        };
      } catch (err) {
        return {
          table,
          exists: false,
          error: err instanceof Error ? err.message : 'Inconnue',
        };
      }
    })
  );

  const allExist = results.every(r => r.exists);

  return NextResponse.json({
    allTablesExist: allExist,
    tables: results,
    ready: allExist ? '✅ Prêt pour la sync cloud' : '❌ Tables manquantes',
  });
}
