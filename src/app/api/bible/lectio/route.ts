import { checkRateLimit } from '@/lib/rateLimit';
import logger from '@/lib/logger';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type LectioStep = 'meditatio' | 'oratio';

interface LectioRequest {
  reference: string;
  verseText: string;
  step: LectioStep;
}

interface MeditatioOutput {
  questions: string[];
}

interface OratioOutput {
  invitation: string;
  starter: string;
}

type LectioOutput = MeditatioOutput | OratioOutput;

function extractJson(raw: string): unknown | null {
  const clean = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  for (const s of [clean, raw.trim()]) {
    try { return JSON.parse(s); } catch { /* next */ }
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a !== -1 && b > a) {
      try { return JSON.parse(s.slice(a, b + 1)); } catch { /* next */ }
    }
    // Try array
    const aa = s.indexOf('['), bb = s.lastIndexOf(']');
    if (aa !== -1 && bb > aa) {
      try { return JSON.parse(s.slice(aa, bb + 1)); } catch { /* next */ }
    }
  }
  return null;
}

function buildMeditatioPrompt(reference: string, verseText: string): string {
  return `Tu es un accompagnateur spirituel expert en Lectio Divina. Ta mission est d'aider un croyant à plonger profondément dans la Parole de Dieu.

Passage : **${reference}**
Texte : « ${verseText} »

Génère EXACTEMENT 3 questions de méditation (Meditatio) puissantes et ancrées dans la foi chrétienne. 
Règles strictes pour les questions :
1. Elles DOIVENT être directement liées aux mots, aux actions ou au thème central du texte biblique cité.
2. Elles DOIVENT pousser le croyant à réfléchir à sa relation avec Jésus-Christ, sa foi, ou sa transformation spirituelle (ex: guérison, repentance, grâce).
3. Elles DOIVENT interpeller le cœur ("Qu'est-ce que le Saint-Esprit te murmure...") plutôt que l'intellect.
4. Elles doivent être formulées avec bienveillance, à la 2ème personne du singulier ("tu").
5. Évite absolument les questions génériques (ex: "Comment ce texte résonne en toi ?"). Sois ultra-spécifique au passage !

Réponds UNIQUEMENT avec un objet JSON valide (pas de Markdown autour si possible) :
{"questions": ["question 1", "question 2", "question 3"]}`;
}

function buildOratioPrompt(reference: string, verseText: string): string {
  return `Tu es un accompagnateur spirituel expert en Lectio Divina. Ta mission est d'aider un croyant à répondre à Dieu (Oratio) en prière, en s'appuyant sur la Parole qu'il vient de lire.

Passage : **${reference}**
Texte : « ${verseText} »

Génère une invitation à la prière (Oratio) comprenant :
- "invitation": Une courte phrase inspirée du texte pour inviter l'utilisateur à s'adresser à Dieu avec confiance (ex: "Dieu t'a parlé à travers ce passage, réponds-lui maintenant...").
- "starter": Le début d'une prière personnelle profonde et authentique, viscéralement liée au verset. (1 à 2 phrases commençant par "Père...", "Seigneur Jésus..." ou "Saint-Esprit...").

Règles : Sois profondément spirituel, intime, et focalisé sur la grâce et l'amour de Dieu.
Réponds UNIQUEMENT avec un objet JSON valide :
{"invitation": "...", "starter": "..."}`;
}

async function callGemini(prompt: string, apiKey: string): Promise<LectioOutput> {
  const models = (process.env.GEMINI_SUMMARY_MODELS || 'gemini-2.0-flash-lite,gemini-2.0-flash')
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
            generationConfig: { responseMimeType: 'application/json', temperature: 0.8 },
          }),
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const text = String(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
      const parsed = extractJson(text);
      if (parsed) return parsed as LectioOutput;
    } catch { /* try next */ }
  }
  throw new Error('Gemini unavailable');
}

async function callOpenRouter(prompt: string, apiKey: string): Promise<LectioOutput> {
  const models = (process.env.OPENROUTER_PRAYER_MODELS || 'z-ai/glm-4.5-air:free,qwen/qwen3-30b-a3b:free')
    .split(',').map(m => m.trim()).filter(Boolean);
  const endpoint = (process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');

  for (const model of models) {
    try {
      const res = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model, temperature: 0.8,
          messages: [
            { role: 'system', content: 'Tu es un accompagnateur spirituel chrétien. Réponds uniquement en JSON valide.' },
            { role: 'user', content: prompt },
          ],
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = String(data?.choices?.[0]?.message?.content ?? '');
      const parsed = extractJson(text);
      if (parsed) return parsed as LectioOutput;
    } catch { /* try next */ }
  }
  throw new Error('OpenRouter unavailable');
}

function fallbackOutput(step: LectioStep, reference: string): LectioOutput {
  if (step === 'meditatio') {
    return {
      questions: [
        `Quel mot ou quelle phrase de ${reference} attire particulièrement ton attention aujourd'hui ? Pourquoi ?`,
        `Que te dit Dieu personnellement à travers ce texte en ce moment de ta vie ?`,
        `Quelle vérité sur ton identité en Christ ce passage te révèle-t-il ?`,
      ],
    };
  }
  return {
    invitation: `Laisse ce que tu as reçu de ${reference} se transformer en conversation avec ton Père. Il t'écoute avec amour.`,
    starter: `Seigneur, merci pour ce que tu m'as dit aujourd'hui à travers ta Parole. Je te présente ce qui a touché mon cœur...`,
  };
}

export async function POST(req: Request) {
  try {
    const rateLimit = checkRateLimit(req, {
      keyPrefix: 'api:lectio',
      limit: Number(process.env.AI_RATE_LIMIT_PER_WINDOW || 30),
      windowMs: 10 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Trop de requêtes. Réessaie dans quelques instants.' }, { status: 429, headers: rateLimit.headers });
    }

    const body = (await req.json()) as LectioRequest;
    if (!body.reference || !body.verseText || !body.step) {
      return NextResponse.json({ error: 'Paramètres manquants.' }, { status: 400 });
    }

    const prompt = body.step === 'meditatio'
      ? buildMeditatioPrompt(body.reference, body.verseText)
      : buildOratioPrompt(body.reference, body.verseText);

    const geminiKey = String(process.env.GEMINI_API_KEY || '').trim();
    const openRouterKey = String(process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '').trim();

    if (geminiKey) {
      try { return NextResponse.json(await callGemini(prompt, geminiKey)); } catch { /* fallthrough */ }
    }
    if (openRouterKey) {
      try { return NextResponse.json(await callOpenRouter(prompt, openRouterKey)); } catch { /* fallthrough */ }
    }
    if (geminiKey) {
      try { return NextResponse.json(await callGemini(prompt, geminiKey)); } catch { /* fallthrough */ }
    }

    return NextResponse.json(fallbackOutput(body.step, body.reference));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[lectio] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
