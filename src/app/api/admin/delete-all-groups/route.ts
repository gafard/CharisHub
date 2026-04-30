import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { supabaseServer } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

type GroupRow = {
  id: string;
  name: string | null;
};

function isMissingTableError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || message.includes('does not exist');
}

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
 * API pour supprimer tous les groupes
 * Méthode: DELETE
 * Endpoint: /api/admin/delete-all-groups
 * 
 * ⚠️ ATTENTION: Cette route supprime TOUS les groupes et leurs données associées
 */
export async function DELETE(req: Request) {
  const guard = await requireAdminClient(req);
  if (!guard.client) return guard.response;

  const confirmation = req.headers.get('x-confirm-admin-action');
  if (confirmation !== 'delete-all-groups') {
    return NextResponse.json(
      {
        error: 'Confirmation requise pour cette action destructive.',
        requiredHeader: 'x-confirm-admin-action: delete-all-groups',
      },
      { status: 400 }
    );
  }

  const client = guard.client;

  try {
    // Récupérer tous les groupes
    const { data: groups, error: fetchError } = await client
      .from('charishub_groups')
      .select('id, name');

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

    const typedGroups = groups as GroupRow[];
    const groupIds = typedGroups.map((group) => group.id);
    const groupNames = typedGroups.map((group) => group.name).filter(Boolean);

    // Supprimer les données associées en cascade
    const cleanupResults = await Promise.allSettled([
      client.from('charishub_group_members').delete().in('group_id', groupIds),
      client.from('charishub_posts').delete().in('group_id', groupIds),
      client.from('charishub_group_challenges').delete().in('group_id', groupIds),
      client.from('charishub_group_calls').delete().in('group_id', groupIds),
      client.from('community_group_call_presence').delete().in('group_id', groupIds),
      client.from('community_group_call_events').delete().in('group_id', groupIds),
    ]);

    for (const result of cleanupResults) {
      if (result.status === 'rejected') {
        return NextResponse.json(
          { error: 'Erreur lors de la suppression des données associées' },
          { status: 500 }
        );
      }
      if (result.value.error && !isMissingTableError(result.value.error)) {
        return NextResponse.json(
          { error: 'Erreur lors de la suppression des données associées', details: result.value.error },
          { status: 500 }
        );
      }
    }

    // 7. Supprimer tous les groupes
    const { error: deleteError } = await client
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
export async function GET(req: Request) {
  const guard = await requireAdminClient(req);
  if (!guard.client) return guard.response;

  const { data: groups, error } = await guard.client
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
