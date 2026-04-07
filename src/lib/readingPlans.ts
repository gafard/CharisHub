import logger from '@/lib/logger';
/**
 * Bible Reading Plans — date-synchronized, auto-advancing plans.
 *
 * Day progression is based on the calendar date since the user started the plan.
 * The user cannot skip or manually advance days.
 *
 * REQUIRES REGISTRATION: Plans are only available to registered users
 * (those with a displayName set in localStorage identity).
 */

import {
    READING_PLANS,
    type PlanDay,
    type PlanReading,
    type ReadingPlan,
} from './readingPlanCatalog';

const PLANS_KEY = 'formation_biblique_reading_plans_v3';
const LEGACY_PLANS_KEY = 'formation_biblique_reading_plans_v2';
const ACTIVE_PLAN_KEY = 'formation_biblique_active_reading_plan_v1';
const IDENTITY_KEY = 'formation_biblique_identity_v1';

/**
 * Vérifie si l'utilisateur est "inscrit" (connecté via Supabase Auth).
 * Un utilisateur "invité" sans compte Supabase ne peut pas activer de plan.
 * 
 * @param userId - Optionnel: l'userId Supabase actuel (depuis useAuth)
 */
export function isUserRegistered(userId?: string | null): boolean {
    // Si on passe un userId explicite, on l'utilise
    if (userId) return true;

    // Sinon on vérifie le localStorage (cas où AuthContext n'est pas disponible)
    if (typeof window === 'undefined') return false;
    try {
        const raw = localStorage.getItem(IDENTITY_KEY);
        if (!raw) return false;
        const identity = JSON.parse(raw);
        // L'utilisateur est inscrit s'il a un userId (Supabase) OU un displayName
        // Pour la transition, on accepte les deux, mais on privilégie userId
        return !!(identity?.userId || (identity?.displayName && identity.displayName.trim().length > 0));
    } catch {
        return false;
    }
}

/**
 * Vérifie et retourne l'erreur si l'utilisateur n'est pas inscrit.
 */
export function checkUserRegistered(userId?: string | null): { allowed: true } | { allowed: false; reason: string } {
    if (isUserRegistered(userId)) return { allowed: true };
    return {
        allowed: false,
        reason: 'Les plans de lecture nécessitent un compte. Connectez-vous ou créez un compte.',
    };
}

type LegacyPlanProgress = {
    planId: string;
    startDate: string;
    completedDays: number[];
    completedChaptersByDay: Record<number, number[]>;
};

export interface PlanProgress {
    planId: string;
    startDate: string;
    completedDays: number[];
    completedChaptersByDay: Record<number, Record<string, number[]>>;
}

export type DayChapterEntry = {
    reading: PlanReading;
    chapter: number;
    order: number;
    total: number;
};

export type ActiveReadingPlan = PlanProgress & {
    plan: ReadingPlan;
    todayIndex: number;
};

export { READING_PLANS };
export type { PlanDay, PlanReading, ReadingPlan };

function todayStr(): string {
    return new Date().toISOString().slice(0, 10);
}

function daysBetween(startDate: string, endDate: string): number {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function getPlanById(planId: string): ReadingPlan | undefined {
    return READING_PLANS.find((plan) => plan.id === planId);
}

export function findReadingPlan(planId: string): ReadingPlan | undefined {
    return getPlanById(planId);
}

function uniqueChapters(chapters: number[], allowed: number[]): number[] {
    const allowedSet = new Set(allowed);
    return [...new Set(chapters.filter((chapter) => allowedSet.has(chapter)))].sort((a, b) => a - b);
}

function isDayCompleted(day: PlanDay, completedDay: Record<string, number[]> | undefined): boolean {
    if (!completedDay) return false;

    return day.readings.every((reading) =>
        reading.chapters.every((chapter) => completedDay[reading.id]?.includes(chapter)),
    );
}

function normalizeDayCompletion(
    rawDayValue: unknown,
    day: PlanDay,
    markWholeDayComplete: boolean,
): Record<string, number[]> {
    const completed: Record<string, number[]> = {};

    if (markWholeDayComplete) {
        for (const reading of day.readings) {
            completed[reading.id] = [...reading.chapters];
        }
        return completed;
    }

    if (Array.isArray(rawDayValue)) {
        const primary = day.readings[0];
        if (!primary) return completed;
        completed[primary.id] = uniqueChapters(rawDayValue, primary.chapters);
        return completed;
    }

    if (!rawDayValue || typeof rawDayValue !== 'object') {
        return completed;
    }

    const rawMap = rawDayValue as Record<string, unknown>;

    for (const reading of day.readings) {
        const rawReading = rawMap[reading.id];
        if (Array.isArray(rawReading)) {
            completed[reading.id] = uniqueChapters(rawReading, reading.chapters);
        }
    }

    if (!Object.keys(completed).length && day.readings.length === 1) {
        const [firstValue] = Object.values(rawMap);
        if (Array.isArray(firstValue)) {
            const primary = day.readings[0];
            completed[primary.id] = uniqueChapters(firstValue, primary.chapters);
        }
    }

    return completed;
}

function normalizeProgressEntry(rawProgress: unknown, plan: ReadingPlan): PlanProgress {
    const progress = (rawProgress ?? {}) as Partial<PlanProgress & LegacyPlanProgress>;
    const completedDaysSource = Array.isArray(progress.completedDays) ? progress.completedDays : [];
    const completedChaptersSource =
        progress.completedChaptersByDay && typeof progress.completedChaptersByDay === 'object'
            ? progress.completedChaptersByDay
            : {};

    const completedChaptersByDay: Record<number, Record<string, number[]>> = {};

    plan.days.forEach((day, index) => {
        const completedDay = completedDaysSource.includes(index);
        const rawDayValue = completedChaptersSource[index as keyof typeof completedChaptersSource];
        const normalizedDay = normalizeDayCompletion(rawDayValue, day, completedDay);

        if (Object.keys(normalizedDay).length) {
            completedChaptersByDay[index] = normalizedDay;
        }
    });

    const completedDays = plan.days.flatMap((day, index) =>
        isDayCompleted(day, completedChaptersByDay[index]) ? [index] : [],
    );

    return {
        planId: plan.id,
        startDate: typeof progress.startDate === 'string' ? progress.startDate : todayStr(),
        completedDays,
        completedChaptersByDay,
    };
}

function loadStoredProgress(): Record<string, PlanProgress> {
    if (typeof window === 'undefined') return {};

    const rawV3 = localStorage.getItem(PLANS_KEY);
    const rawLegacy = rawV3 ? null : localStorage.getItem(LEGACY_PLANS_KEY);
    const rawSource = rawV3 ?? rawLegacy;

    if (!rawSource) return {};

    try {
        const parsed = JSON.parse(rawSource) as Record<string, unknown>;
        const normalized = Object.entries(parsed).reduce<Record<string, PlanProgress>>((accumulator, [planId, rawProgress]) => {
            const plan = getPlanById(planId) ?? getPlanById((rawProgress as Partial<PlanProgress>)?.planId ?? '');
            if (!plan) return accumulator;
            accumulator[plan.id] = normalizeProgressEntry(rawProgress, plan);
            return accumulator;
        }, {});

        const normalizedJson = JSON.stringify(normalized);
        if (rawLegacy || rawV3 !== normalizedJson) {
            localStorage.setItem(PLANS_KEY, normalizedJson);
            if (rawLegacy) {
                localStorage.removeItem(LEGACY_PLANS_KEY);
            }
        }

        return normalized;
    } catch {
        return {};
    }
}

function saveProgress(data: Record<string, PlanProgress>) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(PLANS_KEY, JSON.stringify(data));
}

function loadActivePlanId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACTIVE_PLAN_KEY);
}

function saveActivePlanId(planId: string | null) {
    if (typeof window === 'undefined') return;

    if (!planId) {
        localStorage.removeItem(ACTIVE_PLAN_KEY);
        return;
    }

    localStorage.setItem(ACTIVE_PLAN_KEY, planId);
}

function syncDayCompletion(progress: PlanProgress, plan: ReadingPlan, dayIndex: number) {
    progress.completedDays = progress.completedDays.filter((value) => value !== dayIndex);
    if (isDayCompleted(plan.days[dayIndex], progress.completedChaptersByDay[dayIndex])) {
        progress.completedDays.push(dayIndex);
        progress.completedDays.sort((a, b) => a - b);
    }
}

export function getCurrentDayIndex(progress: PlanProgress, plan: ReadingPlan): number {
    const elapsed = daysBetween(progress.startDate, todayStr());
    return Math.min(Math.max(0, elapsed), plan.days.length - 1);
}

export function getActivePlan(): ActiveReadingPlan | null {
    const all = loadStoredProgress();
    const activePlanId = loadActivePlanId();

    if (activePlanId) {
        const activeProgress = all[activePlanId];
        const activePlan = getPlanById(activePlanId);

        if (activeProgress && activePlan) {
            const todayIndex = getCurrentDayIndex(activeProgress, activePlan);
            const isComplete = activeProgress.completedDays.length >= activePlan.days.length;
            if (!isComplete) {
                return { ...activeProgress, plan: activePlan, todayIndex };
            }
        }

        saveActivePlanId(null);
    }

    // Fallback: pick the first one from storage if active ID is lost but plan exists
    for (const progress of Object.values(all)) {
        const plan = getPlanById(progress.planId);
        if (!plan) continue;

        const isComplete = progress.completedDays.length >= plan.days.length;
        if (!isComplete) {
            saveActivePlanId(progress.planId);
            return {
                ...progress,
                plan,
                todayIndex: getCurrentDayIndex(progress, plan),
            };
        }
    }

    return null;
}

export function getPlanProgress(planId: string): ActiveReadingPlan | null {
    const data = loadStoredProgress();
    const progress = data[planId];
    const plan = getPlanById(planId);

    if (!progress || !plan) return null;

    return {
        ...progress,
        plan,
        todayIndex: getCurrentDayIndex(progress, plan),
    };
}

export function startPlan(planId: string): PlanProgress {
    const data = loadStoredProgress();
    const progress: PlanProgress = {
        planId,
        startDate: todayStr(),
        completedDays: [],
        completedChaptersByDay: {},
    };

    data[planId] = progress;
    saveProgress(data);
    saveActivePlanId(planId);

    return progress;
}

export function startOrActivatePlan(planId: string, userId?: string | null): ActiveReadingPlan | null {
    // Vérifier que l'utilisateur est inscrit
    const check = checkUserRegistered(userId);
    if (!check.allowed) {
        logger.warn('[ReadingPlans] Plan activation refuse — utilisateur non inscrit:', check.reason);
        return null;
    }

    const plan = getPlanById(planId);
    if (!plan) return null;

    const data = loadStoredProgress();
    const existing = data[planId];

    // Clear all other plans from data before saving
    const newData: Record<string, PlanProgress> = {};

    if (existing) {
        newData[planId] = existing;
        saveProgress(newData);
        saveActivePlanId(planId);
        return {
            ...existing,
            plan,
            todayIndex: getCurrentDayIndex(existing, plan),
        };
    }

    const progress: PlanProgress = {
        planId,
        startDate: todayStr(),
        completedDays: [],
        completedChaptersByDay: {},
    };

    newData[planId] = progress;
    saveProgress(newData);
    saveActivePlanId(planId);

    return {
        ...progress,
        plan,
        todayIndex: 0,
    };
}

export function markTodayComplete(planId: string): PlanProgress | null {
    const data = loadStoredProgress();
    const progress = data[planId];
    const plan = getPlanById(planId);

    if (!progress || !plan) return null;

    const todayIndex = getCurrentDayIndex(progress, plan);
    const day = plan.days[todayIndex];
    if (!day) return null;

    progress.completedChaptersByDay[todayIndex] = {};

    for (const reading of day.readings) {
        progress.completedChaptersByDay[todayIndex][reading.id] = [...reading.chapters];
    }

    syncDayCompletion(progress, plan, todayIndex);
    saveProgress(data);
    return progress;
}

export function toggleReadingChapterComplete(
    planId: string,
    dayIndex: number,
    readingId: string,
    chapter: number,
): PlanProgress | null {
    const data = loadStoredProgress();
    const progress = data[planId];
    const plan = getPlanById(planId);

    if (!progress || !plan) return null;

    const day = plan.days[dayIndex];
    const reading = day?.readings.find((entry) => entry.id === readingId);
    if (!day || !reading || !reading.chapters.includes(chapter)) return null;

    const dayMap = progress.completedChaptersByDay[dayIndex] ?? {};
    const currentCompleted = dayMap[readingId] ?? [];
    const isCompleted = currentCompleted.includes(chapter);

    if (isCompleted) {
        const nextCompleted = currentCompleted.filter((value) => value !== chapter);
        if (nextCompleted.length) {
            dayMap[readingId] = nextCompleted;
        } else {
            delete dayMap[readingId];
        }
    } else {
        dayMap[readingId] = [...currentCompleted, chapter].sort((a, b) => a - b);
    }

    if (Object.keys(dayMap).length) {
        progress.completedChaptersByDay[dayIndex] = dayMap;
    } else {
        delete progress.completedChaptersByDay[dayIndex];
    }

    syncDayCompletion(progress, plan, dayIndex);
    saveProgress(data);
    return progress;
}

export function toggleChapterComplete(planId: string, dayIndex: number, chapter: number): PlanProgress | null {
    const plan = getPlanById(planId);
    const readingId = plan?.days[dayIndex]?.readings[0]?.id ?? 'primary';
    return toggleReadingChapterComplete(planId, dayIndex, readingId, chapter);
}

export function isReadingChapterCompleted(
    planId: string,
    dayIndex: number,
    readingId: string,
    chapter: number,
): boolean {
    const data = loadStoredProgress();
    return Boolean(data[planId]?.completedChaptersByDay?.[dayIndex]?.[readingId]?.includes(chapter));
}

export function isChapterCompleted(planId: string, dayIndex: number, chapter: number): boolean {
    const plan = getPlanById(planId);
    const readingId = plan?.days[dayIndex]?.readings[0]?.id ?? 'primary';
    return isReadingChapterCompleted(planId, dayIndex, readingId, chapter);
}

export function isTodayCompleted(planId: string): boolean {
    const data = loadStoredProgress();
    const progress = data[planId];
    const plan = getPlanById(planId);
    if (!progress || !plan) return false;

    const todayIndex = getCurrentDayIndex(progress, plan);
    return progress.completedDays.includes(todayIndex);
}

export function resetPlan(planId: string) {
    const data = loadStoredProgress();
    delete data[planId];
    saveProgress(data);

    if (loadActivePlanId() === planId) {
        saveActivePlanId(null);
    }
}

export function getPlanCompletion(planId: string): number {
    const data = loadStoredProgress();
    const plan = getPlanById(planId);
    if (!plan || !data[planId]) return 0;

    return Math.round((data[planId].completedDays.length / plan.days.length) * 100);
}

export function getAllProgress(): Record<string, PlanProgress> {
    return loadStoredProgress();
}

export function countDayChapters(day: PlanDay): number {
    return day.readings.reduce((sum, reading) => sum + reading.chapters.length, 0);
}

export function getDayChapterEntries(day: PlanDay): DayChapterEntry[] {
    const total = countDayChapters(day);
    const entries: DayChapterEntry[] = [];
    let order = 0;

    for (const reading of day.readings) {
        for (const chapter of reading.chapters) {
            entries.push({
                reading,
                chapter,
                order,
                total,
            });
            order += 1;
        }
    }

    return entries;
}

export function getDayChapterEntry(
    day: PlanDay,
    readingId: string,
    chapter: number,
): DayChapterEntry | null {
    return getDayChapterEntries(day).find((entry) => entry.reading.id === readingId && entry.chapter === chapter) ?? null;
}

export function formatChapterRange(chapters: number[]): string {
    if (chapters.length === 1) return String(chapters[0]);

    const isContiguous = chapters.every((chapter, index) => index === 0 || chapter === chapters[index - 1] + 1);
    if (isContiguous) {
        return `${chapters[0]}-${chapters[chapters.length - 1]}`;
    }

    return chapters.join(', ');
}

export function formatReadingLabel(reading: PlanReading): string {
    return `${reading.bookName} ${formatChapterRange(reading.chapters)}`;
}

export function formatDayReadingsLabel(readings: PlanReading[]): string {
    return readings.map(formatReadingLabel).join(' · ');
}

export function getFirstUncompletedReading(planId: string): { bookId: string; chapter: number } | null {
    const progress = getPlanProgress(planId);
    if (!progress) return null;

    const day = progress.plan.days[progress.todayIndex];
    if (!day) return null;

    const completedDay = progress.completedChaptersByDay[progress.todayIndex] ?? {};

    for (const reading of day.readings) {
        for (const chapter of reading.chapters) {
            if (!completedDay[reading.id]?.includes(chapter)) {
                return { bookId: reading.bookId, chapter };
            }
        }
    }

    // Default to first reading of the day if all done
    const firstReading = day.readings[0];
    return firstReading ? { bookId: firstReading.bookId, chapter: firstReading.chapters[0] } : null;
}
