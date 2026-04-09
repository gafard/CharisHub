// src/app/api/push/subscribe/route.ts
import logger from '@/lib/logger';
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { verifyAuthSoft } from '@/lib/apiAuth';

export const runtime = 'nodejs';

type SubscribeBody = {
  subscription?: {
    endpoint?: string;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
  deviceId?: string;
  userId?: string | null;
  locale?: string;
};

function clip(value: string, size = 120) {
  return value.length > size ? value.slice(0, size) : value;
}

export async function POST(req: Request) {
  if (!supabaseServer) {
    return NextResponse.json(
      { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY missing' },
      { status: 503 }
    );
  }

  const auth = await verifyAuthSoft(req);

  let body: SubscribeBody;
  try {
    body = (await req.json()) as SubscribeBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const endpoint = (body.subscription?.endpoint || '').trim();
  const p256dh = (body.subscription?.keys?.p256dh || '').trim();
  const authKey = (body.subscription?.keys?.auth || '').trim();
  const deviceId = clip((body.deviceId || '').trim(), 120);
  const locale = clip((body.locale || '').trim(), 16);

  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json(
      { ok: false, error: 'Missing endpoint or keys' },
      { status: 400 }
    );
  }

  // Sécurité: Si l'utilisateur est authentifié, on utilise son ID de session.
  // Sinon, on n'autorise pas de lier arbitrairement un userId (spoofing protection).
  const finalUserId = auth?.userId || null;

  const payload = {
    device_id: deviceId || null,
    user_id: finalUserId, 
    endpoint,
    p256dh,
    auth: authKey,
    locale: locale || null,
    subscription_json: body.subscription ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseServer
    .from('push_subscriptions')
    .upsert(payload, { onConflict: 'endpoint' });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        hint: 'Run supabase_tables.sql in Supabase SQL Editor.',
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
