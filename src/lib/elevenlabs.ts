import { createClient } from '@supabase/supabase-js';
import { BIBLE_BOOKS } from './bibleCatalog';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'ojsdYNTmnPdf7yAl8rI5';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function getOrGenerateChapterAudio(
  translation: string,
  book: string,
  chapter: number,
  reqUrl: string
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  const safeTranslation = translation.toLowerCase().replace(/[^a-z0-9_-]+/g, '');
  const safeBook = book.toLowerCase().replace(/[^a-z0-9_-]+/g, '');
  const fileName = `audio-cache/${safeTranslation}/${safeBook}_${chapter}.mp3`;
  const bucketName = 'community-media';

  // 1. Check Cache in Supabase
  const { data: fileData, error: downloadError } = await supabaseAdmin.storage
    .from(bucketName)
    .download(fileName);

  if (fileData) {
    const arrayBuffer = await fileData.arrayBuffer();
    return { buffer: arrayBuffer, contentType: fileData.type || 'audio/mpeg' };
  }

  if (!ELEVENLABS_API_KEY) {
    console.error('Missing ELEVENLABS_API_KEY');
    return null;
  }

  // 2. Fetch Text from public/bibles/...
  let chapterText = '';
  try {
    const bibleUrl = new URL(`/bibles/${safeTranslation.toUpperCase()}/bible.json`, reqUrl).toString();
    const res = await fetch(bibleUrl);
    if (!res.ok) {
        // Fallback lowercase
        const bibleUrlLow = new URL(`/bibles/${safeTranslation}/bible.json`, reqUrl).toString();
        const resLow = await fetch(bibleUrlLow);
        if (!resLow.ok) return null;
        const bibleJson = await resLow.json();
        chapterText = extractChapterText(bibleJson, book, chapter);
    } else {
        const bibleJson = await res.json();
        chapterText = extractChapterText(bibleJson, book, chapter);
    }
  } catch (err) {
    console.error('Failed to fetch bible JSON for TTS', err);
    return null;
  }

  if (!chapterText) return null;

  // 3. Call ElevenLabs
  // Max characters per request is usually 5000 for standard tier. A bible chapter might be larger.
  // We may need to truncate or split if it's huge, but let's assume it fits or ElevenLabs handles it (or we slice to 5000 chars for now).
  const textToRead = chapterText.slice(0, 4900); 

  const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: textToRead,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      }
    }),
  });

  if (!elRes.ok) {
    console.error('ElevenLabs API error', await elRes.text());
    return null;
  }

  const audioBuffer = await elRes.arrayBuffer();

  // 4. Cache in Supabase
  await supabaseAdmin.storage
    .from(bucketName)
    .upload(fileName, audioBuffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    });

  return { buffer: audioBuffer, contentType: 'audio/mpeg' };
}

function extractChapterText(bibleJson: any, bookId: string, chapterNum: number): string {
    // Cas 1: Structure indexée par chiffres (ex: KJF)
    // bibleJson = { "1": { "1": { "1": "v1 text", "2": "v2 text" } } }
    const bookIndex = BIBLE_BOOKS.findIndex(b => b.id.toLowerCase() === bookId.toLowerCase());
    if (bookIndex !== -1) {
        const bookKey = (bookIndex + 1).toString();
        const bookObj = bibleJson[bookKey];
        if (bookObj && !Array.isArray(bookObj)) {
            const chapterObj = bookObj[chapterNum.toString()];
            if (chapterObj && !Array.isArray(chapterObj)) {
                // Si chapterObj est un objet de versets { "1": "text", "2": "text" }
                // On trie les clés pour être sûr de l'ordre
                const verseKeys = Object.keys(chapterObj).sort((a, b) => Number(a) - Number(b));
                return verseKeys.map(k => chapterObj[k]).join(' ');
            }
        }
    }

    // Cas 2: Structure avec "Testaments" (ex: MARTIN)
    if (bibleJson.Testaments) {
        for (const test of bibleJson.Testaments) {
            const books = test.Books || [];
            // Dans ce format, on cherche souvent par index ou par nom. 
            // On va essayer de trouver le livre dans la liste globale.
            const book = books[bookIndex] || books.find((b: any) => 
                b.Name?.toLowerCase() === bookId.toLowerCase() || 
                b.Abbreviation?.toLowerCase() === bookId.toLowerCase()
            );

            if (book && book.Chapters) {
                const chapter = book.Chapters[chapterNum - 1] || book.Chapters.find((c: any) => c.ID === chapterNum);
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
