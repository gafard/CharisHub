'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import logger from '../lib/logger';
import ReflectionSheet from './bible/ReflectionSheet';
import {
    countDayChapters,
    formatDayReadingsLabel,
    getDayChapterEntry,
    getActivePlan,
    isTodayCompleted,
    getPlanProgress,
    toggleReadingChapterComplete,
    findReadingPlan,
    type PlanReading,
} from '../lib/readingPlans';
import {
    DEFAULT_PREVIEW_ENTRIES,
    ENTRY_EASE,
    PLAN_ENTRIES,
    type PlanEntry,
    PlanSymbol,
} from './bible/readingPlanUi';
import { hasChapterReflection } from '../lib/readingPlanReflectionStore';
import { BIBLE_BOOKS } from '../lib/bibleCatalog';

import type { AiQuestions } from '../types/reflection';

interface ReadingPlanWidgetProps {
    triggerReflection?: number;
    currentBookId?: string;
    currentChapter?: number;
    passageText?: string;
    variant?: 'banner' | 'button';
}

function getBookDisplayName(bookId: string): string {
    const book = BIBLE_BOOKS.find((b) => b.id === bookId);
    return book?.name || bookId;
}

export default function ReadingPlanWidget({
    triggerReflection,
    currentBookId,
    currentChapter,
    passageText,
    variant = 'banner',
}: ReadingPlanWidgetProps) {
    const router = useRouter();
    const reducedMotion = useReducedMotion();
    const [activePlan, setActivePlan] = useState<ReturnType<typeof getActivePlan>>(null);
    const [todayDone, setTodayDone] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [reflectionContext, setReflectionContext] = useState<{
        planId: string;
        dayIndex: number;
        readings: PlanReading[];
        activeReading: PlanReading;
        activeChapter: number;
        finalChapter: boolean;
    } | null>(null);
    const [preloadedQuestions, setPreloadedQuestions] = useState<AiQuestions | null>(null);

    const lastReflectionTrigger = useRef(0);
    const lastPreloadKey = useRef('');

    const refreshPlanState = useCallback(() => {
        const nextActivePlan = getActivePlan();
        setMounted(true);
        setActivePlan(nextActivePlan);
        setTodayDone(nextActivePlan ? isTodayCompleted(nextActivePlan.planId) : false);
    }, []);

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            refreshPlanState();
        });

        return () => cancelAnimationFrame(frame);
    }, [refreshPlanState]);

    // PREFETCH LOGIC
    useEffect(() => {
        if (!activePlan || !currentBookId || !currentChapter || !passageText) return;

        const preloadKey = `${activePlan.planId}:${activePlan.todayIndex}:${currentBookId}:${currentChapter}`;
        if (lastPreloadKey.current === preloadKey) return;

        const todayDay = activePlan.plan.days[activePlan.todayIndex];
        const matchingReading = todayDay?.readings.find((reading) =>
            reading.bookId === currentBookId && reading.chapters.includes(currentChapter),
        );

        if (!matchingReading) return;

        lastPreloadKey.current = preloadKey;
        setPreloadedQuestions(null); // Reset while loading

        void (async () => {
            try {
                const plan = findReadingPlan(activePlan.planId);
                const bookName = getBookDisplayName(currentBookId);

                const res = await fetch('/api/bible/reflection-questions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        bookName,
                        chapter: currentChapter,
                        passageText: passageText.slice(0, 4000),
                        planCategory: plan?.category,
                    }),
                });

                if (res.ok) {
                    const data = await res.json() as AiQuestions;
                    if (lastPreloadKey.current === preloadKey) {
                        setPreloadedQuestions(data);
                    }
                }
            } catch (err) {
                logger.warn('[ReadingPlanWidget] Prefetch failed:', err);
            }
        })();
    }, [activePlan, currentBookId, currentChapter, passageText]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const handleFocus = () => refreshPlanState();
        const handleStorage = () => refreshPlanState();

        window.addEventListener('focus', handleFocus);
        window.addEventListener('storage', handleStorage);

        return () => {
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('storage', handleStorage);
        };
    }, [refreshPlanState]);

    useEffect(() => {
        if (!triggerReflection || triggerReflection <= lastReflectionTrigger.current || !activePlan) {
            return;
        }

        lastReflectionTrigger.current = triggerReflection;
        const frame = requestAnimationFrame(() => {
            const todayDay = activePlan.plan.days[activePlan.todayIndex];
            const matchingReading = todayDay?.readings.find((reading) =>
                reading.bookId === currentBookId && reading.chapters.includes(currentChapter ?? -1),
            );

            if (!matchingReading || typeof currentChapter !== 'number') {
                return;
            }

            const alreadyDone = activePlan.completedChaptersByDay?.[activePlan.todayIndex]?.[matchingReading.id]?.includes(currentChapter);
            if (!alreadyDone) {
                toggleReadingChapterComplete(activePlan.planId, activePlan.todayIndex, matchingReading.id, currentChapter);
            }

            const chapterEntry = getDayChapterEntry(todayDay, matchingReading.id, currentChapter);

            if (chapterEntry) {
                setReflectionContext({
                    planId: activePlan.planId,
                    dayIndex: activePlan.todayIndex,
                    readings: todayDay.readings,
                    activeReading: matchingReading,
                    activeChapter: currentChapter,
                    finalChapter: chapterEntry.order === chapterEntry.total - 1,
                });
            }

            refreshPlanState();
        });

        return () => cancelAnimationFrame(frame);
    }, [activePlan, currentBookId, currentChapter, refreshPlanState, triggerReflection]);

    if (!mounted) return null;

    const activeEntry = activePlan
        ? PLAN_ENTRIES.find((entry) => entry.plan.id === activePlan.plan.id) ?? null
        : null;
    const teaserEntries = activePlan
        ? [
            activeEntry,
            ...PLAN_ENTRIES.filter((entry) => entry.plan.id !== activePlan.plan.id).slice(0, 2),
        ].filter((entry): entry is (typeof PLAN_ENTRIES)[number] => Boolean(entry))
        : DEFAULT_PREVIEW_ENTRIES;
    const teaserPresentation = activeEntry?.presentation ?? DEFAULT_PREVIEW_ENTRIES[1]?.presentation ?? DEFAULT_PREVIEW_ENTRIES[0]?.presentation;

    if (!teaserPresentation) {
        return null;
    }

    const chapterCount = activePlan ? countDayChapters(activePlan.plan.days[activePlan.todayIndex]) : 0;
    const readingsLabel = activePlan ? formatDayReadingsLabel(activePlan.plan.days[activePlan.todayIndex].readings) : '';
    const primaryHref = activePlan ? `/bible/plans/${activePlan.plan.id}` : '/bible/plans';
    const eyebrow = !activePlan
        ? 'Plans de lecture'
        : `Plan en cours · Jour ${activePlan.todayIndex + 1}/${activePlan.plan.days.length}`;
    const title = !activePlan
        ? 'Choisir un parcours'
        : activePlan.plan.name;
    const subtitle = !activePlan
        ? `${PLAN_ENTRIES.length} parcours disponibles`
        : todayDone
            ? 'Lecture du jour validée'
            : `${chapterCount} ${chapterCount > 1 ? 'chapitres' : 'chapitre'} aujourd’hui`;
    const detail = !activePlan
        ? 'Voir les plans'
        : todayDone
            ? 'Retour au plan'
            : readingsLabel;
    const primaryLabel = !activePlan ? 'Voir' : 'Retour';

    if (variant === 'button') {
        return (
            <>
                <button
                    onClick={() => router.push(primaryHref)}
                    className="flex h-8 items-center justify-center gap-1.5 rounded-lg sm:rounded-xl border border-transparent bg-foreground/5 sm:bg-background px-2.5 sm:px-4 text-[11px] sm:text-sm font-bold text-foreground outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors hover:bg-foreground/10"
                    title={title}
                >
                    <PlanSymbol symbolId={teaserPresentation.art.symbolId} size={14} />
                    <span className="hidden sm:inline">Parcours</span>
                    {activePlan && !todayDone && (
                        <span className="ml-1 h-1.5 w-1.5 rounded-full bg-accent" />
                    )}
                </button>

                {reflectionContext && (
                    <ReflectionSheet
                        isOpen
                        onClose={() => setReflectionContext(null)}
                        onComplete={() => {
                            const nextPlan = getPlanProgress(reflectionContext.planId);
                            setTodayDone(nextPlan ? isTodayCompleted(nextPlan.planId) : false);
                            setActivePlan(getActivePlan());
                        }}
                        readings={reflectionContext.readings}
                        planId={reflectionContext.planId}
                        dayIndex={reflectionContext.dayIndex}
                        alreadyCompleted={reflectionContext.finalChapter}
                        activeReading={reflectionContext.activeReading}
                        activeChapter={reflectionContext.activeChapter}
                        finalChapter={reflectionContext.finalChapter}
                        preloadedQuestions={preloadedQuestions ?? undefined}
                    />
                )}
            </>
        );
    }

    return (
        <>
            <motion.div
                className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-none border-x-0 border-y sm:rounded-2xl sm:border border-border-soft bg-surface/80 backdrop-blur-md shadow-sm"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
                <div className="flex items-center gap-3 px-4 py-3">
                    {/* Small icon */}
                    <div
                        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-soft bg-surface-strong/60 shadow-inner"
                    >
                        <div className="relative z-10 flex items-center justify-center text-foreground">
                            <PlanSymbol symbolId={teaserPresentation.art.symbolId} size={18} />
                        </div>
                    </div>

                    {/* Text */}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted/60">
                                {eyebrow}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <h3 className="font-display text-[14px] font-bold leading-tight text-foreground truncate">
                                {title}
                            </h3>
                            <span className="hidden sm:inline text-[12px] text-muted truncate">· {subtitle}</span>
                        </div>

                        {/* Progress bar (active plan only) */}
                        {activePlan && (
                            <div className="mt-1.5 flex items-center gap-2">
                                <div className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/5">
                                    <motion.div
                                        className="h-full bg-accent"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(activePlan.completedDays.length / activePlan.plan.days.length) * 100}%` }}
                                        transition={{ duration: 1, ease: 'circOut' }}
                                    />
                                </div>
                                <span className="text-[9px] font-bold text-muted tracking-wide">{Math.round((activePlan.completedDays.length / activePlan.plan.days.length) * 100)}%</span>
                            </div>
                        )}
                    </div>

                    {/* CTA */}
                    <button
                        type="button"
                        onClick={() => router.push(primaryHref)}
                        className="flex shrink-0 items-center gap-1.5 rounded-full bg-foreground text-background px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] shadow-sm transition hover:scale-[1.02] active:scale-95"
                    >
                        {primaryLabel}
                        <ArrowUpRight size={13} strokeWidth={2.8} />
                    </button>
                </div>
            </motion.div>
            {reflectionContext ? (
                <ReflectionSheet
                    isOpen
                    onClose={() => setReflectionContext(null)}
                    onComplete={() => {
                        const nextPlan = getPlanProgress(reflectionContext.planId);
                        setTodayDone(nextPlan ? isTodayCompleted(nextPlan.planId) : false);
                        setActivePlan(getActivePlan());
                    }}
                    readings={reflectionContext.readings}
                    planId={reflectionContext.planId}
                    dayIndex={reflectionContext.dayIndex}
                    alreadyCompleted={reflectionContext.finalChapter}
                    activeReading={reflectionContext.activeReading}
                    activeChapter={reflectionContext.activeChapter}
                    finalChapter={reflectionContext.finalChapter}
                    preloadedQuestions={preloadedQuestions ?? undefined}
                />
            ) : null}
        </>
    );
}
