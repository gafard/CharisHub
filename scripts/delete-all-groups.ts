/**
 * Script pour supprimer tous les groupes de la base de données Supabase
 * Exécution: npx tsx scripts/delete-all-groups.ts
 */

import { createClient } from '@supabase/supabase-js';
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
        // Enlever les guillemets si présents
        value = value.replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value;
      }
    }
  });
}

loadEnvFile();

const url = 
  process.env.SUPABASE_URL || 
  process.env.NEXT_PUBLIC_SUPABASE_URL || 
  '';
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

if (!url || !key) {
  console.error('❌ Erreur: Variables d\'environnement Supabase non configurées');
  console.error('Required: SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL');
  console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
  process.exit(1);
}

console.log('✅ Connecté à Supabase:', url);

const supabase = createClient(url, key);

async function deleteAllGroups() {
  console.log('\n🔍 Récupération de tous les groupes...');

  // Récupérer tous les groupes
  const { data: groups, error } = await supabase
    .from('charishub_groups')
    .select('id, name, created_by_device_id, members_count, group_type');

  if (error) {
    console.error('❌ Erreur lors de la récupération des groupes:', error);
    process.exit(1);
  }

  if (!groups || groups.length === 0) {
    console.log('✅ Aucun groupe trouvé dans la base de données.');
    process.exit(0);
  }

  console.log(`\n📋 ${groups.length} groupe(s) trouvé(s):`);
  groups.forEach((group, index) => {
    console.log(`   ${index + 1}. ${group.name} [${group.group_type}] - ${group.members_count} membres (ID: ${group.id})`);
  });

  console.log('\n⚠️  Suppression en cours de tous les groupes et leurs données associées...');

  const groupIds = groups.map(g => g.id);

  // Supprimer les données associées en cascade
  console.log('\n1️⃣  Suppression des membres...');
  const { error: membersError } = await supabase
    .from('charishub_group_members')
    .delete()
    .in('group_id', groupIds);
  if (membersError) {
    console.error('   ⚠️  Erreur membres:', membersError.message);
  } else {
    console.log('   ✅ Membres supprimés');
  }

  console.log('2️⃣  Suppression des publications...');
  const { error: postsError } = await supabase
    .from('charishub_posts')
    .delete()
    .in('group_id', groupIds);
  if (postsError) {
    console.error('   ⚠️  Erreur publications:', postsError.message);
  } else {
    console.log('   ✅ Publications supprimées');
  }

  console.log('3️⃣  Suppression des défis...');
  const { error: challengesError } = await supabase
    .from('charishub_group_challenges')
    .delete()
    .in('group_id', groupIds);
  if (challengesError) {
    console.error('   ⚠️  Erreur défis:', challengesError.message);
  } else {
    console.log('   ✅ Défis supprimés');
  }

  console.log('4️⃣  Suppression des appels...');
  const { error: callsError } = await supabase
    .from('charishub_group_calls')
    .delete()
    .in('group_id', groupIds);
  if (callsError) {
    console.error('   ⚠️  Erreur appels:', callsError.message);
  } else {
    console.log('   ✅ Appels supprimés');
  }

  console.log('5️⃣  Suppression des présences...');
  const { error: presenceError } = await supabase
    .from('community_group_call_presence')
    .delete()
    .in('group_id', groupIds);
  if (presenceError) {
    console.error('   ⚠️  Erreur présences:', presenceError.message);
  } else {
    console.log('   ✅ Présences supprimées');
  }

  console.log('6️⃣  Suppression des événements d\'appel...');
  const { error: eventsError } = await supabase
    .from('community_group_call_events')
    .delete()
    .in('group_id', groupIds);
  if (eventsError) {
    console.error('   ⚠️  Erreur événements:', eventsError.message);
  } else {
    console.log('   ✅ Événements supprimés');
  }

  console.log('7️⃣  Suppression des groupes...');
  const { error: deleteError } = await supabase
    .from('charishub_groups')
    .delete()
    .in('id', groupIds);

  if (deleteError) {
    console.error('   ❌ Erreur lors de la suppression des groupes:', deleteError.message);
    process.exit(1);
  } else {
    console.log('   ✅ Groupes supprimés avec succès');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ SUPPRESSION TERMINÉE');
  console.log('='.repeat(60));
  console.log(`📊 ${groups.length} groupe(s) supprimé(s):`);
  groups.forEach(g => console.log(`   ✓ ${g.name}`));
  console.log('='.repeat(60));
}

deleteAllGroups().catch((err) => {
  console.error('❌ Erreur inattendue:', err);
  process.exit(1);
});
