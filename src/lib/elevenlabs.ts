import { createClient } from '@supabase/supabase-js';
import { BIBLE_BOOKS } from './bibleCatalog';
import logger from './logger';
import fs from 'fs';
import path from 'path';

function splitAtNaturalPauses(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let current = '';
  
  // Split by sentences using lookbehind for punctuation
  const sentences = text.split(/(?<=[.!?;])\s+/);
  
  for (const sentence of sentences) {
    if (current.length + sentence.length > maxLen) {
      if (current) chunks.push(current.trim());
      
      // If a single sentence is still longer than maxLen, split it by spaces or chars
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

// Empêcher l'exécution côté client pour protéger la clé SERVICE_ROLE
if (typeof window !== 'undefined') {
  throw new Error('This module can only be executed on the server.');
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'ojsdYNTmnPdf7yAl8rI5';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function getOrGenerateChapterAudio(
  translation: string,
  book: string,
  chapter: number,
  _unused_reqUrl?: string
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  const safeTranslation = translation.toLowerCase().replace(/[^a-z0-9_-]+/g, '');
  const safeBook = book.toLowerCase().replace(/[^a-z0-9_-]+/g, '');
  const fileName = `audio-cache/${safeTranslation}/${safeBook}_${chapter}.mp3`;
  const bucketName = 'community-media';

  // 1. Check Cache in Supabase
  try {
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(bucketName)
      .download(fileName);

    if (fileData) {
      const arrayBuffer = await fileData.arrayBuffer();
      return { buffer: arrayBuffer, contentType: fileData.type || 'audio/mpeg' };
    }
  } catch (err) {
    // Cache miss is normal, but other errors should be logged
    logger.error('[ElevenLabs] Vérification cache Supabase:', err);
  }

  if (!ELEVENLABS_API_KEY) {
    logger.error('[ElevenLabs] ELEVENLABS_API_KEY manquante');
    return null;
  }

  let chapterText = '';
  try {
    const biblePath = path.join(process.cwd(), 'public', 'bibles', safeTranslation.toUpperCase(), 'bible.json');
    let bibleContent = '';
    try {
      bibleContent = fs.readFileSync(biblePath, 'utf8');
    } catch {
      const biblePathLow = path.join(process.cwd(), 'public', 'bibles', safeTranslation, 'bible.json');
      bibleContent = fs.readFileSync(biblePathLow, 'utf8');
    }
    const bibleJson = JSON.parse(bibleContent);
    chapterText = extractChapterText(bibleJson, book, chapter);
  } catch (err) {
    logger.error('[ElevenLabs] Lecture bible échouée:', err);
    return null;
  }

  if (!chapterText) return null;

  try {
    const CHUNK_SIZE = 4800;
    const textSegments = splitAtNaturalPauses(chapterText, CHUNK_SIZE);
    logger.log(`[ElevenLabs] Génération audio ${translation} ${book} ${chapter} — ${textSegments.length} segments séquentiels`);

    // Séquentiel pour respecter les limites de concurrence ElevenLabs
    const audioBuffers: Buffer[] = [];
    for (let i = 0; i < textSegments.length; i++) {
      const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textSegments[i],
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });

      if (!elRes.ok) {
        const errText = await elRes.text();
        throw new Error(`ElevenLabs segment ${i + 1}: ${errText}`);
      }

      audioBuffers.push(Buffer.from(await elRes.arrayBuffer()));
    }

    const finalBuffer = Buffer.concat(audioBuffers);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(fileName, finalBuffer, { contentType: 'audio/mpeg', upsert: true });

    if (uploadError) {
      logger.error('[ElevenLabs] Cache Supabase échoué:', uploadError);
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

function extractChapterText(bibleJson: any, bookId: string, chapterNum: number): string {
    const bookIndex = BIBLE_BOOKS.findIndex(b => b.id.toLowerCase() === bookId.toLowerCase());
    
    // Cas 1: Structure indexée par chiffres (ex: KJF)
    if (bookIndex !== -1) {
        const bookKey = (bookIndex + 1).toString();
        const bookObj = bibleJson[bookKey];
        if (bookObj && !Array.isArray(bookObj)) {
            const chapterObj = bookObj[chapterNum.toString()];
            if (chapterObj && !Array.isArray(chapterObj)) {
                const verseKeys = Object.keys(chapterObj).sort((a, b) => Number(a) - Number(b));
                return verseKeys.map(k => chapterObj[k]).join(' ');
            }
        }
    }

    // Cas 2: Structure avec "Testaments" (ex: MARTIN)
    if (bibleJson.Testaments) {
        for (const test of bibleJson.Testaments) {
            const books = test.Books || [];
            const book = books.find((b: any, idx: number) => 
                (bookIndex !== -1 && idx === bookIndex) ||
                b.Name?.toLowerCase() === bookId.toLowerCase() || 
                b.Abbreviation?.toLowerCase() === bookId.toLowerCase()
            );

            if (book && book.Chapters) {
                const chapter = book.Chapters.find((c: any) => c.ID === chapterNum) || book.Chapters[chapterNum - 1];
                if (chapter && chapter.Verses) {
                    return chapter.Verses.map((v: any) => v.Text || v.text || "").join(' ');
                }
            }
        }
    }

    // Cas 3: Structure standard avec tableau "books" (ex: LSG, BDS)
    const books = bibleJson.books || bibleJson.Books || [];
    const book = books.find((b: any) => 
        b.id?.toLowerCase() === bookId.toLowerCase() ||
        b.abbreviation?.toLowerCase() === bookId.toLowerCase() || 
        b.name?.toLowerCase() === bookId.toLowerCase()
    );
    
    if (book) {
        const chapters = book.chapters || book.Chapters || [];
        const chapter = chapters.find((c: any) => 
            c.chapter === chapterNum || c.ID === chapterNum || (c.chapter === 0 && chapterNum === 1)
        );
        
        if (chapter) {
            const verses = chapter.verses || chapter.Verses || [];
            if (Array.isArray(verses)) {
                return verses.map((v: any) => v.text || v.Text || v).join(' ');
            }
        }
    }
    
    return '';
}
