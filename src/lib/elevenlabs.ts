import { createClient } from '@supabase/supabase-js';
import { BIBLE_BOOKS } from './bibleCatalog';
import fs from 'fs';
import path from 'path';

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
    console.error('Supabase storage check error:', err);
  }

  if (!ELEVENLABS_API_KEY) {
    console.error('Missing ELEVENLABS_API_KEY');
    return null;
  }

  // 2. Load Text from local filesystem (much faster and more secure than fetch)
  let chapterText = '';
  try {
    const biblePath = path.join(process.cwd(), 'public', 'bibles', safeTranslation.toUpperCase(), 'bible.json');
    let bibleContent = '';
    
    if (fs.existsSync(biblePath)) {
      bibleContent = fs.readFileSync(biblePath, 'utf8');
    } else {
      // Fallback lowercase path
      const biblePathLow = path.join(process.cwd(), 'public', 'bibles', safeTranslation, 'bible.json');
      if (fs.existsSync(biblePathLow)) {
        bibleContent = fs.readFileSync(biblePathLow, 'utf8');
      }
    }

    if (!bibleContent) {
      console.error(`Bible file not found: ${safeTranslation}`);
      return null;
    }

    const bibleJson = JSON.parse(bibleContent);
    chapterText = extractChapterText(bibleJson, book, chapter);
  } catch (err) {
    console.error('Failed to read bible JSON from disk', err);
    return null;
  }

  if (!chapterText) return null;

  // 3. Call ElevenLabs with Chunking support
  // Max characters per request is ~5000. Some chapters are longer.
  const CHUNK_SIZE = 4800;
  const textSegments: string[] = [];
  for (let i = 0; i < chapterText.length; i += CHUNK_SIZE) {
    textSegments.push(chapterText.slice(i, i + CHUNK_SIZE));
  }

  try {
    const audioBuffers: Buffer[] = [];
    
    for (const segment of textSegments) {
      const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: segment,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          }
        }),
      });

      if (!elRes.ok) {
        throw new Error(`ElevenLabs API error: ${await elRes.text()}`);
      }

      const segmentBuffer = await elRes.arrayBuffer();
      audioBuffers.push(Buffer.from(segmentBuffer));
    }

    // Concaténer les segments
    const finalBuffer = Buffer.concat(audioBuffers);

    // 4. Cache in Supabase
    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(fileName, finalBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      console.warn('Failed to cache audio in Supabase:', uploadError);
    }

    return { 
      buffer: finalBuffer.buffer.slice(finalBuffer.byteOffset, finalBuffer.byteOffset + finalBuffer.byteLength), 
      contentType: 'audio/mpeg' 
    };
  } catch (err) {
    console.error('Audio generation failed:', err);
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
