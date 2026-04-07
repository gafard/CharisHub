import logger from '@/lib/logger';
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyAuthSoft } from '@/lib/apiAuth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!supabaseServer) {
    logger.error('Supabase server client is not initialized');
    return NextResponse.json({ error: 'Supabase server client is not configured' }, { status: 503 });
  }

  await verifyAuthSoft(req);

  try {
    const { callId, deviceId } = await req.json();

    if (!callId || !deviceId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Mettre à jour le statut de l'appel
    const { error } = await supabaseServer
      .from('charishub_group_calls')
      .update({ 
        status: 'ended', 
        ended_at: new Date().toISOString() 
      })
      .eq('id', callId)
      .in('status', ['ringing', 'active']); // Gère aussi le cas où l'organisateur raccroche avant qu'un pair rejoigne

    if (error) {
      logger.error('Error updating call status:', error);
      return NextResponse.json({ error: 'Failed to end call' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('Error ending group call:', error);
    return NextResponse.json({ error: 'Failed to end group call' }, { status: 500 });
  }
}
