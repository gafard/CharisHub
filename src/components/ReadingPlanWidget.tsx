'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ReflectionSheet from './bible/ReflectionSheet';
import {
    countDayChapters,
    formatDayReadingsLabel,
    getDayChapterEntry,
    getActivePlan,
    isTodayCompleted,
    getPlanProgress,
    toggleReadingChapterComplete,
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

interface ReadingPlanWidgetProps {
    triggerReflection?: number;
    currentBookId?: string;
    currentChapter?: number;
}

export default function ReadingPlanWidget({
    triggerReflection,
    currentBookId,
    currentChapter,
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
    const lastReflectionTrigger = useRef(0);

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

                const chapterEntry = getDayChapterEntry(todayDay, matchingReading.id, currentChapter);
                const alreadyReflected = hasChapterReflection(activePlan.planId, activePlan.todayIndex, matchingReading.id, currentChapter);

                if (chapterEntry && !alreadyReflected) {
                    setReflectionContext({
                        planId: activePlan.planId,
                        dayIndex: activePlan.todayIndex,
                        readings: todayDay.readings,
                        activeReading: matchingReading,
                        activeChapter: currentChapter,
                        finalChapter: chapterEntry.order === chapterEntry.total - 1,
                    });
                }
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
            <div className="relative mx-auto w-full max-w-[760px] overflow-hidden rounded-[26px] border border-[rgba(246,225,192,0.1)] bg-[#110d0a] p-3.5 text-white shadow-[0_18px_54px_rgba(0,0,0,0.22)] sm:p-4">
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background: `radial-gradient(circle_at_top_left, ${teaserPresentation.theme.accentSoft}, transparent 26%), radial-gradient(circle_at_bottom_right, rgba(255,255,255,0.04), transparent 18%), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0))`,
                    }}
                />
                <div className="relative z-10 flex min-h-[78px] items-center gap-3 sm:min-h-[84px] sm:gap-4">
                    <button
                        type="button"
                        onClick={() => router.push(primaryHref)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.04))] text-[#fff7ec] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:h-12 sm:w-12 sm:rounded-[18px]">
                            <div
                                className="absolute inset-0 rounded-[inherit] blur-xl"
                                style={{ background: teaserPresentation.theme.accentSoft }}
                            />
                            <div className="relative z-10 flex items-center justify-center">
                                <PlanSymbol symbolId={teaserPresentation.art.symbolId} size={18} />
                            </div>
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[rgba(255,240,222,0.6)]">
                                <span>{eyebrow}</span>
                                {!activePlan && (
                                    <>
                                        <span aria-hidden="true" className="text-[rgba(255,240,222,0.36)]">•</span>
                                        <span>{PLAN_ENTRIES.length} parcours</span>
                                    </>
                                )}
                            </div>
                            <h3 className="mt-1 truncate font-display text-[17px] font-bold leading-none text-[#fff6ea] sm:text-[19px]">
                                {title}
                            </h3>
                            <p className="mt-1 truncate text-[12px] text-[rgba(255,241,220,0.68)] sm:text-[12.5px]">
                                {subtitle}
                                {detail ? (
                                    <>
                                        <span className="mx-1.5 text-[rgba(255,240,222,0.3)]">•</span>
                                        {detail}
                                    </>
                                ) : null}
                            </p>
                        </div>
                    </button>

                    <div className="hidden shrink-0 sm:block">
                        <CompactPlanStack entries={teaserEntries} primaryPlanId={activePlan?.plan.id ?? ''} />
                    </div>

                    <motion.button
                        type="button"
                        onClick={() => router.push(primaryHref)}
                        className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#fff7ef] px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#160d0a] shadow-[0_14px_34px_rgba(0,0,0,0.18)] sm:px-4 sm:text-[11.5px]"
                        whileHover={reducedMotion ? undefined : { y: -2, scale: 1.01 }}
                        whileTap={reducedMotion ? undefined : { scale: 0.985 }}
                        transition={{ duration: 0.32, ease: ENTRY_EASE }}
                    >
                        {primaryLabel}
                        <ArrowUpRight size={15} strokeWidth={2.4} />
                    </motion.button>
                </div>
            </div>
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
                        className="absolute h-[54px] w-[40px] overflow-hidden rounded-[14px] border border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.04))] shadow-[0_14px_28px_rgba(0,0,0,0.22)] backdrop-blur-md"
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
