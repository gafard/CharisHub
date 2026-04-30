import logger from '@/lib/logger';
import { checkRateLimit } from '@/lib/rateLimit';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface ReflectionQuestionsInput {
  bookName: string;
  chapter: number;
  passageText?: string;
  passageThemes?: string;
  planId?: string;
  planCategory?: string;
}

interface ReflectionQuestionsOutput {
  q1: string;
  q1_suggestions: string[];
  q2: string;
  q2_suggestions: string[];
  q3: string;
  q3_suggestions: string[];
  q4: string;
  q4_suggestions: string[];
}

function ensureStringArray(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeOutput(raw: unknown): ReflectionQuestionsOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  
  const getQ = (key: string): string => {
    const val = r[key];
    if (typeof val === 'string' && val.trim()) return val.trim();
    // Fallback aux questions par défaut si une clé spécifique manque
    const def = (DEFAULT_QUESTIONS as Record<string, any>)[key];
    return typeof def === 'string' ? def : '';
  };

  return {
    q1: getQ('q1'),
    q1_suggestions: ensureStringArray(r.q1_suggestions).slice(0, 3),
    q2: getQ('q2'),
    q2_suggestions: ensureStringArray(r.q2_suggestions).slice(0, 3),
    q3: getQ('q3'),
    q3_suggestions: ensureStringArray(r.q3_suggestions).slice(0, 3),
    q4: getQ('q4'),
    q4_suggestions: ensureStringArray(r.q4_suggestions).slice(0, 3),
  };
}

/**
 * Questions de réflexion statiques par défaut (même logique pour tous les passages).
 * L'IA les adapte au passage lu quand elle est disponible.
 */
const DEFAULT_QUESTIONS: ReflectionQuestionsOutput = {
  q1: 'Que révèle ce chapitre sur Dieu ou sur Jésus ?',
  q1_suggestions: [],
  q2: "Qu'est-ce qui me frappe, me dérange ou m'éclaire ici ?",
  q2_suggestions: [],
  q3: "Y a-t-il un appel concret pour ma vie aujourd'hui ?",
  q3_suggestions: [],
  q4: 'Quelle vérité dois-je retenir ou méditer davantage ?',
  q4_suggestions: [],
};

function buildPrompt(input: ReflectionQuestionsInput): string {
  const { bookName, chapter, passageText, passageThemes, planCategory } = input;
  const label = `${bookName} ${chapter}`;

  const categoryContext = planCategory ? (() => {
    switch (planCategory) {
      case 'commencer': return 'Ce parcours est destiné à ceux qui commencent ou redécouvrent la foi. Les questions doivent être accessibles et centrées sur la rencontre avec Christ.';
      case 'priere': return 'Ce parcours est axé sur la prière et le combat spirituel. Les questions doivent orienter vers l\'intimité avec Dieu et l\'intercession.';
      case 'croissance': return 'Ce parcours vise la croissance intérieure et l\'approfondissement doctrinal. Les questions peuvent être plus approfondies théologiquement.';
      case 'relations': return 'Ce parcours concerne les relations humaines et la vie communautaire. Les questions doivent lier le texte aux relations concrètes.';
      case 'panorama': return 'Ce parcours donne une vue d\'ensemble d\'un livre ou d\'un ensemble biblique. Les questions doivent aider à saisir la structure et le fil conducteur.';
      case 'saisonnier': return 'Ce parcours est lié à un temps liturgique ou saisonnier. Les questions doivent résonner avec le temps spirituel traversé.';
      default: return '';
    }
  })() : '';

  return `Tu es un accompagnateur spirituel chrétien, formé à l'herméneutique biblique et à l'accompagnement pastoral.
Ta mission est d'adapter 4 questions de réflexion personnelle au passage biblique que le croyant vient de lire, ET de proposer pour chaque question 3 suggestions de réponses très courtes (chips).

Passage: **${label}**
${passageText ? `\nTexte du passage:\n"${passageText.slice(0, 4000)}"\n` : ''}
${passageThemes ? `\nThèmes identifiés dans ce passage: ${passageThemes}\n` : ''}
${categoryContext ? `\nContexte du plan: ${categoryContext}\n` : ''}

Les 4 questions doivent suivre CETTE LOGIQUE:
1. **q1** (focus sur DIEU): Que révèle ce texte sur Dieu/Jésus?
2. **q2** (focus sur L'IMPACT): Qu'est-ce qui me frappe ou m'éclaire?
3. **q3** (focus sur L'ACTION): Quel pas de foi pour aujourd'hui?
4. **q4** (focus sur LA VÉRITÉ): Quelle promesse ou vérité retenir?

Pour CHAQUE question (q1, q2, q3, q4), propose aussi un tableau de **3 suggestions de réponses** nommés q1_suggestions, q2_suggestions, etc.
Les suggestions doivent être:
- Très courtes (2 à 8 mots)
- Écrites à la première personne ("Je...", "Seigneur, je...")
- Directement liées au texte de ${label}

RÈGLES STRICTES:
- Réponds UNIQUEMENT avec un JSON valide.
- Ne rajoute aucun texte avant ou après le JSON.
- Respecte exactement cette structure:
{
  "q1": "Une question profonde sur Dieu...",
  "q1_suggestions": ["Suggestion 1", "Suggestion 2", "Suggestion 3"],
  "q2": "Une question sur le ressenti...",
  "q2_suggestions": ["...", "...", "..."],
  "q3": "Une question sur l'action...",
  "q3_suggestions": ["...", "...", "..."],
  "q4": "Une question sur la vérité...",
  "q4_suggestions": ["...", "...", "..."]
}`;
}

async function callGemini(prompt: string, apiKey: string): Promise<ReflectionQuestionsOutput> {
  const models = (process.env.GEMINI_SUMMARY_MODELS || 'gemini-2.0-flash-lite,gemini-2.0-flash').split(',').map((m) => m.trim()).filter(Boolean);
  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
          }),
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const text = String(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
      const parsed = normalizeOutput(extractJsonObject(text));
      if (parsed) return parsed;
    } catch { /* try next */ }
  }
  throw new Error('Gemini unavailable');
}

async function callOpenRouter(prompt: string, apiKey: string): Promise<ReflectionQuestionsOutput> {
  const models = (process.env.OPENROUTER_PRAYER_MODELS || 'z-ai/glm-4.5-air:free,qwen/qwen3-30b-a3b:free').split(',').map((m) => m.trim()).filter(Boolean);
  const endpoint = (process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  for (const model of models) {
    try {
      const res = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model, temperature: 0.6,
          messages: [
            { role: 'system', content: 'Tu es un accompagnateur spirituel chrétien. Réponds uniquement en JSON valide.' },
            { role: 'user', content: prompt },
          ],
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = String(data?.choices?.[0]?.message?.content ?? '');
      const parsed = normalizeOutput(extractJsonObject(text));
      if (parsed) return parsed;
    } catch { /* try next */ }
  }
  throw new Error('OpenRouter unavailable');
}

export async function POST(req: Request) {
  try {
    const rateLimit = checkRateLimit(req, {
      keyPrefix: 'api:reflection-questions',
      limit: Number(process.env.AI_RATE_LIMIT_PER_WINDOW || 30),
      windowMs: 10 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Trop de requêtes. Veuillez réessayer dans quelques instants.' },
        { status: 429, headers: rateLimit.headers }
      );
    }

    const body = (await req.json()) as ReflectionQuestionsInput;
    if (!body.bookName || !body.chapter) {
      return NextResponse.json({ error: 'Paramètres manquants.' }, { status: 400 });
    }

    const prompt = buildPrompt(body);
    const provider = String(process.env.NOTEBOOK_AI_PROVIDER || 'glm_free').toLowerCase();

    // Essayer le provider configuré
    if (provider === 'gemini') {
      const key = String(process.env.GEMINI_API_KEY || '').trim();
      if (key) {
        try {
          const result = await callGemini(prompt, key);
          return NextResponse.json(result);
        } catch { /* fallthrough */ }
      }
    }

    // OpenRouter / GLM free
    const openRouterKey = String(process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '').trim();
    if (openRouterKey) {
      try {
        const result = await callOpenRouter(prompt, openRouterKey);
        return NextResponse.json(result);
      } catch { /* fallthrough */ }
    }

    // Gemini en dernier recours
    const geminiKey = String(process.env.GEMINI_API_KEY || '').trim();
    if (geminiKey) {
      try {
        const result = await callGemini(prompt, geminiKey);
        return NextResponse.json(result);
      } catch { /* fallthrough */ }
    }

    // Fallback: questions statiques par défaut
    return NextResponse.json(DEFAULT_QUESTIONS);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[reflection-questions] error:', message);
    return NextResponse.json({ error: compactErrorText(message) }, { status: 500 });
  }
}

function compactErrorText(value: string, max = 300): string {
  const s = value.replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max)}...` : s;
}

function extractJsonObject(raw: string): unknown | null {
  const trimmed = raw.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  for (const candidate of [trimmed, withoutFence]) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* ignore */
    }
    const s = candidate.indexOf('{');
    const e = candidate.lastIndexOf('}');
    if (s !== -1 && e > s) {
      try {
        return JSON.parse(candidate.slice(s, e + 1));
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}
