/**
 * Prayer Flow Store — localStorage-based storage for guided prayer sessions.
 *
 * Saves completed prayer flow sessions (after Bible reading reflection)
 * so we can show daily recaps and track spiritual engagement.
 */

import type { PlanReading } from './readingPlanCatalog';
import { formatDayReadingsLabel } from './readingPlans';

const STORE_KEY = 'formation_biblique_prayer_flow_v1';

export interface PrayerFlowStep {
    type: 'adoration' | 'repentance' | 'gratitude' | 'intercession' | 'engagement';
    emoji: string;
    label: string;
    prompt: string;
    userNote: string;
    completed: boolean;
    durationSec: number;
}

export interface PrayerFlowSession {
    id: string;
    date: string; // ISO
    planId: string;
    dayIndex: number;
    readings: PlanReading[];
    readingSummary: string;
    bookName?: string;
    chapters?: number[];
    steps: PrayerFlowStep[];
    totalDurationSec: number;
}

function makeId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `pf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function load(): PrayerFlowSession[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORE_KEY);
        return raw ? (JSON.parse(raw) as PrayerFlowSession[]) : [];
    } catch {
        return [];
    }
}

function save(sessions: PrayerFlowSession[]) {
    if (typeof window === 'undefined') return;
    // Keep max 60 sessions to avoid bloating localStorage
    const trimmed = sessions.slice(0, 60);
    localStorage.setItem(STORE_KEY, JSON.stringify(trimmed));
}

import { syncLocalToCloud, exportAllLocalData } from './cloudSync';

export function savePrayerFlowSession(
    session: Omit<PrayerFlowSession, 'id' | 'date'>
): PrayerFlowSession {
    const entry: PrayerFlowSession = {
        ...session,
        id: makeId(),
        date: new Date().toISOString(),
    };
    const sessions = load();
    sessions.unshift(entry);
    save(sessions);
    
    // Synchroniser vers le cloud en arrière-plan
    try {
        const fullData = exportAllLocalData();
        void syncLocalToCloud({
            highlights: Object.entries(fullData.highlights).map(([id, h]: any) => ({ ...h, id })),
            notes: Object.entries(fullData.notes).map(([id, n]: any) => ({ note: n, id })),
            bookmarks: fullData.bookmarks.map(id => ({ id })),
            pepites: fullData.pepites.map(p => ({ ...p, pepite_type: p.type })),
            readingProgress: [],
            reflections: [],
            streak: {
                current_streak: fullData.readingStreak.current,
                best_streak: fullData.readingStreak.best,
                last_read_date: fullData.readingStreak.lastReadDate,
                total_chapters: fullData.readingStreak.totalChapters
            },
            prayerSessions: sessions.map(s => ({
                id: s.id,
                session_date: s.date,
                plan_id: s.planId,
                day_index: s.dayIndex,
                reading_summary: getSessionReadingSummary(s),
                total_duration_sec: s.totalDurationSec
            })),
            prayerJournal: fullData.prayerJournal
        } as any);
    } catch (e) {
        // Ignore
    }

    return entry;
}

export function getTodaysSessions(): PrayerFlowSession[] {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return load().filter((s) => s.date.startsWith(today));
}

export function getAllSessions(): PrayerFlowSession[] {
    return load();
}

export interface DailyRecap {
    chaptersRead: string[];
    totalPrayerTimeSec: number;
    engagements: string[];
    completedSteps: number;
    totalSteps: number;
    sessionsCount: number;
}

export function getDailyRecap(): DailyRecap | null {
    const sessions = getTodaysSessions();
    if (sessions.length === 0) return null;

    const chaptersRead: string[] = [];
    let totalPrayerTimeSec = 0;
    const engagements: string[] = [];
    let completedSteps = 0;
    let totalSteps = 0;

    for (const session of sessions) {
        const label = getSessionReadingSummary(session);
        if (!chaptersRead.includes(label)) chaptersRead.push(label);

        totalPrayerTimeSec += session.totalDurationSec;

        for (const step of session.steps) {
            totalSteps++;
            if (step.completed) completedSteps++;
            if (step.type === 'engagement' && step.userNote.trim()) {
                engagements.push(step.userNote.trim());
            }
        }
    }

    return {
        chaptersRead,
        totalPrayerTimeSec,
        engagements,
        completedSteps,
        totalSteps,
        sessionsCount: sessions.length,
    };
}

function getLegacyReadingSummary(session: Pick<PrayerFlowSession, 'bookName' | 'chapters'>): string {
    if (!session.bookName || !session.chapters?.length) {
        return 'Lecture du jour';
    }

    return session.chapters.length === 1
        ? `${session.bookName} ${session.chapters[0]}`
        : `${session.bookName} ${session.chapters[0]}–${session.chapters[session.chapters.length - 1]}`;
}

export function getSessionReadingSummary(session: Pick<PrayerFlowSession, 'readingSummary' | 'readings' | 'bookName' | 'chapters'>): string {
    if (session.readingSummary?.trim()) {
        return session.readingSummary.trim();
    }

    if (session.readings?.length) {
        return formatDayReadingsLabel(session.readings);
    }

    return getLegacyReadingSummary(session);
}

/** Extract key spiritual themes from passage text for contextual prompts */
function extractThemes(text: string): { godAttribute: string; challenge: string; blessing: string; person: string } {
    const lower = text.toLowerCase();

    // Find God attributes mentioned
    const godAttributes = [
        { keywords: ['fidèle', 'fidélité'], label: 'la fidélité de Dieu' },
        { keywords: ['amour', 'aimé', 'aimer'], label: "l'amour de Dieu" },
        { keywords: ['puissant', 'puissance', 'force'], label: 'la puissance de Dieu' },
        { keywords: ['grâce', 'miséricorde'], label: 'la grâce de Dieu' },
        { keywords: ['sage', 'sagesse'], label: 'la sagesse de Dieu' },
        { keywords: ['juste', 'justice'], label: 'la justice de Dieu' },
        { keywords: ['bon', 'bonté', 'bienfait'], label: 'la bonté de Dieu' },
        { keywords: ['saint', 'sainteté'], label: 'la sainteté de Dieu' },
        { keywords: ['protège', 'refuge', 'abri'], label: 'la protection de Dieu' },
        { keywords: ['pardon', 'pardonn'], label: 'le pardon de Dieu' },
    ];

    const foundAttr = godAttributes.find(a => a.keywords.some(k => lower.includes(k)));
    const godAttribute = foundAttr?.label || 'la grandeur de Dieu';

    // Find challenges/sins to repent of
    const challenges = [
        { keywords: ['orgueil', 'orgueilleux'], label: "l'orgueil" },
        { keywords: ['colère', 'fureur'], label: 'la colère' },
        { keywords: ['péché', 'transgress'], label: 'le péché' },
        { keywords: ['doute', 'incrédulité'], label: 'le doute' },
        { keywords: ['peur', 'crainte', 'effraye'], label: 'la peur' },
        { keywords: ['mensonge', 'tromperie'], label: 'le mensonge' },
        { keywords: ['désobé', 'rebelle'], label: 'la désobéissance' },
    ];
    const foundChallenge = challenges.find(c => c.keywords.some(k => lower.includes(k)));
    const challenge = foundChallenge?.label || 'tout ce qui nous éloigne de Dieu';

    // Find blessings
    const blessings = [
        { keywords: ['paix', 'repos'], label: 'la paix' },
        { keywords: ['joie', 'allégresse'], label: 'la joie' },
        { keywords: ['espérance', 'espoir'], label: "l'espérance" },
        { keywords: ['salut', 'sauvé'], label: 'le salut' },
        { keywords: ['guéri', 'guérison'], label: 'la guérison' },
        { keywords: ['béni', 'bénédiction'], label: 'la bénédiction' },
        { keywords: ['victoire', 'triomph'], label: 'la victoire' },
        { keywords: ['vie éternelle', 'résurrection'], label: 'la vie éternelle' },
    ];
    const foundBlessing = blessings.find(b => b.keywords.some(k => lower.includes(k)));
    const blessing = foundBlessing?.label || 'ses bienfaits';

    // Find people/groups mentioned
    const people = [
        { keywords: ['famille', 'enfant', 'fils', 'fille', 'père', 'mère'], label: 'votre famille' },
        { keywords: ['prochain', 'frère', 'sœur'], label: 'vos proches' },
        { keywords: ['ennemi'], label: 'ceux qui vous ont blessé' },
        { keywords: ['peuple', 'nation', 'pays'], label: 'votre pays et ses dirigeants' },
        { keywords: ['malade', 'souffr'], label: 'les malades et ceux qui souffrent' },
        { keywords: ['pauvre', 'opprimé'], label: 'les plus vulnérables' },
    ];
    const foundPerson = people.find(p => p.keywords.some(k => lower.includes(k)));
    const person = foundPerson?.label || 'quelqu\'un qui a besoin de prière';

    return { godAttribute, challenge, blessing, person };
}

/** Build the 5 PRIAM steps from reflection answers + passage text */
export function buildPrayerSteps(
    readings: PlanReading[],
    dailyPromptAnswers: Record<string, string>,
    passageText?: string,
    reflectionInsights: string[] = [],
    aiPrompts?: Record<string, string>,
): PrayerFlowStep[] {
    const chapterLabel = readings.length ? formatDayReadingsLabel(readings) : 'la lecture du jour';

    const themes = passageText ? extractThemes(passageText) : null;
    const insightSummary = reflectionInsights
        .map((insight) => insight.trim())
        .filter(Boolean)
        .slice(0, 3)
        .join(' • ');
    const reflectionEcho = insightSummary
        ? `\n\nÉchos de vos réflexions précédentes : ${insightSummary}`
        : '';

    // Helper: pick AI prompt if available, otherwise fall back to static
    const ai = aiPrompts ?? {};

    return [
        {
            type: 'adoration',
            emoji: '🙌',
            label: 'Adoration',
            prompt: ai.adoration || (themes
                ? `Ce passage révèle ${themes.godAttribute}.\n\nPrenez un moment pour louer Dieu pour qui Il est, tel que vous l'avez découvert dans ${chapterLabel}.${reflectionEcho}`
                : `D'après ${chapterLabel}, pour quoi pouvez-vous louer et adorer Dieu ?${reflectionEcho}`),
            userNote: '',
            completed: false,
            durationSec: 0,
        },
        {
            type: 'repentance',
            emoji: '🔄',
            label: 'Repentance',
            prompt: ai.repentance || (dailyPromptAnswers['b1']?.trim()
                ? `Votre réflexion : "${dailyPromptAnswers['b1'].trim()}"\n\nApportez cela devant Dieu dans la repentance.`
                : themes
                    ? `Ce passage nous met en garde contre ${themes.challenge}.\n\nY a-t-il quelque chose dont vous devez vous repentir ?${reflectionEcho}`
                    : `Y a-t-il quelque chose dont vous devez vous repentir après cette lecture ?${reflectionEcho}`),
            userNote: dailyPromptAnswers['b1']?.trim() || '',
            completed: false,
            durationSec: 0,
        },
        {
            type: 'gratitude',
            emoji: '🙏',
            label: 'Action de grâce',
            prompt: ai.gratitude || (dailyPromptAnswers['b3']?.trim()
                ? `Votre réflexion : "${dailyPromptAnswers['b3'].trim()}"\n\nRemerciez Dieu pour cela.`
                : themes
                    ? `Ce passage parle de ${themes.blessing}.\n\nRemerciez Dieu pour cette grâce dans votre vie.${reflectionEcho}`
                    : `Y a-t-il quelque chose pour laquelle remercier et louer Dieu dans ce passage ?${reflectionEcho}`),
            userNote: dailyPromptAnswers['b3']?.trim() || '',
            completed: false,
            durationSec: 0,
        },
        {
            type: 'intercession',
            emoji: '🤲',
            label: 'Intercession',
            prompt: ai.intercession || (dailyPromptAnswers['b4']?.trim()
                ? `Votre demande : "${dailyPromptAnswers['b4'].trim()}"\n\nPrésentez cette demande à Dieu.`
                : themes
                    ? `En lien avec ${chapterLabel}, priez pour ${themes.person}.${reflectionEcho}`
                    : `En lien avec ${chapterLabel}, priez pour quelqu'un ou pour une situation qui vous tient à cœur.${reflectionEcho}`),
            userNote: dailyPromptAnswers['b4']?.trim() || '',
            completed: false,
            durationSec: 0,
        },
        {
            type: 'engagement',
            emoji: '🎯',
            label: 'Engagement',
            prompt: ai.engagement || (dailyPromptAnswers['b2']?.trim()
                ? `Votre réflexion : "${dailyPromptAnswers['b2'].trim()}"\n\nQuelle action concrète allez-vous entreprendre aujourd'hui ?`
                : `Quelle action concrète allez-vous entreprendre en réponse à cette lecture ?${reflectionEcho}`),
            userNote: dailyPromptAnswers['b2']?.trim() || '',
            completed: false,
            durationSec: 0,
        },
    ];
}

/** Save prayer flow steps to the prayer journal as individual entries */
export function savePrayerFlowToJournal(session: PrayerFlowSession) {
    // Dynamic import to keep this optional
    const JOURNAL_KEY = 'formation_biblique_prayer_journal_v1';
    if (typeof window === 'undefined') return;

    try {
        const raw = localStorage.getItem(JOURNAL_KEY);
        const entries: Array<{
            id: string;
            content: string;
            category: string;
            createdAt: string;
            updatedAt: string;
            answered: boolean;
        }> = raw ? JSON.parse(raw) : [];

        const chapterLabel = getSessionReadingSummary(session);

        const categoryMap: Record<string, string> = {
            adoration: 'gratitude',
            repentance: 'personal',
            gratitude: 'gratitude',
            intercession: 'church',
            engagement: 'personal',
        };

        const emojiMap: Record<string, string> = {
            adoration: '🙌',
            repentance: '🔄',
            gratitude: '🙏',
            intercession: '🤲',
            engagement: '🎯',
        };

        for (const step of session.steps) {
            if (!step.completed || !step.userNote.trim()) continue;

            const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `pj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

            entries.unshift({
                id,
                content: `${emojiMap[step.type] || ''} ${step.label} — ${chapterLabel}\n${step.userNote.trim()}`,
                category: categoryMap[step.type] || 'other',
                createdAt: session.date,
                updatedAt: session.date,
                answered: false,
            });
        }

        localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
    } catch (err) {
        console.error('Failed to save prayer flow to journal', err);
    }
}
