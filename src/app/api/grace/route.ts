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

        const apiKey = process.env.OPENAI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

        if (!apiKey) {
            // Fallback pour la démo si aucune clé n'est configurée
            return NextResponse.json({
                content: `### Vision Charis : ${reference}\n\n**Révélation de la Grâce** : Ce verset souligne la bonté infinie du Père. Même si aucune clé IA n'est configurée, la vérité reste : vous êtes aimé sans condition.\n\n**Ton Identité** : En Christ, vous êtes une nouvelle création. Vos erreurs passées sont effacées par Sa Lumière.\n\n**Application** : Repose-toi aujourd'hui dans Sa victoire plutôt que dans tes efforts.`
            });
        }

        // Ici, on pourrait implémenter l'appel réel à OpenAI ou Gemini.
        // Pour cet exemple, je fournis une structure robuste.
        
        // Exemple simplifié d'appel (simulation pour la structure)
        /*
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: `Analyse ce verset : "${verse}" (${reference})` }
                ]
            })
        });
        const data = await response.json();
        return NextResponse.json({ content: data.choices[0].message.content });
        */

        // Fallback simulateur intelligent (en attendant la config réelle)
        return NextResponse.json({
            content: `### Vision Charis : ${reference}\n\n**Révélation de la Grâce** : À travers "${verse}", nous voyons que Dieu prend l'initiative de la relation. Ce n'est pas ton obéissance qui produit Sa faveur, c'est Sa faveur qui produit ton obéissance.\n\n**Ton Identité** : Tu n'es plus un esclave du doute, mais un héritier du Royaume. Ce verset confirme que ta position est scellée en Lui.\n\n**Application** : Aujourd'hui, marche avec la tête haute, non par orgueil, mais par gratitude pour ce qu'Il a fait en toi.`
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
