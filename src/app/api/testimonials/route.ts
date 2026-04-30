import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyAuth } from '@/lib/apiAuth';
import { checkRateLimit } from '@/lib/rateLimit';
import logger from '@/lib/logger';
import { isMissingTableError } from '@/lib/community/utils';

export const runtime = 'nodejs';

const TABLE = 'charishub_testimonials';
const VALID_CATEGORIES = new Set(['guerison', 'provision', 'delivrance', 'transformation', 'grace', 'famille', 'priere']);
const VALID_MEDIA_TYPES = new Set(['audio', 'video']);
const MAX_CONTENT_LENGTH = 1200;
const MAX_AUDIO_SECONDS = 180;
const MAX_VIDEO_SECONDS = 90;

function cleanString(value: unknown, maxLength: number) {
  return String(value ?? '').trim().slice(0, maxLength);
}

// ─── GET /api/testimonials?groupId=xxx&limit=20 ──────────────────────────────

export async function GET(req: Request) {
  if (!supabaseServer) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get('groupId');
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 50);

  if (!groupId) return NextResponse.json({ error: 'groupId requis.' }, { status: 400 });

  try {
    const { data, error } = await supabaseServer
      .from(TABLE)
      .select('*')
      .eq('group_id', groupId)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (isMissingTable(error)) return NextResponse.json({ testimonials: [], tableReady: false });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ testimonials: data ?? [], tableReady: true });
  } catch (err) {
    logger.error('[testimonials GET]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}

// ─── POST /api/testimonials ───────────────────────────────────────────────────

interface PostBody {
  groupId: string;
  authorName: string;
  deviceId: string;
  category: 'guerison' | 'provision' | 'delivrance' | 'transformation' | 'grace' | 'famille' | 'priere';
  content?: string;
  mediaUrl?: string;
  mediaType?: 'audio' | 'video';
  durationSec?: number;
}

export async function POST(req: Request) {
  if (!supabaseServer) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });

  const rateLimit = checkRateLimit(req, { keyPrefix: 'api:testimonials', limit: 10, windowMs: 60 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Trop de témoignages. Réessaie dans une heure.' }, { status: 429, headers: rateLimit.headers });
  }

  const auth = await verifyAuth(req);
  const body = (await req.json()) as PostBody;
  const content = cleanString(body.content, MAX_CONTENT_LENGTH);
  const authorName = cleanString(body.authorName, 60) || 'Anonyme';
  const deviceId = cleanString(body.deviceId, 96) || 'unknown';
  const mediaUrl = cleanString(body.mediaUrl, 2048);
  const mediaType = body.mediaType ? String(body.mediaType) : '';
  const durationSec = Number(body.durationSec ?? 0);

  if (!body.groupId || !authorName || !body.category) {
    return NextResponse.json({ error: 'Paramètres manquants.' }, { status: 400 });
  }
  if (!VALID_CATEGORIES.has(body.category)) {
    return NextResponse.json({ error: 'Catégorie de témoignage invalide.' }, { status: 400 });
  }
  if (!content && !mediaUrl) {
    return NextResponse.json({ error: 'Un texte ou un média est requis.' }, { status: 400 });
  }
  if (mediaUrl && (!mediaType || !VALID_MEDIA_TYPES.has(mediaType))) {
    return NextResponse.json({ error: 'Type de média invalide.' }, { status: 400 });
  }
  if (mediaType === 'audio' && durationSec > MAX_AUDIO_SECONDS + 5) {
    return NextResponse.json({ error: 'Le témoignage audio est trop long.' }, { status: 400 });
  }
  if (mediaType === 'video' && durationSec > MAX_VIDEO_SECONDS + 5) {
    return NextResponse.json({ error: 'Le témoignage vidéo est trop long.' }, { status: 400 });
  }

  try {
    const memberQuery = supabaseServer
      .from('charishub_group_members')
      .select('id,status')
      .eq('group_id', body.groupId)
      .eq(auth?.userId ? 'user_id' : 'device_id', auth?.userId ?? deviceId)
      .limit(1);
    const { data: memberships, error: memberError } = await memberQuery;

    if (memberError && !isMissingTable(memberError)) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }
    const isMember = (memberships ?? []).some((member) => member.status !== 'pending' && member.status !== 'rejected');
    if (!isMember) {
      return NextResponse.json({ error: 'Rejoins le groupe avant de partager un témoignage.' }, { status: 403 });
    }

    const { data, error } = await supabaseServer
      .from(TABLE)
      .insert({
        group_id: body.groupId,
        author_name: authorName,
        author_device_id: deviceId,
        user_id: auth?.userId ?? null,
        category: body.category,
        content: content || null,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
        duration_sec: Number.isFinite(durationSec) && durationSec > 0 ? Math.round(durationSec) : null,
        visibility: 'group',
        status: 'published',
      })
      .select()
      .single();

    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({ error: 'Table non initialisée. Contacte un administrateur.' }, { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ testimonial: data, ok: true });
  } catch (err) {
    logger.error('[testimonials POST]', err);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
