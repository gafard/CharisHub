import logger from '@/lib/logger';
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyAuth } from '@/lib/apiAuth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!supabaseServer) {
    logger.error('Supabase server client is not initialized');
    return NextResponse.json({ error: 'Supabase server client is not configured' }, { status: 503 });
  }

  const auth = await verifyAuth(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { callId } = await req.json();

    if (!callId) {
      return NextResponse.json({ error: 'Missing callId' }, { status: 400 });
    }

    // Mettre à jour le statut de l'appel - uniquement si l'utilisateur en est le créateur
    const { error } = await supabaseServer
      .from('charishub_group_calls')
      .update({ 
        status: 'ended', 
        ended_at: new Date().toISOString() 
      })
      .eq('id', callId)
      .eq('created_by', auth.userId) // Sécurité : seul le créateur peut terminer l'appel techniquement ici
      .in('status', ['ringing', 'active']);

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
