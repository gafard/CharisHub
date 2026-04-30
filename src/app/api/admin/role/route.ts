import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const admin = await verifyAdmin(req);

  return NextResponse.json({
    ok: true,
    isAdmin: !!admin,
    via: admin?.via ?? null,
  });
}

