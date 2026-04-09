import logger from '@/lib/logger';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `Tu es l'assistant du "Miroir de Grâce" sur CharisHub. 
Ta mission est d'éclairer les versets bibliques à travers le prisme de "l'œuvre achevée de Christ" (Finished Work) et de l'Identité du croyant.
Ne te présente JAMAIS comme une Intelligence Artificielle (IA). Tu es un compagnon d'étude qui apporte une perspective spirituelle.
N'utilise pas de termes comme "Analyse" ou "Génération". Parle d'"Éclairage" ou de "Révélation".

Pour chaque verset ou passage :
1. RÉVÉLATION DE LA GRÂCE : Explique comment ce passage pointe vers l'amour inconditionnel de Dieu ou le sacrifice de Jésus.
2. TON IDENTITÉ : Déclare ce que ce verset dit de l'identité du croyant (ex: "Tu es saint", "Tu es juste par la foi", "Tu es un fils/une fille aimé(e)").
3. APPLICATION LIBÉRATRICE : Donne un conseil pratique qui ne repose pas sur l'effort humain mais sur la confiance en la puissance du Saint-Esprit.

Sois encourageant, profond, et utilise un ton moderne et premium. Réponds EXCLUSIVEMENT en Français en utilisant le Markdown.`;

export async function POST(req: Request) {
    try {
        const { verse, reference, context } = await req.json();

        if (!verse || !reference) {
            return NextResponse.json({ error: 'Verse and reference are required' }, { status: 400 });
        }

        // Détection de la région Vercel pour le diagnostic
        const vercelRegion = process.env.VERCEL_REGION || 'local';
        const provider = process.env.AI_PROVIDER || 'gemini';
        let text = "";

        const prompt = `${SYSTEM_PROMPT}\n\nANALYSE CE VERSET : "${verse}" (${reference})\n\nContexte supplémentaire (facultatif) : ${context || 'N/A'}`;

        logger.log(`[VisionCharis] Fournisseur: ${provider} | Région: ${vercelRegion}`);

        const tryGeminiViaOpenAI = async (apiKey: string) => {
            const { OpenAI } = await import("openai");
            const openai = new OpenAI({
                apiKey: apiKey,
                baseURL: "https://generativelanguage.googleapis.com/v1beta/",
            });

            // On essaie le modèle le plus léger et le plus disponible
            const completion = await openai.chat.completions.create({
                model: "gemini-1.5-flash",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: `ANALYSE CE VERSET : "${verse}" (${reference})\n\nContexte : ${context || 'N/A'}` }
                ],
            });
            return completion.choices[0]?.message?.content || "";
        };

        if (provider === 'gemini') {
            const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
            
            try {
                if (!geminiKey) throw new Error("GEMINI_API_KEY manquante");
                text = await tryGeminiViaOpenAI(geminiKey);
            } catch (err: any) {
                logger.error(`[VisionCharis] Échec Gemini Direct (Région: ${vercelRegion}):`, err.message);
                
                // Fallback vers OpenRouter si configuré, pour sauver l'expérience utilisateur
                if (process.env.OPENROUTER_API_KEY) {
                    logger.log("[VisionCharis] Tentative de Fallback vers OpenRouter...");
                    const { OpenAI } = await import("openai");
                    const orClient = new OpenAI({
                        apiKey: process.env.OPENROUTER_API_KEY,
                        baseURL: "https://openrouter.ai/api/v1",
                    });
                    const orCompletion = await orClient.chat.completions.create({
                        model: "openrouter/auto",
                        messages: [
                            { role: "system", content: SYSTEM_PROMPT },
                            { role: "user", content: `ANALYSE CE VERSET : "${verse}" (${reference})\n\nContexte : ${context || 'N/A'}` }
                        ],
                    });
                    text = orCompletion.choices[0]?.message?.content || "";
                } else {
                    // Si pas d'OpenRouter, on renvoie une erreur détaillée pour aider l'utilisateur
                    const isEU = ['cdg1', 'fra1', 'lhr1', 'arn1'].includes(vercelRegion);
                    const regionMsg = isEU ? `Note: Votre région Vercel (${vercelRegion}) pourrait être restreinte par Google.` : "";
                    
                    return NextResponse.json({ 
                        error: `Erreur Gemini: ${err.message}. ${regionMsg}`,
                        suggestion: "Vérifiez votre clé API ou changez la région Vercel pour 'us-east-1'."
                    }, { status: 500 });
                }
            }
        } 
        else {
            // OpenAI Compatible Providers (OpenRouter, Qwen, GLM, Kimi)
            const { OpenAI } = await import("openai");
            let apiKey = "";
            let baseURL = "";
            let modelName = "";

            switch (provider) {
                case 'openrouter':
                    apiKey = process.env.OPENROUTER_API_KEY || "";
                    if (!apiKey) {
                        return NextResponse.json({
                            error: "Configuration Incomplète : OPENROUTER_API_KEY est manquante."
                        }, { status: 500 });
                    }
                    baseURL = "https://openrouter.ai/api/v1";
                    modelName = process.env.OPENROUTER_MODEL || "openrouter/auto"; 
                    break;
                case 'qwen':
                    apiKey = process.env.QWEN_API_KEY || "";
                    baseURL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
                    modelName = "qwen-plus";
                    break;
                case 'glm':
                    apiKey = process.env.GLM_API_KEY || "";
                    baseURL = "https://open.bigmodel.cn/api/paas/v4";
                    modelName = "glm-4";
                    break;
                case 'kimi':
                    apiKey = process.env.KIMI_API_KEY || "";
                    baseURL = "https://api.moonshot.ai/v1";
                    modelName = "moonshot-v1-8k";
                    break;
            }

            if (!apiKey) {
                return NextResponse.json({
                    content: `### Vision Charis : ${reference}\n\n**Note** : Le fournisseur ${provider} n'est pas configuré.`
                });
            }

            const openai = new OpenAI({ 
                apiKey, 
                baseURL,
                defaultHeaders: provider === 'openrouter' ? {
                    "HTTP-Referer": "https://charishub.app",
                    "X-Title": "CharisHub",
                } : {}
            });

            const completion = await openai.chat.completions.create({
                model: modelName,
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: `ANALYSE CE VERSET : "${verse}" (${reference})\n\nContexte : ${context || 'N/A'}` }
                ],
                temperature: 0.7,
            });

            text = completion.choices[0]?.message?.content || "";
        }

        return NextResponse.json({ content: text });

    } catch (error: any) {
        logger.error('[VisionCharis] Erreur finale:', error);
        return NextResponse.json({ 
            error: error.message,
            suggestion: "Veuillez réessayer dans quelques instants."
        }, { status: 500 });
    }
}
