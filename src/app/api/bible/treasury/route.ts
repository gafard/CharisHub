import { NextResponse } from 'next/server';
import { createBibleTreasuryResponse } from '@/lib/bibleStudyApi';
import { loadTreasuryEntries } from '@/lib/treasury';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get('bookId');
  const chapter = Number(searchParams.get('chapter') || 0);
  const verse = Number(searchParams.get('verse') || 0);
  const idParam = searchParams.get('id');

  try {
    const result = await loadTreasuryEntries({
      bookId,
      chapter,
      verse,
      id: idParam,
    });

    return NextResponse.json(createBibleTreasuryResponse({
      ...result,
      source: 'Treasury of Scripture Knowledge',
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
