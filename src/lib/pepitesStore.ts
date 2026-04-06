/**
 * Pepites Store — Identité & Grâce.
 * Sauvegarde les "Trésors d'Identité" (Pépites) découverts pendant la lecture.
 */

export interface Pepite {
    id: string;
    reference: string;
    text: string;
    note?: string;
    createdAt: string;
    type: 'grace' | 'identity' | 'promise';
}

const STORE_KEY = 'huios_pepites_v1';

export const pepitesStore = {
    load(): Pepite[] {
        if (typeof window === 'undefined') return [];
        try {
            const raw = localStorage.getItem(STORE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    },

    save(pepite: Omit<Pepite, 'id' | 'createdAt'>): Pepite {
        const entry: Pepite = {
            ...pepite,
            id: `pep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            createdAt: new Date().toISOString(),
        };
        const all = this.load();
        all.unshift(entry);
        localStorage.setItem(STORE_KEY, JSON.stringify(all));
        return entry;
    },

    remove(id: string) {
        const all = this.load().filter(p => p.id !== id);
        localStorage.setItem(STORE_KEY, JSON.stringify(all));
    }
};
