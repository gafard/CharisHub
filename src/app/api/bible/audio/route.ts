import { NextRequest, NextResponse } from 'next/server';
import { getSelahAudioCandidates } from '../../../../lib/bibleAudio';

export const runtime = 'nodejs';
export const maxDuration = 60; // For ElevenLabs TTS generation
export const dynamic = 'force-dynamic';

const AUDIO_CACHE_CONTROL = 'public, max-age=31536000, immutable';

const PASSTHROUGH_HEADERS = [
  'content-type',
  'content-length',
  'accept-ranges',
  'content-range',
  'etag',
  'last-modified',
  'cache-control',
  'content-disposition',
  'vary',
] as const;

function cleanChapterParam(rawChapter: string | null): number | null {
  if (!rawChapter) return null;
  const chapter = Number(rawChapter);
  if (!Number.isInteger(chapter) || chapter < 1) return null;
  return chapter;
}

function sanitizeFilenamePart(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'audio';
}

function addVaryRange(headers: Headers) {
  const existing = headers.get('vary');
  if (!existing) {
    headers.set('vary', 'Range');
    return;
  }
  if (!/\brange\b/i.test(existing)) {
    headers.set('vary', `${existing}, Range`);
  }
}

function buildResponseHeaders(upstream: Response, candidate: string, inlineFilename: string) {
  const headers = new Headers();
  for (const key of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }
  if (!headers.has('content-type')) headers.set('content-type', 'audio/mpeg');
  if (!headers.has('cache-control')) headers.set('cache-control', AUDIO_CACHE_CONTROL);
  if (!headers.has('content-disposition')) {
    headers.set('content-disposition', `inline; filename="${inlineFilename}"`);
  }
  addVaryRange(headers);
  headers.set('x-bible-audio-source', candidate);
  return headers;
}

async function proxyAudio(req: NextRequest, method: 'GET' | 'HEAD') {
  const translation = req.nextUrl.searchParams.get('translation') ?? 'LSG';
  const bookId = req.nextUrl.searchParams.get('book') ?? '';
  const chapter = cleanChapterParam(req.nextUrl.searchParams.get('chapter'));

  if (!bookId || !chapter) {
    return NextResponse.json({ error: 'Missing or invalid query params: book, chapter.' }, { status: 400 });
  }

  const candidates = getSelahAudioCandidates(translation, bookId, chapter);
  const errors: string[] = [];
  const requestedRange = req.headers.get('range');
  const safeTranslation = sanitizeFilenamePart(translation);
  const safeBook = sanitizeFilenamePart(bookId);
  const inlineFilename = `${safeTranslation}-${safeBook}-${chapter}.mp3`;

  for (const candidate of candidates) {
    const attempts = method === 'HEAD'
      ? [
          { method: 'HEAD' as const, range: requestedRange },
          { method: 'GET' as const, range: requestedRange || 'bytes=0-0' },
        ]
      : [
          { method: 'GET' as const, range: requestedRange },
        ];

    for (const attempt of attempts) {
      try {
        const upstream = await fetch(candidate, {
          method: attempt.method,
          redirect: 'follow',
          cache: 'no-store',
          headers: {
            ...(attempt.range ? { range: attempt.range } : {}),
            // Some providers are stricter with generic default user agents.
            'user-agent': 'Mozilla/5.0 (compatible; Formation-Biblique/1.0)',
          },
        });

        if (!upstream.ok && upstream.status !== 206) {
          errors.push(`${attempt.method} ${candidate} -> ${upstream.status}`);
          continue;
        }
        if (method === 'GET' && !upstream.body) {
          errors.push(`${attempt.method} ${candidate} -> empty body`);
          continue;
        }

        const headers = buildResponseHeaders(upstream, candidate, inlineFilename);
        if (method === 'HEAD') {
          // If HEAD fallback used GET, explicitly cancel stream to avoid downloading audio data.
          if (upstream.body) void upstream.body.cancel();
          return new NextResponse(null, {
            status: upstream.status,
            headers,
          });
        }

        return new NextResponse(upstream.body, {
          status: upstream.status,
          headers,
        });
      } catch (error) {
        errors.push(
          `${attempt.method} ${candidate} -> ${error instanceof Error ? error.message : 'fetch failed'}`
        );
      }
    }
  }

  // FALLBACK: ElevenLabs TTS + Global Cache
  console.log(`No upstream audio found for ${translation} ${bookId} ${chapter}. Falling back to ElevenLabs...`);
  try {
    const { getOrGenerateChapterAudio } = await import('../../../../lib/elevenlabs');
    const result = await getOrGenerateChapterAudio(translation, bookId, chapter);
    
    if (result) {
      console.log(`ElevenLabs audio generated/retrieved for ${translation} ${bookId} ${chapter}. Returning buffer...`);
      return new NextResponse(result.buffer, {
        status: 200,
        headers: {
          'Content-Type': result.contentType,
          'Cache-Control': AUDIO_CACHE_CONTROL,
          'x-bible-audio-source': 'elevenlabs-cache',
        },
      });
    } else {
      console.error(`ElevenLabs generation returned null for ${translation} ${bookId} ${chapter}.`);
    }
  } catch (err) {
    console.error(`Critical error during ElevenLabs fallback for ${translation} ${bookId} ${chapter}:`, err);
    errors.push(`TTS Fallback Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  console.log(`Audio request failed for ${translation} ${bookId} ${chapter}. Errors:`, errors);
  return NextResponse.json(
    {
      error: 'Audio source unavailable for this chapter.',
      details: errors.slice(0, 5),
    },
    { status: 404 }
  );
}

export async function GET(req: NextRequest) {
  return proxyAudio(req, 'GET');
}

export async function HEAD(req: NextRequest) {
  return proxyAudio(req, 'HEAD');
}
