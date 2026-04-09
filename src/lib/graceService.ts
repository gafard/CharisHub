export interface GraceAnalysisResponse {
    content: string;
    error?: string;
}

export const graceService = {
    async analyzeVerse(verse: string, reference: string, context?: string): Promise<GraceAnalysisResponse> {
        try {
            const res = await fetch('/api/grace', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ verse, reference, context }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error || `Erreur serveur (${res.status})`);
            }
            return await res.json();
        } catch (e) {
            console.error('Grace analysis error:', e);
            return { content: '', error: (e as Error).message };
        }
    }
};
