import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * API pour supprimer tous les groupes
 * Méthode: DELETE
 * Endpoint: /api/admin/delete-all-groups
 * 
 * ⚠️ ATTENTION: Cette route supprime TOUS les groupes et leurs données associées
 */
export async function DELETE() {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase non configuré' },
      { status: 500 }
    );
  }

  try {
    // Récupérer tous les groupes
    const { data: groups, error: fetchError } = await supabase
      .from('charishub_groups')
      .select('id, name, created_by_device_id');

    if (fetchError) {
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des groupes', details: fetchError },
        { status: 500 }
      );
    }

    if (!groups || groups.length === 0) {
      return NextResponse.json(
        { message: 'Aucun groupe trouvé', count: 0 },
        { status: 200 }
      );
    }

    const groupIds = groups.map((g: any) => g.id);
    const groupNames = groups.map((g: any) => g.name);

    // Supprimer les données associées en cascade
    // 1. Supprimer les membres
    await supabase.from('charishub_group_members').delete().in('group_id', groupIds);
    
    // 2. Supprimer les posts
    await supabase.from('charishub_posts').delete().in('group_id', groupIds);
    
    // 3. Supprimer les challenges
    await supabase.from('charishub_group_challenges').delete().in('group_id', groupIds);
    
    // 4. Supprimer les appels
    await supabase.from('charishub_group_calls').delete().in('group_id', groupIds);
    
    // 5. Supprimer les présences
    await supabase.from('community_group_call_presence').delete().in('group_id', groupIds);
    
    // 6. Supprimer les événements
    await supabase.from('community_group_call_events').delete().in('group_id', groupIds);

    // 7. Supprimer tous les groupes
    const { error: deleteError } = await supabase
      .from('charishub_groups')
      .delete()
      .in('id', groupIds);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Erreur lors de la suppression des groupes', details: deleteError },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Tous les groupes ont été supprimés avec succès',
      deletedCount: groups.length,
      deletedGroups: groupNames
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur inattendue', details: error },
      { status: 500 }
    );
  }
}

// Aussi permettre GET pour voir les groupes avant suppression
export async function GET() {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase non configuré' },
      { status: 500 }
    );
  }

  const { data: groups, error } = await supabase
    .from('charishub_groups')
    .select('id, name, created_by_device_id, members_count, group_type, created_at');

  if (error) {
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des groupes', details: error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    count: groups?.length || 0,
    groups: groups || []
  });
}
