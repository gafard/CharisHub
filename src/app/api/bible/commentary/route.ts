import { NextResponse } from 'next/server';
import { createBibleCommentaryResponse } from '@/lib/bibleStudyApi';
import { loadMatthewHenryCommentary } from '@/lib/matthewHenry';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get('bookId');
  const chapter = Number(searchParams.get('chapter') || 0);
  const idParam = searchParams.get('id');

  try {
    const { id, sections } = await loadMatthewHenryCommentary({
      bookId,
      chapter,
      id: idParam,
    });

    return NextResponse.json(createBibleCommentaryResponse({
      id,
      locale: 'fr',
      source: 'Matthew Henry',
      sections,
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
