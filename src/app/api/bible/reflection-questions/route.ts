import logger from '@/lib/logger';
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
  q2: string;
  q3: string;
  q4: string;
}

function compactErrorText(value: string, max = 300): string {
  const s = value.replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max)}...` : s;
}

function extractJsonObject(raw: string): unknown | null {
  const trimmed = raw.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  for (const candidate of [trimmed, withoutFence]) {
    try { return JSON.parse(candidate); } catch { /* ignore */ }
    const s = candidate.indexOf('{');
    const e = candidate.lastIndexOf('}');
    if (s !== -1 && e > s) {
      try { return JSON.parse(candidate.slice(s, e + 1)); } catch { /* ignore */ }
    }
  }
  return null;
}

function normalizeOutput(raw: unknown): ReflectionQuestionsOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const fields = ['q1', 'q2', 'q3', 'q4'];
  if (!fields.every((f) => typeof r[f] === 'string' && (r[f] as string).trim())) return null;
  return {
    q1: (r.q1 as string).trim(),
    q2: (r.q2 as string).trim(),
    q3: (r.q3 as string).trim(),
    q4: (r.q4 as string).trim(),
  };
}

/**
 * Questions de réflexion statiques par défaut (même logique pour tous les passages).
 * L'IA les adapte au passage lu quand elle est disponible.
 */
const DEFAULT_QUESTIONS: ReflectionQuestionsOutput = {
  q1: 'Que révèle ce chapitre sur Dieu ou sur Jésus ?',
  q2: 'Qu\'est-ce qui me frappe, me dérange ou m\'éclaire ici ?',
  q3: 'Y a-t-il un appel concret pour ma vie aujourd\'hui ?',
  q4: 'Quelle vérité dois-je retenir ou méditer davantage ?',
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
Ta mission est d'adapter 4 questions de réflexion personnelle au passage biblique que le croyant vient de lire.

Passage: **${label}**
${passageText ? `\nTexte du passage:\n"${passageText.slice(0, 4000)}"\n` : ''}
${passageThemes ? `\nThèmes identifiés dans ce passage: ${passageThemes}\n` : ''}
${categoryContext ? `\nContexte du plan: ${categoryContext}\n` : ''}

Les 4 questions doivent suivre CETTE LOGIQUE (toujours la même structure, mais adaptée au passage):

1. **q1** (focus sur DIEU): Que révèle ce passage sur le caractère, la nature ou l'action de Dieu/Jésus? 
   → Adapter: mentionner un attribut de Dieu visible dans le texte (ex: sa fidélité, sa grâce, sa puissance, son amour)

2. **q2** (focus sur L'IMPACT PERSONNEL): Qu'est-ce qui me frappe, me dérange, me console ou m'éclaire dans ce texte?
   → Adapter: pointer un verset, une image ou un contraste du passage qui interpelle directement

3. **q3** (focus sur L'ACTION CONCRÈTE): Y a-t-il un appel, un changement ou un pas de foi pour ma vie aujourd'hui?
   → Adapter: relier à un commandement, un exemple ou une exhortation du texte

4. **q4** (focus sur LA VÉRITÉ À RETENIR): Quelle vérité, promesse ou assurance dois-je retenir et méditer?
   → Adapter: extraire une promesse, un principe ou une vérité centrale du passage

RÈGLES STRICTES:
- Chaque question doit faire 1 à 2 phrases maximum
- Garder le ton bienveillant, pastoral et centré sur la grâce
- NE PAS poser de questions théoriques ou académiques — toujours orienté vers la vie avec Dieu
- NE PAS moraliser ni culpabiliser — pointer vers Christ et Sa grâce
- Rédiger en français, à la 2e personne du singulier ("tu") ou forme impersonnelle
- Les questions doivent être PROFONDES mais ACCESSIBLES

Réponds UNIQUEMENT avec un JSON valide:
{
  "q1": "...",
  "q2": "...",
  "q3": "...",
  "q4": "..."
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
