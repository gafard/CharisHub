'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Sun } from 'lucide-react';
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

// On redéfinit AiQuestions ici pour plus de sûreté ou on l'importe si possible.
// Puisqu'il est défini dans ReflectionQuestions.tsx, on va le dupliquer ici ou le passer en Any si besoin.
type AiQuestions = {
    q1: string; q1_suggestions: string[];
    q2: string; q2_suggestions: string[];
    q3: string; q3_suggestions: string[];
    q4: string; q4_suggestions: string[];
};

interface ReadingPlanWidgetProps {
    triggerReflection?: number;
    currentBookId?: string;
    currentChapter?: number;
    passageText?: string;
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

    return (
        <>
            <motion.div
                className="relative mx-auto w-full max-w-[800px] overflow-hidden rounded-[28px] border border-border-soft bg-surface shadow-[0_24px_80px_rgba(22,28,53,0.08)] sm:p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
                {/* Effet de lumière de fond adaptatif */}
                <div
                    className="pointer-events-none absolute inset-0 transition-opacity duration-1000"
                    style={{
                        background: `
                            radial-gradient(circle at 0% 0%, ${activePlan ? teaserPresentation.theme.accentSoft : 'rgba(200,159,45,0.08)'} 0%, transparent 40%),
                            radial-gradient(circle at 100% 100%, rgba(200,159,45,0.04) 0%, transparent 30%),
                            linear-gradient(180deg, var(--surface) 0%, transparent 100%)
                        `,
                    }}
                />

                {/* Texture de grain subtile */}
                <div className="pointer-events-none absolute inset-0 opacity-[0.02] mix-blend-multiply" style={{ backgroundImage: 'radial-gradient(var(--foreground) 0.8px, transparent 1px)', backgroundSize: '24px 24px', backgroundPosition: 'center center' }} />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6">
                    <div className="flex flex-1 items-center gap-5">
                        {/* Icône principale avec halo */}
                        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-border-soft bg-surface-strong/60 shadow-inner sm:h-16 sm:w-16 sm:rounded-[22px]">
                            <div
                                className="absolute inset-0 rounded-[inherit] blur-2xl"
                                style={{ background: activePlan ? teaserPresentation.theme.accentSoft : 'rgba(200,159,45,0.15)' }}
                            />
                            <div className="relative z-10 flex items-center justify-center text-foreground">
                                <PlanSymbol symbolId={teaserPresentation.art.symbolId} size={24} />
                            </div>
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.25em] text-muted/60">
                                {activePlan && <Sun size={10} className="text-accent animate-pulse" />}
                                <span>{eyebrow}</span>
                            </div>

                            <h3 className="mt-1.5 font-display text-[20px] font-black leading-tight text-foreground sm:text-[23px] tracking-tight">
                                {title}
                            </h3>

                            <div className="mt-2 flex items-center gap-3 text-[13px] text-muted">
                                <span className="truncate">{subtitle}</span>
                                {detail && (
                                    <>
                                        <span className="h-1 w-1 rounded-full bg-border-soft" />
                                        <span className="truncate font-medium text-accent">{detail}</span>
                                    </>
                                )}
                            </div>

                            {/* Barre de progression si actif */}
                            {activePlan && (
                                <div className="mt-4 flex items-center gap-3">
                                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/5">
                                        <motion.div
                                            className="h-full bg-accent"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(activePlan.completedDays.length / activePlan.plan.days.length) * 100}%` }}
                                            transition={{ duration: 1, ease: 'circOut' }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">{Math.round((activePlan.completedDays.length / activePlan.plan.days.length) * 100)}%</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 border-t border-border-soft/60 pt-4 md:border-t-0 md:pt-0">
                        <div className={`${activePlan ? 'hidden' : 'block'} lg:block`}>
                           <CompactPlanStack entries={teaserEntries} primaryPlanId={activePlan?.plan.id ?? ''} />
                        </div>

                        <motion.button
                            type="button"
                            onClick={() => router.push(primaryHref)}
                            className="inline-flex shrink-0 items-center gap-2.5 rounded-full bg-foreground text-background px-6 py-3 text-[12px] font-black uppercase tracking-[0.18em] shadow-[0_10px_30px_rgba(0,0,0,0.15)]"
                            whileHover={{ y: -4, scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                        >
                            {primaryLabel}
                            <ArrowUpRight size={16} strokeWidth={2.8} />
                        </motion.button>
                    </div>
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

function CompactPlanStack({
    entries,
    primaryPlanId,
}: {
    entries: PlanEntry[];
    primaryPlanId: string;
}) {
    const previewEntries = entries.slice(0, 3);
    const layouts = [
        { left: 0, top: 14, rotate: -12, opacity: 0.52, zIndex: 10 },
        { left: 22, top: 0, rotate: -1, opacity: 1, zIndex: 20 },
        { left: 50, top: 12, rotate: 11, opacity: 0.52, zIndex: 10 },
    ];

    return (
        <div className="relative h-[68px] w-[112px]">
            {previewEntries.map((entry, index) => {
                const layout = layouts[index] ?? layouts[1];
                const isPrimary = entry.plan.id === primaryPlanId || (!primaryPlanId && index === 1);

                return (
                    <div
                        key={entry.plan.id}
                        className="absolute h-[54px] w-[40px] overflow-hidden rounded-[14px] border border-border-strong/10 bg-surface/40 shadow-[0_14px_28px_rgba(0,0,0,0.22)] backdrop-blur-md"
                        style={{
                            left: `${layout.left}px`,
                            top: `${layout.top}px`,
                            transform: `rotate(${layout.rotate}deg) scale(${isPrimary ? 1 : 0.96})`,
                            opacity: isPrimary ? 1 : layout.opacity,
                            zIndex: isPrimary ? 30 : layout.zIndex,
                        }}
                    >
                        <div
                            className="absolute inset-0"
                            style={{
                                background: `linear-gradient(180deg, ${entry.presentation.theme.accent} 0%, rgba(14,10,8,0.9) 100%)`,
                            }}
                        />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.03)_34%,rgba(4,7,14,0.22)_68%,rgba(4,7,14,0.4)_100%)]" />
                        <div className="relative flex h-full items-center justify-center text-[#fff8ef]">
                            <PlanSymbol symbolId={entry.presentation.art.symbolId} size={11} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
