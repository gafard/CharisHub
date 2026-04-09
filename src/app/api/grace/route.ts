import logger from '@/lib/logger';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `Tu es l'assistant de "CharisHub", une plateforme d'enseignement biblique centrée sur la Grâce et l'Identité du croyant en Christ.
Ta mission est d'analyser les versets bibliques fournis non pas sous un angle légaliste ou moralisateur, mais à travers le prisme de "l'œuvre achevée de Christ" (Finished Work).

Pour chaque verset ou passage :
1. RÉVÉLATION DE LA GRÂCE : Explique comment ce passage pointe vers l'amour inconditionnel de Dieu ou le sacrifice de Jésus.
2. TON IDENTITÉ : Déclare ce que ce verset dit de l'identité du croyant (ex: "Tu es saint", "Tu es juste par la foi", "Tu es un fils/une fille aimé(e)").
3. APPLICATION LIBÉRATRICE : Donne un conseil pratique qui ne repose pas sur l'effort humain mais sur la confiance en la puissance du Saint-Esprit.

Sois encourageant, profond, et utilise un ton moderne et premium. Réponds en Markdown.`;

export async function POST(req: Request) {
    try {
        const { verse, reference, context } = await req.json();

        if (!verse || !reference) {
            return NextResponse.json({ error: 'Verse and reference are required' }, { status: 400 });
        }

        // Auto-detection: prioritize openrouter if key is present but no provider set
        let provider = process.env.AI_PROVIDER;
        if (!provider) {
            if (process.env.OPENROUTER_API_KEY) provider = 'openrouter';
            else if (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY) provider = 'gemini';
            else provider = 'gemini'; // final fallback
        }

        let text = "";

        const prompt = `${SYSTEM_PROMPT}\n\nANALYSE CE VERSET : "${verse}" (${reference})\n\nContexte supplémentaire (facultatif) : ${context || 'N/A'}`;

        logger.log(`[VisionCharis] Utilisation du fournisseur : ${provider}`);

        if (provider === 'gemini') {
            const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
            if (!apiKey) {
                return NextResponse.json({
                    content: `### Vision Charis : ${reference}\n\n**Note** : Le fournisseur Gemini n'est pas configuré. Veuillez ajouter GEMINI_API_KEY.`
                });
            }

            const { GoogleGenerativeAI } = await import("@google/generative-ai");
            const genAI = new GoogleGenerativeAI(apiKey);
            
            // Re-ordered and updated list: Flash is prioritized as it's typically free-tier friendly and faster.
            const modelsToTry = [
                "gemini-1.5-flash-latest", 
                "gemini-1.5-flash",
                "gemini-pro", // classic stable name
                "gemini-1.5-pro",
                "gemini-1.5-pro-latest"
            ];
            let lastError = null;

            for (const modelName of modelsToTry) {
                try {
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const result = await model.generateContent(prompt);
                    const response = await result.response;
                    text = response.text();
                    if (text) {
                        logger.log(`[VisionCharis] Succès avec Gemini : ${modelName}`);
                        break;
                    }
                } catch (err: any) {
                    lastError = err;
                    logger.error(`[VisionCharis] Gemini Error (${modelName}):`, err.message);
                }
            }
            if (!text && lastError) throw lastError;
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
                            error: "Configuration Incomplète : OPENROUTER_API_KEY est manquante sur Vercel. Veuillez l'ajouter dans les paramètres du projet et redéployer."
                        }, { status: 500 });
                    }
                    baseURL = "https://openrouter.ai/api/v1";
                    modelName = process.env.OPENROUTER_MODEL || "google/gemini-flash-1.5-exp"; 
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
                    content: `### Vision Charis : ${reference}\n\n**Note** : Le fournisseur ${provider} n'est pas configuré. Veuillez ajouter la clé API correspondante sur Vercel.`
                });
            }

            const openaiImport = await import("openai");
            const OpenAIClass = openaiImport.default || openaiImport.OpenAI || openaiImport;
            
            const openai = new (OpenAIClass as any)({ 
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
            suggestion: "Le service d'analyse IA rencontre une difficulté technique. Veuillez réessayer."
        }, { status: 500 });
    }
}
