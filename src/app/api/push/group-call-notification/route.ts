import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { hasWebPushConfig, sendWebPush } from '@/lib/webPush';

export const runtime = 'nodejs';

type GroupCallNotificationBody = {
  groupId: string;
  callerDeviceId: string;
  callerUserId?: string | null;
  callerDisplayName: string;
  callType: 'audio' | 'video';
  groupName?: string;
  callId?: string | null;
};

export async function POST(req: Request) {
  console.log('Requête reçue pour notification d\'appel de groupe');

  if (!supabaseServer) {
    console.error('SUPABASE_SERVICE_ROLE_KEY manquant');
    return NextResponse.json(
      { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY missing' },
      { status: 503 }
    );
  }

  if (!hasWebPushConfig()) {
    console.error('VAPID config manquante');
    return NextResponse.json(
      { ok: false, error: 'VAPID config missing' },
      { status: 503 }
    );
  }

  let body: GroupCallNotificationBody;
  try {
    body = (await req.json()) as GroupCallNotificationBody;
    console.log('Données reçues:', body);
  } catch {
    console.error('Données JSON JSON invalides');
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { groupId, callerDeviceId, callerUserId, callerDisplayName, callType, groupName, callId } = body;

  if (!groupId || !callerDeviceId || !callerDisplayName) {
    console.error('Champs requis manquants:', { groupId, callerDeviceId, callerDisplayName });
    return NextResponse.json(
      { ok: false, error: 'Missing required fields' },
      { status: 400 }
    );
  }

  try {
    // Récupérer les membres du groupe sauf l'appelant
    console.log('Récupération des membres du groupe...');
    let { data: groupMembers, error: membersError } = await supabaseServer
      .from('charishub_group_members')
      .select('device_id, user_id, status')
      .eq('group_id', groupId);

    if (membersError && String(membersError.message).includes('status')) {
      console.log('Colonne status manquante, repli sur une sélection sans status');
      const fallback = await supabaseServer
        .from('charishub_group_members')
        .select('device_id, user_id')
        .eq('group_id', groupId);
      groupMembers = (fallback.data ?? []) as any[];
      membersError = fallback.error;
    }

    if (membersError) {
      console.error('Erreur lors de la récupération des membres du groupe:', membersError);
      throw new Error(membersError.message);
    }

    // Si la colonne status est présente, on ne garde que les 'approved'
    const approvedMembers = groupMembers ? groupMembers.filter((m: any) => !m.status || m.status === 'approved') : [];
    console.log('Membres du groupe trouvés (approuvés):', approvedMembers);

    if (approvedMembers.length === 0) {
      console.log('Aucun membre à notifier');
      return NextResponse.json({ ok: true, message: 'No members to notify' });
    }

    // Filtrer l'appelant par deviceId ET par userId
    const targetDeviceIds = approvedMembers
      .map((member: any) => member.device_id)
      .filter((id: string | null | undefined) => id && id !== callerDeviceId);

    const targetUserIds = approvedMembers
      .map((member: any) => member.user_id)
      .filter((id: string | null | undefined) => id && id !== callerUserId);

    console.log('Cibles filtrées :', { deviceCount: targetDeviceIds.length, userCount: targetUserIds.length });

    if (targetDeviceIds.length === 0 && targetUserIds.length === 0) {
      console.log('Aucun autre membre à notifier');
      return NextResponse.json({ ok: true, message: 'No other members to notify' });
    }

    // Récupérer les abonnements push pour ces devices OU ces users
    console.log('Récupération des abonnements push...');
    let query = supabaseServer
      .from('push_subscriptions')
      .select('endpoint,p256dh,auth,subscription_json,device_id,user_id');

    const conditions: string[] = [];
    if (targetDeviceIds.length > 0) conditions.push(`device_id.in.(${targetDeviceIds.map(id => `"${id}"`).join(',')})`);
    if (targetUserIds.length > 0) conditions.push(`user_id.in.(${targetUserIds.map(id => `"${id}"`).join(',')})`);

    const { data: subscriptions, error: subsError } = await query.or(conditions.join(','));

    if (subsError) {
      console.error('Erreur lors de la récupération des abonnements push:', subsError);
      throw new Error(subsError.message);
    }

    console.log('Abonnements push trouvés:', subscriptions?.length ?? 0);

    if (!subscriptions || subscriptions.length === 0) {
      console.log('Aucun abonnement push à notifier');
      return NextResponse.json({ ok: true, message: 'No push subscriptions to notify' });
    }

    // Envoyer les notifications push
    console.log('Envoi des notifications push...');
    let sent = 0;
    let failed = 0;
    const staleEndpoints: string[] = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        // Normalize subscription: prefer individual columns, fall back to subscription_json
        const endpoint = sub.endpoint || sub.subscription_json?.endpoint;
        const p256dh = sub.p256dh || sub.subscription_json?.keys?.p256dh;
        const auth = sub.auth || sub.subscription_json?.keys?.auth;

        if (!endpoint || !p256dh || !auth) {
          console.log('Abonnement incomplet ignoré pour device:', sub.device_id);
          failed += 1;
          return;
        }

        try {
          console.log('Envoi de la notification à:', sub.device_id);
          await sendWebPush(
            { endpoint, keys: { p256dh, auth } },
            {
                      title: `Appel ${callType === 'video' ? 'video' : 'audio'}${groupName ? ` - ${groupName}` : ' de groupe'}`,
                      body: `${callerDisplayName} vous invite a rejoindre un appel de groupe`,
                      url: `/groups?group=${encodeURIComponent(groupId)}${callId ? `&call=${encodeURIComponent(callId)}` : ''}&autoJoin=true`,
                      tag: `group-call-${callId || groupId}`,
                      icon: '/globe.svg',
                      badge: '/globe.svg',
                    }
                  );
          sent += 1;
        } catch (error: any) {
          failed += 1;
          const status = Number(error?.statusCode || 0);
          if (status === 404 || status === 410) {
            staleEndpoints.push(endpoint);
          }
          console.error('Erreur envoi push à', sub.device_id, ':', error?.message || error);
        }
      })
    );

    // Cleanup stale subscriptions
    let removed = 0;
    if (staleEndpoints.length) {
      const { error: removeError } = await supabaseServer
        .from('push_subscriptions')
        .delete()
        .in('endpoint', staleEndpoints);
      if (!removeError) removed = staleEndpoints.length;
    }

    console.log(`Notifications envoyées: ${sent}, échouées: ${failed}, nettoyées: ${removed}`);

    return NextResponse.json({
      ok: true,
      message: `Notifications sent to ${sent} members`,
      sent,
      failed,
      removed,
    });
  } catch (error: any) {
    console.error('Erreur lors de l\'envoi des notifications d\'appel de groupe:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to send notifications' },
      { status: 500 }
    );
  }
}
