/**
 * Script pour exécuter le schéma SQL de backup-sync via l'API Management Supabase
 * Exécution: npx tsx scripts/execute-backup-schema.ts
 * 
 * Nécessite: SUPABASE_ACCESS_TOKEN (token personnel depuis le dashboard)
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Parser le fichier .env.local
function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        let value = valueParts.join('=');
        value = value.replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value;
      }
    }
  });
}

loadEnvFile();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL manquant');
  process.exit(1);
}

async function checkTables() {
  const tables = [
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

  console.log('🔍 Vérification des tables...');
  console.log('');

  let allExist = true;
  const missingTables = [];

  for (const table of tables) {
    try {
      const url = `${SUPABASE_URL}/rest/v1/${table}?limit=1`;
      const response = await fetch(url, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        method: 'GET',
      });

      if (response.ok) {
        console.log(`   ✅ ${table}`);
      } else {
        console.log(`   ❌ ${table} - MANQUANTE`);
        allExist = false;
        missingTables.push(table);
      }
    } catch (error) {
      console.log(`   ❌ ${table} - ERREUR`);
      allExist = false;
      missingTables.push(table);
    }
  }

  console.log('');

  if (allExist) {
    console.log('✅ Toutes les tables existent ! La sync cloud est prête.');
    return true;
  } else {
    console.log('⚠️  Tables manquantes détectées');
    console.log('');
    console.log('📋 Instructions pour créer les tables :');
    console.log('');
    console.log('1. Allez sur : https://app.supabase.com');
    console.log('2. Sélectionnez votre projet');
    console.log('3. Cliquez sur "SQL Editor" dans le menu gauche');
    console.log('4. Cliquez sur "New query"');
    console.log('5. Copiez-collez TOUT le contenu de : supabase-backup-sync.sql');
    console.log('6. Cliquez sur "Run" (ou Ctrl+Enter)');
    console.log('');
    console.log('📄 Le fichier SQL se trouve ici :');
    console.log(`   ${resolve(process.cwd(), 'supabase-backup-sync.sql')}`);
    console.log('');
    console.log('💡 Après avoir exécuté le SQL, relancez ce script pour vérifier.');
    return false;
  }
}

checkTables().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
