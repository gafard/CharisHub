import logger from '@/lib/logger';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface PrayerPromptInput {
  chapterLabel: string; // e.g. "Jean 15"
  reflectionInsights: string[]; // raw reflection answers
  passageText?: string;
  passageThemes?: string;
}

interface PrayerPromptsOutput {
    adoration: string;
    adoration_suggestions: string[];
    repentance: string;
    repentance_suggestions: string[];
    gratitude: string;
    gratitude_suggestions: string[];
    intercession: string;
    intercession_suggestions: string[];
    engagement: string;
    engagement_suggestions: string[];
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

function normalizeOutput(raw: unknown): PrayerPromptsOutput | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const fields = ['adoration', 'repentance', 'gratitude', 'intercession', 'engagement'];
    if (!fields.every((f) => typeof r[f] === 'string' && (r[f] as string).trim())) return null;

    const getSug = (f: string) => Array.isArray(r[`${f}_suggestions`]) ? r[`${f}_suggestions`] : [];

    return {
        adoration: (r.adoration as string).trim(),
        adoration_suggestions: getSug('adoration'),
        repentance: (r.repentance as string).trim(),
        repentance_suggestions: getSug('repentance'),
        gratitude: (r.gratitude as string).trim(),
        gratitude_suggestions: getSug('gratitude'),
        intercession: (r.intercession as string).trim(),
        intercession_suggestions: getSug('intercession'),
        engagement: (r.engagement as string).trim(),
        engagement_suggestions: getSug('engagement'),
    };
}

function buildPrompt(input: PrayerPromptInput): string {
  const { chapterLabel, reflectionInsights, passageText, passageThemes } = input;
  const insightLines = reflectionInsights.length > 0
    ? `Voici les réflexions personnelles du croyant :\n${reflectionInsights.map((line, i) => `${i + 1}. ${line.trim()}`).join('\n')}`
    : 'Le croyant n\'a pas laissé de notes spécifiques, base-toi uniquement sur la profondeur spirituelle du passage biblique.';

  return `Tu es un accompagnateur spirituel chrétien sur CharisHub, faisant partie de l'expérience du "Miroir de Grâce". 
Ta mission est d'aider un croyant à transformer sa lecture biblique du passage **${chapterLabel}** en un moment de prière intime et puissant (Méthode PRIAM).

Ne te présente JAMAIS comme une machine ou une IA. Tu es un frère/une sœur en Christ qui aide à la méditation.
N'utilise pas de termes comme "Analyse", "Génération", ou "Résultat". Parle d'"Écho", de "Révélation" ou d'"Éclairage".

${passageText ? `Voici le texte du passage :\n"${passageText.slice(0, 3000)}"\n` : ''}
${passageThemes ? `Thèmes principaux identifiés (Boussole) : ${passageThemes}\n` : ''}
${insightLines}

Crée 5 invitations à prier (Adoration, Repentance, Gratitude, Intercession, Engagement).
Pour chaque phase (ex: adoration), génère :
1. Une **invitation principale** (le "prompt") : 2 à 3 phrases fluides, tutoyant Dieu ou invitant au calme, rédigée à la 2e personne du pluriel ("vous").
2. Trois **suggestions courtes** (les "suggestions") : des débuts de phrases ou des élans de prière (1 phrase chacun) que le croyant peut choisir d'utiliser pour démarrer sa propre prière.

RÈGLES POUR LES SUGGESTIONS :
- Si le croyant a laissé des réflexions (notes), au moins une des suggestions DOIT être une reformulation spirituelle et profonde de sa pensée pour l'aider à la transformer en prière.
- Elles doivent être variées et s'appuyer sur le texte biblique ${chapterLabel}.
- Elles servent d'inspiration ("inspirations d'élans").
- Style : intime, sincère, profond, s'adressant à Dieu.

Réponds UNIQUEMENT avec un JSON valide :
{
  "adoration": "...",
  "adoration_suggestions": ["...", "...", "..."],
  "repentance": "...",
  "repentance_suggestions": ["...", "...", "..."],
  "gratitude": "...",
  "gratitude_suggestions": ["...", "...", "..."],
  "intercession": "...",
  "intercession_suggestions": ["...", "...", "..."],
  "engagement": "...",
  "engagement_suggestions": ["...", "...", "..."]
}`;
}

async function callGemini(prompt: string, apiKey: string): Promise<PrayerPromptsOutput> {
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
                        generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
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

async function callOpenRouter(prompt: string, apiKey: string): Promise<PrayerPromptsOutput> {
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
                    model, temperature: 0.7,
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

function fallbackPrompts(input: PrayerPromptInput): PrayerPromptsOutput {
    const label = input.chapterLabel;
    const first = input.reflectionInsights[0]?.slice(0, 60) || '';
    return {
        adoration: `À travers ${label}, Dieu vous a révélé quelque chose de Sa grandeur. Prenez un moment pour Le louer pour qui Il est.`,
        adoration_suggestions: ["Loué sois-tu pour ta majesté.", "Ton nom est grand au-dessus de tout.", "Merci pour ta présence glorieuse."],
        repentance: first
            ? `Vous avez noté : "${first}...". Apportez humblement cela à Dieu dans la repentance.`
            : `Y a-t-il quelque chose dans ${label} qui vous invite à la repentance ? Offrez-le à Dieu.`,
        repentance_suggestions: ["Pardonne mes manques d'amour.", "Je reviens vers toi de tout mon cœur.", "Éclaire mes zones d'ombre."],
        gratitude: `Remerciez Dieu pour les vérités que ${label} vous a révélées aujourd'hui.`,
        gratitude_suggestions: ["Merci pour ta grâce infinie.", "Je te rends grâce pour ta parole.", "Béni soit ton nom pour tes bienfaits."],
        intercession: `À la lumière de ${label}, priez pour quelqu'un qui a besoin de cette grâce.`,
        intercession_suggestions: ["Je te confie mes proches.", "Prie pour ceux qui souffrent.", "Interviens dans cette situation."],
        engagement: `Quelle décision concrète prendrez-vous aujourd'hui en réponse à ${label} ?`,
        engagement_suggestions: ["Je m'engage à suivre ta voix.", "Aide-moi à agir avec justice.", "Je veux vivre pour toi aujourd'hui."],
    };
}

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as PrayerPromptInput;
        if (!body.chapterLabel || !body.reflectionInsights?.length) {
            return NextResponse.json({ error: 'Paramètres manquants.' }, { status: 400 });
        }

        const prompt = buildPrompt(body);
        const provider = String(process.env.NOTEBOOK_AI_PROVIDER || 'glm_free').toLowerCase();

        if (provider === 'gemini') {
            const key = String(process.env.GEMINI_API_KEY || '').trim();
            if (key) {
                try {
                    return NextResponse.json(await callGemini(prompt, key));
                } catch { /* fallthrough */ }
            }
        }

        // Default: OpenRouter / GLM free
        const openRouterKey = String(process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '').trim();
        if (openRouterKey) {
            try {
                return NextResponse.json(await callOpenRouter(prompt, openRouterKey));
            } catch { /* fallthrough */ }
        }

        // Gemini as last resort
        const geminiKey = String(process.env.GEMINI_API_KEY || '').trim();
        if (geminiKey) {
            try {
                return NextResponse.json(await callGemini(prompt, geminiKey));
            } catch { /* fallthrough */ }
        }

        // Fallback (no API available)
        return NextResponse.json(fallbackPrompts(body));
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('[prayer-prompts] error:', message);
        return NextResponse.json({ error: compactErrorText(message) }, { status: 500 });
    }
}
