import { createClient } from '@supabase/supabase-js';
import { BIBLE_BOOKS } from './bibleCatalog';
import { parseBibleJson } from './bible/parsers';
import logger from './logger';
import fs from 'fs';
import path from 'path';

// Server-only: protects the SERVICE_ROLE key
if (typeof window !== 'undefined') {
  throw new Error('This module can only be executed on the server.');
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'ojsdYNTmnPdf7yAl8rI5';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function splitAtNaturalPauses(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let current = '';
  const sentences = text.split(/(?<=[.!?;])\s+/);

  for (const sentence of sentences) {
    if (current.length + sentence.length > maxLen) {
      if (current) chunks.push(current.trim());
      if (sentence.length > maxLen) {
        let remaining = sentence;
        while (remaining.length > maxLen) {
          const subChunk = remaining.slice(0, maxLen);
          const lastSpace = subChunk.lastIndexOf(' ');
          const breakPoint = lastSpace > maxLen * 0.8 ? lastSpace : maxLen;
          chunks.push(remaining.slice(0, breakPoint).trim());
          remaining = remaining.slice(breakPoint);
        }
        current = remaining;
      } else {
        current = sentence;
      }
    } else {
      current += (current ? ' ' : '') + sentence;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

function loadBibleJson(translation: string): any {
  const safeTranslation = translation.replace(/[^a-zA-Z0-9_-]+/g, '');
  const candidates = [
    path.join(process.cwd(), 'public', 'bibles', safeTranslation.toUpperCase(), 'bible.json'),
    path.join(process.cwd(), 'public', 'bibles', safeTranslation.toLowerCase(), 'bible.json'),
    path.join(process.cwd(), 'public', 'bibles', safeTranslation, 'bible.json'),
  ];
  for (const p of candidates) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      // try next
    }
  }
  throw new Error(`Bible introuvable pour la traduction: ${translation}`);
}

export async function getOrGenerateChapterAudio(
  translation: string,
  bookId: string,
  chapter: number,
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  const safeTranslation = translation.toLowerCase().replace(/[^a-z0-9_-]+/g, '');
  const safeBook = bookId.toLowerCase().replace(/[^a-z0-9_-]+/g, '');
  const fileName = `audio-cache/${safeTranslation}/${safeBook}_${chapter}.mp3`;
  const bucketName = 'community-media';

  // 1. Check Supabase cache
  try {
    const { data: fileData } = await supabaseAdmin.storage
      .from(bucketName)
      .download(fileName);
    if (fileData) {
      logger.log(`[ElevenLabs] Cache hit: ${fileName}`);
      return { buffer: await fileData.arrayBuffer(), contentType: 'audio/mpeg' };
    }
  } catch {
    // Cache miss is normal
  }

  if (!ELEVENLABS_API_KEY) {
    logger.error('[ElevenLabs] ELEVENLABS_API_KEY manquante');
    return null;
  }

  // 2. Extract chapter text using validated parsers
  const book = BIBLE_BOOKS.find((b) => b.id.toLowerCase() === bookId.toLowerCase());
  if (!book) {
    logger.error(`[ElevenLabs] Livre introuvable: ${bookId}`);
    return null;
  }

  let chapterText = '';
  try {
    const bibleJson = loadBibleJson(translation);
    const verses = parseBibleJson(bibleJson, book, chapter);
    chapterText = verses.map((v) => v.text).join(' ').trim();
    logger.log(`[ElevenLabs] ${verses.length} versets extraits pour ${translation} ${bookId} ${chapter}`);
  } catch (err) {
    logger.error('[ElevenLabs] Lecture bible échouée:', err);
    return null;
  }

  if (!chapterText) {
    logger.error(`[ElevenLabs] Texte vide pour ${translation} ${bookId} ${chapter}`);
    return null;
  }

  // 3. Generate audio via ElevenLabs (sequential to respect rate limits)
  try {
    const CHUNK_SIZE = 4800;
    const segments = splitAtNaturalPauses(chapterText, CHUNK_SIZE);
    logger.log(`[ElevenLabs] Génération ${translation} ${bookId} ${chapter} — ${segments.length} segments`);

    const audioBuffers: Buffer[] = [];
    for (let i = 0; i < segments.length; i++) {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: segments[i],
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });

      if (!res.ok) {
        throw new Error(`ElevenLabs segment ${i + 1}/${segments.length}: ${await res.text()}`);
      }
      audioBuffers.push(Buffer.from(await res.arrayBuffer()));
    }

    const finalBuffer = Buffer.concat(audioBuffers);

    // 4. Upload to Supabase cache
    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(fileName, finalBuffer, { contentType: 'audio/mpeg', upsert: true });
    if (uploadError) {
      logger.error('[ElevenLabs] Upload cache Supabase échoué:', uploadError);
    }

    return {
      buffer: finalBuffer.buffer.slice(finalBuffer.byteOffset, finalBuffer.byteOffset + finalBuffer.byteLength),
      contentType: 'audio/mpeg',
    };
  } catch (err) {
    logger.error('[ElevenLabs] Génération audio échouée:', err);
    return null;
  }
}
