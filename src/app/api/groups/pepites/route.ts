/**
 * API Pépites de groupe — Partage de trésors d'identité dans un groupe CharisHub.
 *
 * Les pépites de groupe sont stockées dans la table charishub_group_pepites.
 * Schema SQL (à exécuter dans Supabase):
 *
 * create table if not exists charishub_group_pepites (
 *   id uuid primary key default gen_random_uuid(),
 *   group_id uuid not null references charishub_groups(id) on delete cascade,
 *   author_name text not null,
 *   author_device_id text not null,
 *   user_id uuid references auth.users(id),
 *   reference text not null,
 *   verse_text text not null,
 *   note text,
 *   pepite_type text not null check (pepite_type in ('grace', 'identity', 'promise')),
 *   likes_count int default 0,
 *   created_at timestamptz default now()
 * );
 * alter table charishub_group_pepites enable row level security;
 * create policy "group members can read" on charishub_group_pepites for select using (true);
 * create policy "authenticated users can insert" on charishub_group_pepites for insert with check (auth.uid() = user_id);
 */

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyAuth } from '@/lib/apiAuth';
import logger from '@/lib/logger';

export const runtime = 'nodejs';

function isMissingTableError(err: { code?: string | null; message?: string | null } | null): boolean {
  const code = String(err?.code || '').toUpperCase();
  const msg = String(err?.message || '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || msg.includes('does not exist');
}

// ─── GET /api/groups/pepites?groupId=xxx ────────────────────────────────────

export async function GET(req: Request) {
  if (!supabaseServer) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get('groupId');
  if (!groupId) return NextResponse.json({ error: 'groupId requis.' }, { status: 400 });

  try {
    const { data, error } = await supabaseServer
      .from('charishub_group_pepites')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      if (isMissingTableError(error)) return NextResponse.json({ pepites: [], tableReady: false });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ pepites: data ?? [], tableReady: true });
  } catch (err) {
    logger.error('[group-pepites GET]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}

// ─── POST /api/groups/pepites ─────────────────────────────────────────────────

interface PostBody {
  groupId: string;
  reference: string;
  verseText: string;
  note?: string;
  pepiteType: 'grace' | 'identity' | 'promise';
  authorName: string;
  deviceId: string;
}

export async function POST(req: Request) {
  if (!supabaseServer) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });

  const auth = await verifyAuth(req);
  // Allow both authenticated and device-based users
  const body = (await req.json()) as PostBody;

  if (!body.groupId || !body.reference || !body.verseText || !body.pepiteType || !body.authorName) {
    return NextResponse.json({ error: 'Paramètres manquants.' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseServer
      .from('charishub_group_pepites')
      .insert({
        group_id: body.groupId,
        author_name: body.authorName.slice(0, 60),
        author_device_id: body.deviceId || 'unknown',
        user_id: auth?.userId ?? null,
        reference: body.reference.slice(0, 100),
        verse_text: body.verseText.slice(0, 500),
        note: body.note?.slice(0, 300) ?? null,
        pepite_type: body.pepiteType,
      })
      .select()
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json({ error: 'Table non initialisée. Contacte un administrateur.' }, { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ pepite: data, ok: true });
  } catch (err) {
    logger.error('[group-pepites POST]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
