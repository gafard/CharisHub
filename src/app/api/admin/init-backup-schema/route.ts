import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * API pour initialiser le schéma de backup-sync dans Supabase
 * Méthode: POST
 * Endpoint: /api/admin/init-backup-schema
 * 
 * ⚠️ À exécuter UNE SEULE FOIS pour créer les tables de backup
 */
export async function POST() {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase non configuré' },
      { status: 500 }
    );
  }

  try {
    // Liste des tables à créer
    const tablesToCreate = [
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
    ];

    const createdTables = [];
    const errors = [];

    // Créer chaque table
    for (const table of tablesToCreate) {
      try {
        // Vérifier si la table existe déjà
        const { data: existing, error: checkError } = await supabase
          .from(table)
          .select('id')
          .limit(1);

        if (!checkError) {
          console.log(`[InitBackup] Table ${table} existe déjà`);
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
          step1: 'Allez sur https://kcseueoxjzqhwwjevcge.supabase.co',
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
export async function GET() {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase non configuré' },
      { status: 500 }
    );
  }

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
  ];

  const results = await Promise.all(
    tablesToCheck.map(async (table) => {
      try {
        const { data, error } = await supabase
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
