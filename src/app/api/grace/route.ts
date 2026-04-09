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

        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

        if (!apiKey) {
            return NextResponse.json({
                content: `### Vision Charis : ${reference}\n\n**Révélation de la Grâce** : Ce verset souligne la bonté infinie du Père. Même si aucune clé IA n'est configurée, la vérité reste : vous êtes aimé sans condition.\n\n**Ton Identité** : En Christ, vous êtes une nouvelle création. Vos erreurs passées sont effacées par Sa Lumière.\n\n**Application** : Repose-toi aujourd'hui dans Sa victoire plutôt que dans tes efforts.`
            });
        }

        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(apiKey);
        
        // Liste des modèles à essayer par ordre de priorité
        const modelsToTry = ["gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-1.5-pro"];
        let lastError = null;
        let text = "";

        const prompt = `${SYSTEM_PROMPT}\n\nANALYSE CE VERSET : "${verse}" (${reference})\n\nContexte supplémentaire (facultatif) : ${context || 'N/A'}`;

        for (const modelName of modelsToTry) {
            try {
                logger.log(`[VisionCharis] Tentative avec le modèle : ${modelName}`);
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent(prompt);
                const response = await result.response;
                text = response.text();
                
                if (text) {
                    logger.log(`[VisionCharis] Succès avec le modèle : ${modelName}`);
                    break; 
                }
            } catch (err: any) {
                lastError = err;
                logger.error(`[VisionCharis] Échec avec le modèle ${modelName}:`, err.message);
                // Continuer vers le prochain modèle
            }
        }

        if (!text && lastError) {
            throw lastError;
        }

        return NextResponse.json({ content: text });

    } catch (error: any) {
        logger.error('[VisionCharis] Erreur finale:', error);
        return NextResponse.json({ 
            error: error.message,
            suggestion: "Le service d'analyse IA rencontre une difficulté technique. Veuillez réessayer dans quelques instants."
        }, { status: 500 });
    }
}
