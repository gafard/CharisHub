import { checkRateLimit } from '@/lib/rateLimit';
import logger from '@/lib/logger';
import { BIBLE_BOOKS } from '@/lib/bibleCatalog';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface GeneratePlanRequest {
  theme: string;           // ex: "identité en Christ", "Psaumes de louange"
  durationDays: number;   // 7 | 14 | 21 | 30 | 40 | 60 | 90
  chaptersPerDay: number; // 1 | 2 | 3
  testament?: 'AT' | 'NT' | 'both';
}

interface GeneratedDay {
  note?: string;
  readings: {
    bookId: string;
    bookName: string;
    chapters: number[];
  }[];
}

interface GeneratedPlan {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: string;
  days: GeneratedDay[];
}

// Catalogue simplifié fourni à l'IA pour qu'elle choisisse les bons livres
function buildBookSummary(testament?: 'AT' | 'NT' | 'both'): string {
  return BIBLE_BOOKS
    .filter(b => {
      if (!testament || testament === 'both') return true;
      if (testament === 'NT') return b.testament === 'NT';
      if (testament === 'AT') return b.testament === 'OT';
      return true;
    })
    .map(b => `${b.id}|${b.name}|${b.chapters}ch`)
    .join(', ');
}

function buildPrompt(req: GeneratePlanRequest): string {
  const books = buildBookSummary(req.testament);
  return `Tu es un éditeur spirituel chrétien sur CharisHub. Génère un plan de lecture biblique personnalisé en français.

Thème demandé: "${req.theme}"
Durée: ${req.durationDays} jours
Chapitres par jour: ${req.chaptersPerDay}
Testament: ${req.testament || 'both'}

Catalogue des livres disponibles (format: id|nom|chapitres):
${books}

RÈGLES IMPORTANTES:
1. Choisis des livres bibliques pertinents pour le thème
2. Chaque jour contient exactement ${req.chaptersPerDay} chapitre(s) par lecture principale
3. Les chapitres doivent être séquentiels dans chaque livre (pas de sauts aléatoires)
4. Le plan doit couvrir exactement ${req.durationDays} jours
5. Génère une note courte (max 80 chars) pour chaque jour si possible
6. Le plan doit être spirituellement cohérent et progressif

Réponds UNIQUEMENT avec ce JSON:
{
  "name": "Titre court du plan",
  "description": "1-2 phrases décrivant ce plan",
  "emoji": "emoji approprié",
  "category": "commencer|priere|croissance|relations|panorama|saisonnier",
  "days": [
    {
      "note": "Note d'introduction courte (optionnel)",
      "readings": [
        { "bookId": "id_du_livre", "bookName": "Nom du livre", "chapters": [1] }
      ]
    }
  ]
}`;
}

function extractJson(raw: string): unknown | null {
  const clean = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  for (const s of [clean, raw.trim()]) {
    try { return JSON.parse(s); } catch { /* next */ }
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a !== -1 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch { /* next */ } }
  }
  return null;
}

function validatePlan(data: unknown, expected: GeneratePlanRequest): GeneratedPlan | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.name !== 'string' || !Array.isArray(d.days)) return null;
  if (d.days.length < Math.floor(expected.durationDays * 0.8)) return null; // tolérance 20%

  return {
    id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: String(d.name).slice(0, 80),
    description: String(d.description || '').slice(0, 200),
    emoji: String(d.emoji || '📖'),
    category: String(d.category || 'croissance'),
    days: (d.days as unknown[]).map((day: unknown) => {
      const dy = day as Record<string, unknown>;
      return {
        note: dy.note ? String(dy.note).slice(0, 100) : undefined,
        readings: Array.isArray(dy.readings)
          ? (dy.readings as unknown[]).map((r: unknown) => {
              const rd = r as Record<string, unknown>;
              return {
                bookId: String(rd.bookId || ''),
                bookName: String(rd.bookName || ''),
                chapters: Array.isArray(rd.chapters) ? (rd.chapters as number[]).slice(0, 10) : [1],
              };
            })
          : [],
      };
    }),
  };
}

async function callGemini(prompt: string, apiKey: string): Promise<GeneratedPlan> {
  const models = (process.env.GEMINI_SUMMARY_MODELS || 'gemini-2.0-flash,gemini-2.0-flash-lite')
    .split(',').map(m => m.trim()).filter(Boolean);

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.6, maxOutputTokens: 8192 },
          }),
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const text = String(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
      const parsed = validatePlan(extractJson(text), { theme: '', durationDays: 1, chaptersPerDay: 1 });
      if (parsed) return parsed;
    } catch { /* try next */ }
  }
  throw new Error('Gemini unavailable');
}

async function callOpenRouter(prompt: string, apiKey: string, req: GeneratePlanRequest): Promise<GeneratedPlan> {
  const models = (process.env.OPENROUTER_PRAYER_MODELS || 'qwen/qwen3-30b-a3b:free,z-ai/glm-4.5-air:free')
    .split(',').map(m => m.trim()).filter(Boolean);
  const endpoint = (process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');

  for (const model of models) {
    try {
      const res = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model, temperature: 0.6,
          messages: [
            { role: 'system', content: 'Tu es un éditeur spirituel chrétien. Réponds uniquement en JSON valide.' },
            { role: 'user', content: prompt },
          ],
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = String(data?.choices?.[0]?.message?.content ?? '');
      const parsed = validatePlan(extractJson(text), req);
      if (parsed) return parsed;
    } catch { /* try next */ }
  }
  throw new Error('OpenRouter unavailable');
}

export async function POST(request: Request) {
  try {
    const rateLimit = checkRateLimit(request, {
      keyPrefix: 'api:generate-plan',
      limit: 10, // plan generation is expensive
      windowMs: 60 * 60 * 1000, // 10 per hour
    });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Limite atteinte. Réessaie dans une heure.' }, { status: 429, headers: rateLimit.headers });
    }

    const body = (await request.json()) as GeneratePlanRequest;
    if (!body.theme?.trim() || !body.durationDays || !body.chaptersPerDay) {
      return NextResponse.json({ error: 'Paramètres manquants.' }, { status: 400 });
    }

    // Clamp values
    body.durationDays = Math.min(Math.max(body.durationDays, 7), 90);
    body.chaptersPerDay = Math.min(Math.max(body.chaptersPerDay, 1), 5);

    const prompt = buildPrompt(body);
    const geminiKey = String(process.env.GEMINI_API_KEY || '').trim();
    const openRouterKey = String(process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '').trim();

    if (geminiKey) {
      try { return NextResponse.json(await callGemini(prompt, geminiKey)); } catch { /* fallthrough */ }
    }
    if (openRouterKey) {
      try { return NextResponse.json(await callOpenRouter(prompt, openRouterKey, body)); } catch { /* fallthrough */ }
    }
    if (geminiKey) {
      try { return NextResponse.json(await callGemini(prompt, geminiKey)); } catch { /* fallthrough */ }
    }

    return NextResponse.json({ error: 'Vision Charis est momentanément indisponible.' }, { status: 503 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[generate-plan] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
