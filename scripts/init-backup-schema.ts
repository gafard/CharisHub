/**
 * Script pour initialiser le schéma de backup-sync dans Supabase
 * Exécution: npx tsx scripts/init-backup-schema.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Parser le fichier .env.local manuellement
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

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Erreur: Variables Supabase non configurées');
  process.exit(1);
}

async function executeSQL() {
  console.log('🔧 Initialisation du schéma de backup-sync...');
  console.log(`📡 URL: ${SUPABASE_URL}`);

  // Lire le fichier SQL
  const sqlPath = resolve(process.cwd(), 'supabase-backup-sync.sql');
  const sql = readFileSync(sqlPath, 'utf-8');

  console.log(`📄 Fichier SQL: ${sql.length} caractères`);
  console.log('');

  // Exécuter via l'API REST Supabase (POST /rpc)
  // Malheureusement, Supabase ne permet pas d'exécuter du SQL arbitraire via l'API REST
  // Il faut le faire via le dashboard ou l'API admin
  
  console.log('⚠️  Supabase ne permet pas d\'exécuter du SQL arbitraire via l\'API client.');
  console.log('');
  console.log('📋 Pour exécuter le schéma, vous avez 2 options :');
  console.log('');
  console.log('Option 1 : Via le Dashboard (recommandé)');
  console.log('  1. Allez sur: https://app.supabase.com');
  console.log('  2. Sélectionnez votre projet');
  console.log('  3. Allez dans "SQL Editor"');
  console.log('  4. Copiez-collez le contenu de: supabase-backup-sync.sql');
  console.log('  5. Cliquez sur "Run"');
  console.log('');
  console.log('Option 2 : Via Supabase CLI (si installée)');
  console.log('  supabase db push');
  console.log('');
  
  // Essayer quand même via l'API SQL (nécessite le service role key)
  console.log('🔄 Tentative via l\'API REST Supabase...');
  console.log('');

  try {
    // Diviser le SQL en statements individuels
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📊 ${statements.length} statements SQL trouvés`);
    console.log('');
    console.log('⚠️  Malheureusement, l\'API REST Supabase ne supporte pas');
    console.log('   l\'exécution de SQL DDL (CREATE TABLE, etc.)');
    console.log('');
    console.log('✅ Utilisez le Dashboard Supabase (Option 1 ci-dessus)');
    console.log('');
    
    // Afficher un résumé
    const tables = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/g);
    if (tables) {
      console.log('📋 Tables à créer :');
      tables.forEach(t => {
        const name = t.replace('CREATE TABLE IF NOT EXISTS ', '');
        console.log(`   - ${name}`);
      });
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

executeSQL().catch((err) => {
  console.error('❌ Erreur inattendue:', err);
  process.exit(1);
});
