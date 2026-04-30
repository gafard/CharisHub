/**
 * API Réactions témoignages — Amen / Gloire / Je prie pour toi
 */

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyAuth } from '@/lib/apiAuth';
import { checkRateLimit } from '@/lib/rateLimit';
import logger from '@/lib/logger';
import { isMissingTableError } from '@/lib/community/utils';

export const runtime = 'nodejs';

const TESTIMONIALS_TABLE = 'charishub_testimonials';
const REACTIONS_TABLE = 'charishub_testimonial_reactions';

export type ReactionType = 'amens' | 'gloires' | 'prayers';
const REACTION_COUNT_KEYS: Record<ReactionType, 'amens_count' | 'gloires_count' | 'prayers_count'> = {
  amens: 'amens_count',
  gloires: 'gloires_count',
  prayers: 'prayers_count',
};

interface PostBody {
  testimonialId: string;
  reaction: ReactionType;
  deviceId?: string;
}

function isDuplicate(err: { code?: string | null; message?: string | null } | null): boolean {
  const code = String(err?.code || '').toUpperCase();
  return code === '23505' || String(err?.message ?? '').toLowerCase().includes('duplicate key');
}

function cleanDeviceId(value: unknown) {
  return String(value ?? '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 96);
}

// ─── POST /api/testimonials/react ─────────────────────────────────────────────

export async function POST(req: Request) {
  if (!supabaseServer) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });

  const rateLimit = checkRateLimit(req, { keyPrefix: 'api:testimonials:react', limit: 60, windowMs: 60 * 1000 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Trop de réactions.' }, { status: 429, headers: rateLimit.headers });
  }

  const body = (await req.json()) as PostBody;
  if (!body.testimonialId || !body.reaction || !(body.reaction in REACTION_COUNT_KEYS)) {
    return NextResponse.json({ error: 'Paramètres manquants.' }, { status: 400 });
  }

  const auth = await verifyAuth(req);
  const deviceId = cleanDeviceId(body.deviceId);
  if (!auth?.userId && !deviceId) {
    return NextResponse.json({ error: 'Identité locale requise.' }, { status: 400 });
  }

  const col = REACTION_COUNT_KEYS[body.reaction];

  try {
    const { error: insertErr } = await supabaseServer
      .from(REACTIONS_TABLE)
      .insert({
        testimonial_id: body.testimonialId,
        reaction: body.reaction,
        user_id: auth?.userId ?? null,
        device_id: auth?.userId ? null : deviceId,
      });

    if (insertErr && !isDuplicate(insertErr)) {
      if (isMissingTableError(insertErr, REACTIONS_TABLE)) {
        return NextResponse.json({ error: 'Table de réactions non initialisée.' }, { status: 503 });
      }
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const { data: current, error: fetchErr } = await supabaseServer
      .from(TESTIMONIALS_TABLE)
      .select(col)
      .eq('id', body.testimonialId)
      .single();

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

    const count = Number((current as Record<string, number | null>)?.[col] ?? 0);

    return NextResponse.json({ ok: true, reacted: !insertErr, [col]: count });
  } catch (err) {
    logger.error('[testimonials react]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
