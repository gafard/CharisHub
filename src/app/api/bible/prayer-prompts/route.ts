import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface PrayerPromptInput {
    chapterLabel: string; // e.g. "Jean 15"
    reflectionInsights: string[]; // raw reflection answers
    passageThemes?: string;
}

interface PrayerPromptsOutput {
    adoration: string;
    repentance: string;
    gratitude: string;
    intercession: string;
    engagement: string;
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
    return {
        adoration: (r.adoration as string).trim(),
        repentance: (r.repentance as string).trim(),
        gratitude: (r.gratitude as string).trim(),
        intercession: (r.intercession as string).trim(),
        engagement: (r.engagement as string).trim(),
    };
}

function buildPrompt(input: PrayerPromptInput): string {
    const { chapterLabel, reflectionInsights, passageThemes } = input;
    const insightLines = reflectionInsights
        .map((line, i) => `${i + 1}. ${line.trim()}`)
        .join('\n');

    return `Tu es un accompagnateur spirituel chrétien évangélique. 
Un croyant vient de lire et méditer le passage biblique : **${chapterLabel}**.
${passageThemes ? `\nThèmes du passage : ${passageThemes}` : ''}

Voici ses réponses brutes aux questions de réflexion :
${insightLines}

Ta mission : Reformule ces réponses brutes en **invitations à prier** courtes, personnelles et spirituellement profondes, pour chacun des 5 moments de prière PRIAM. Chaque invitation doit :
- Partir de ce que le croyant a ressenti ou compris dans le passage
- Être rédigée à la 2e personne (tutoiement ou vouvoiement, utilise "vous")
- Être une invitation concrète à entrer dans ce type de prière
- Faire entre 2 et 4 phrases maximum
- Ne pas répéter mot pour mot les réflexions brutes
- Être écrite en français soutenu mais accessible

Types de prière :
- **adoration** : Louer Dieu pour ce que le passage révèle de Sa nature
- **repentance** : S'il y a une prise de conscience de faiblesse ou de péché, l'apporter à Dieu
- **gratitude** : Remercier Dieu pour ce passage ou une grâce reçue
- **intercession** : Prier pour quelqu'un ou une situation inspirée par le passage
- **engagement** : Prendre un engagement spirituel concret lié au passage

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide, sans markdown autour, exactement :
{
  "adoration": "...",
  "repentance": "...",
  "gratitude": "...",
  "intercession": "...",
  "engagement": "..."
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
        repentance: first
            ? `Vous avez noté : "${first}...". Apportez humblement cela à Dieu dans la repentance.`
            : `Y a-t-il quelque chose dans ${label} qui vous invite à la repentance ? Offrez-le à Dieu.`,
        gratitude: `Remerciez Dieu pour les vérités que ${label} vous a révélées aujourd'hui.`,
        intercession: `À la lumière de ${label}, priez pour quelqu'un qui a besoin de cette grâce.`,
        engagement: `Quelle décision concrète prendrez-vous aujourd'hui en réponse à ${label} ?`,
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
        console.error('[prayer-prompts] error:', message);
        return NextResponse.json({ error: compactErrorText(message) }, { status: 500 });
    }
}
