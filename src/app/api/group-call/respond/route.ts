import logger from '@/lib/logger';
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyAuthSoft } from '@/lib/apiAuth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!supabaseServer) {
    return NextResponse.json({ error: 'Supabase server client is not configured' }, { status: 503 });
  }

  const auth = await verifyAuthSoft(req);

  const client = supabaseServer;

  try {
    const { callId, userId: bodyUserId, action } = await req.json(); // bodyUserId is deviceId
    
    if (!callId || !bodyUserId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Sécurité: Si l'utilisateur est authentifié, on lie son user_id à l'invitation (deviceId)
    // S'il n'est pas authentifié, on se fie au device_id fourni dans le body.
    let query = client
      .from('charishub_group_call_invites')
      .update({ 
        state: action,
        responded_at: new Date().toISOString(),
        user_id: auth?.userId || null
      })
      .eq('call_id', callId);

    if (auth) {
        // Un utilisateur authentifié peut répondre à une invitation liée à son device_id
        // ou à son user_id (migration future)
        query = query.or(`device_id.eq.${bodyUserId},user_id.eq.${auth.userId}`);
    } else {
        query = query.eq('device_id', bodyUserId);
    }

    const { error } = await query;

    if (error) {
      logger.error('Error updating call invite:', error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('Error updating call invite:', error);
    return NextResponse.json({ error: 'Failed to update call invite' }, { status: 500 });
  }
}
