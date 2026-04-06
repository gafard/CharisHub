import { NextResponse } from 'next/server';
import { createBibleNaveResponse } from '@/lib/bibleStudyApi';
import { loadNaveTopics } from '@/lib/nave';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const term = searchParams.get('term');
  const bookId = searchParams.get('bookId');
  const chapter = Number(searchParams.get('chapter') || 0);
  const verse = Number(searchParams.get('verse') || 0);
  const limit = searchParams.get('limit');

  try {
    const result = await loadNaveTopics({
      term,
      bookId,
      chapter,
      verse,
      limit: limit ? Number(limit) : undefined,
    });

    return NextResponse.json(createBibleNaveResponse({
      ...result,
      source: 'Nave',
    }));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur interne.';
    const status = message === 'Livre invalide.' || message.startsWith('Paramètres manquants')
      ? 400
      : 500;

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
