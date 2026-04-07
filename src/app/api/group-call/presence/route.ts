import logger from '@/lib/logger';
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

type UpsertPresenceBody = {
  action?: 'upsert' | 'clear';
  groupId?: string;
  deviceId?: string;
  displayName?: string;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  joinedAt?: string;
  sharedBibleRef?: string | null;
  sharedBibleContent?: string | null;
  prayerFlowOpen?: boolean;
  prayerFlowStepIndex?: number;
};

export async function POST(req: Request) {
  if (!supabaseServer) {
    return NextResponse.json({ ok: false, error: 'Supabase server client is not configured' }, { status: 503 });
  }

  let body: UpsertPresenceBody;
  try {
    body = (await req.json()) as UpsertPresenceBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = body.action || 'upsert';
  const groupId = String(body.groupId || '').trim();
  const deviceId = String(body.deviceId || '').trim();

  if (!groupId || !deviceId) {
    return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
  }

  if (action === 'clear') {
    const { error } = await supabaseServer
      .from('community_group_call_presence')
      .delete()
      .eq('group_id', groupId)
      .eq('device_id', deviceId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  const now = new Date().toISOString();
  const row = {
    group_id: groupId,
    device_id: deviceId,
    guest_id: deviceId,
    display_name: String(body.displayName || 'Invite').trim() || 'Invite',
    audio_enabled: !!body.audioEnabled,
    video_enabled: !!body.videoEnabled,
    joined_at: body.joinedAt || now,
    last_seen_at: now,
    shared_bible_ref: body.sharedBibleRef || null,
    shared_bible_content: body.sharedBibleContent || null,
    prayer_flow_open: !!body.prayerFlowOpen,
    prayer_flow_step_index: body.prayerFlowStepIndex || 0,
  };

  const { error } = await supabaseServer
    .from('community_group_call_presence')
    .upsert(row, { onConflict: 'group_id,device_id' });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
