import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyAuth } from '@/lib/apiAuth';

export const runtime = 'nodejs';

type DeleteGroupBody = {
  groupId?: string;
};

function normalizeGroupId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isMissingTableError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || message.includes('does not exist');
}

export async function POST(req: Request) {
  if (!supabaseServer) {
    return NextResponse.json(
      { ok: false, error: 'Supabase server client is not configured.' },
      { status: 503 }
    );
  }

  const auth = await verifyAuth(req);
  if (!auth) {
    return NextResponse.json({ ok: false, error: 'Authentification requise.' }, { status: 401 });
  }

  let body: DeleteGroupBody;
  try {
    body = (await req.json()) as DeleteGroupBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Corps JSON invalide.' }, { status: 400 });
  }

  const groupId = normalizeGroupId(body.groupId);
  if (!groupId) {
    return NextResponse.json({ ok: false, error: 'Identifiant de groupe manquant.' }, { status: 400 });
  }

  const client = supabaseServer;
  const { data: group, error: groupError } = await client
    .from('charishub_groups')
    .select('id, user_id, created_by_device_id')
    .eq('id', groupId)
    .maybeSingle();

  if (groupError) {
    return NextResponse.json(
      { ok: false, error: groupError.message || 'Impossible de charger le groupe.' },
      { status: 500 }
    );
  }

  if (!group) {
    return NextResponse.json({ ok: false, error: 'Groupe introuvable.' }, { status: 404 });
  }

  let canDelete = group.user_id === auth.userId;

  if (!canDelete && !group.user_id && group.created_by_device_id) {
    const { data: memberships, error: membershipError } = await client
      .from('charishub_group_members')
      .select('device_id')
      .eq('group_id', groupId)
      .eq('user_id', auth.userId)
      .limit(5);

    if (membershipError) {
      return NextResponse.json(
        { ok: false, error: membershipError.message || 'Impossible de vérifier les droits du groupe.' },
        { status: 500 }
      );
    }

    const creatorDeviceId = String(group.created_by_device_id).trim();
    canDelete = (memberships ?? []).some((row) => String(row.device_id || '').trim() === creatorDeviceId);
  }

  if (!canDelete) {
    return NextResponse.json(
      { ok: false, error: 'Vous pouvez supprimer uniquement les groupes que vous avez créés.' },
      { status: 403 }
    );
  }

  const cleanupResults = await Promise.allSettled([
    client.from('community_group_call_presence').delete().eq('group_id', groupId),
    client.from('community_group_call_events').delete().eq('group_id', groupId),
    client.from('charishub_group_challenges').delete().eq('group_id', groupId),
  ]);

  for (const result of cleanupResults) {
    if (result.status === 'rejected') {
      return NextResponse.json(
        { ok: false, error: 'Impossible de nettoyer les données liées au groupe.' },
        { status: 500 }
      );
    }
    if (result.value.error && !isMissingTableError(result.value.error)) {
      return NextResponse.json(
        { ok: false, error: result.value.error.message || 'Impossible de nettoyer les données liées au groupe.' },
        { status: 500 }
      );
    }
  }

  const { error: deleteError } = await client
    .from('charishub_groups')
    .delete()
    .eq('id', groupId);

  if (deleteError) {
    return NextResponse.json(
      { ok: false, error: deleteError.message || 'Impossible de supprimer le groupe.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
