import logger from '@/lib/logger';
import { pepitesStore } from '@/lib/pepitesStore';

export interface GraceAnalysisResponse {
    content: string;
    error?: string;
}

export const graceService = {
    async analyzeVerse(verse: string, reference: string, context?: string): Promise<GraceAnalysisResponse> {
        try {
            if (!verse || !verse.trim()) {
                return { content: '', error: `Verset vide pour ${reference}` };
            }
            if (!reference || !reference.trim()) {
                return { content: '', error: 'Référence manquante' };
            }
            const memoryContext = pepitesStore.load().slice(0, 5).map(p => ({
                reference: p.reference,
                text: p.text,
                type: p.type,
            }));
            const res = await fetch('/api/grace', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ verse, reference, context, memoryContext }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error || `Erreur serveur (${res.status})`);
            }
            const data = await res.json();
            if (!data || !data.content || !data.content.trim()) {
                throw new Error('Réponse vide du serveur');
            }
            return { content: data.content };
        } catch (e) {
            logger.error('[graceService] Analyse échouée:', e);
            return { content: '', error: (e as Error).message };
        }
    }
};
