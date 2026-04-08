import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { hasWebPushConfig, sendWebPush } from '@/lib/webPush';
import { verifyAuthSoft } from '@/lib/apiAuth';
import logger from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!supabaseServer) {
    logger.error('Supabase server client is not initialized');
    return NextResponse.json({ error: 'Supabase server client is not configured' }, { status: 503 });
  }
  const client = supabaseServer;

  // Auth check (soft: logs warning but doesn't block yet)
  await verifyAuthSoft(req);

  try {
    const { groupId, userId, userName } = await req.json();

    if (!groupId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Créer l'appel
    logger.log('Tentative de création de l\'appel pour le groupe:', groupId, 'par l\'utilisateur:', userId);
    const { data: call, error: callError } = await client
      .from('charishub_group_calls')
      .insert({
        group_id: groupId,
        room_id: `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        created_by: userId,
        status: 'ringing'
      })
      .select()
      .single();

    if (callError) {
      logger.error('Error creating group call:', callError);
      return NextResponse.json({ error: `Failed to create group call: ${callError.message}` }, { status: 500 });
    }
    logger.log('Appel créé avec succès:', call);

    // Récupérer les membres du groupe
    logger.log('[start-call] step=fetch-group-members');
    let { data: groupMembers, error: membersError } = await client
      .from('charishub_group_members')
      .select('device_id, status')
      .eq('group_id', groupId);

    if (membersError && String(membersError.message || '').toLowerCase().includes('status')) {
      const fallback = await client
        .from('charishub_group_members')
        .select('device_id')
        .eq('group_id', groupId);
      groupMembers = (fallback.data ?? []) as any[];
      membersError = fallback.error;
    }

    if (membersError) {
      logger.error('Error getting group members:', membersError);
      return NextResponse.json({ error: `Failed to get group members: ${membersError.message}` }, { status: 500 });
    }
    logger.log('Membres du groupe récupérés:', groupMembers);

    // Créer les invitations pour chaque membre (sauf initiateur)
    logger.log('[start-call] step=filter-other-members');
    const approvedMembers = (groupMembers ?? []).filter((member: any) => !member.status || member.status === 'approved');
    const otherMembers = approvedMembers.filter((m: any) => 
      (m.device_id && m.device_id !== userId) && // legacy check if device_id happened to be the userId
      (m.user_id && m.user_id !== userId)
    );
    logger.log('[start-call] step=create-invites');
    const invitePromises = otherMembers.map(member =>
      client.from('charishub_group_call_invites').upsert({
        call_id: call.id,
        group_id: groupId,
        device_id: member.device_id
      }, { onConflict: 'call_id,device_id' }) // Utilisation de upsert pour éviter les erreurs de doublon
    );

    // Utiliser Promise.allSettled pour capturer les erreurs individuelles
    const inviteResults = await Promise.allSettled(invitePromises);
    const failed = inviteResults.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      logger.error('Invite insert failed:', failed[0]);
      // Ne pas échouer complètement, mais logguer l'erreur
      logger.warn('Some invites failed to create, continuing...');
    }

    // Note: La diffusion Realtime est gérée côté client pour éviter les problèmes avec le client Supabase dans les API routes
    logger.log('[start-call] step=realtime-broadcast-skipped-server-side');

    // Envoyer des notifications push aux membres hors ligne du groupe
    try {
      await sendPushNotificationsToOfflineMembers(client, groupId, userId, call.id, call.room_id, userName);
    } catch (pushError) {
      logger.error('Push notifications failed (ignored):', pushError);
      // Ne pas échouer l'appel si les notifications push échouent
    }

    return NextResponse.json({ success: true, callId: call.id, roomId: call.room_id, call });
  } catch (error: any) {
    logger.error('Error starting group call:', error);
    logger.error('Error details:', {
      message: error?.message,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      name: error?.name
    });

    return NextResponse.json(
      {
        error: 'Failed to start group call',
        details: error?.message ?? String(error),
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
      { status: 500 }
    );
  }
}

async function sendPushNotificationsToOfflineMembers(
  client: NonNullable<typeof supabaseServer>,
  groupId: string,
  initiatorId: string,
  callId: string,
  roomId: string,
  userName?: string
) {
  try {
    logger.log('[start-call] step=fetch-group-members-for-push');

    // Récupérer les membres du groupe
    const { data: groupMembers, error: membersError } = await client
      .from('charishub_group_members')
      .select('device_id, status')
      .eq('group_id', groupId);

    if (membersError) {
      logger.error('Error getting group members for push:', membersError);
      return;
    }

    if (!groupMembers || groupMembers.length === 0) {
      logger.log('No members found for group:', groupId);
      return;
    }

    // Send to ALL members except initiator (no offline-only filter)
    const memberDeviceIds = groupMembers
      .filter((m: any) => !m.status || m.status === 'approved')
      .filter((m: any) => (m.user_id && m.user_id !== initiatorId) || (m.device_id && m.device_id !== initiatorId))
      .map((m: any) => m.device_id)
      .filter(id => !!id);

    if (memberDeviceIds.length === 0) {
      logger.log('No other members to notify');
      return;
    }

    logger.log(`[start-call] Sending push to ${memberDeviceIds.length} members`);

    // Récupérer leurs abonnements push
    const { data: subscriptions, error: subsError } = await client
      .from('push_subscriptions')
      .select('subscription_json, device_id')
      .in('device_id', memberDeviceIds);

    if (subsError) {
      logger.error('Error getting push subscriptions:', subsError);
      return;
    }

    if (!subscriptions || subscriptions.length === 0) {
      logger.log('[start-call] No push subscriptions found for any member');
      return;
    }

    logger.log(`[start-call] Found ${subscriptions.length} push subscriptions`);

    // Envoyer les notifications push en plusieurs vagues pour simuler une sonnerie persistante
    let sent = 0;
    let failed = 0;
    const waves = 3; // 3 vagues de notifications
    const interval = 8000; // Toutes les 8 secondes

    const sendWave = async (wave: number) => {
        logger.log(`[start-call] Sending wave ${wave + 1}/${waves}`);
        const notificationPromises = subscriptions.map(async (sub) => {
            if (!sub.subscription_json) return;
            try {
                await sendWebPush(sub.subscription_json, {
                    title: `Appel de groupe ${wave > 0 ? '(Rappel)' : ''}`,
                    body: `${userName || 'Un membre'} vous invite à rejoindre l'appel.`,
                    url: `/groups?group=${encodeURIComponent(groupId)}&call=${encodeURIComponent(callId)}&autoJoin=true`,
                    tag: `group-call-${callId}`,
                    icon: '/globe.svg',
                    badge: '/globe.svg',
                    requireInteraction: true,
                    vibrate: [500, 200, 500, 200, 1000]
                });
                sent++;
            } catch (err: any) {
                failed++;
                logger.error(`[start-call] Push wave ${wave} failed for ${sub.device_id}:`, err?.statusCode || err?.message);
            }
        });
        await Promise.all(notificationPromises);
    };

    // Première vague immédiate
    await sendWave(0);

    // Vagues suivantes en arrière-plan pour ne pas bloquer la réponse API
    if (waves > 1) {
        (async () => {
            for (let i = 1; i < waves; i++) {
                await new Promise(r => setTimeout(r, interval));
                await sendWave(i);
            }
            logger.log(`[start-call] Multi-wave push complete: sent=${sent}, failed=${failed}`);
        })().catch(e => logger.error('[start-call] Background push waves failed:', e));
    }
  } catch (error) {
    logger.error('Error sending push notifications:', error);
  }
}
