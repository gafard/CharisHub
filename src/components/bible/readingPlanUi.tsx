'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import {
    BookOpen,
    BookOpenText,
    Check,
    Cross,
    Crown,
    FishSymbol,
    Flame,
    Gem,
    Landmark,
    LibraryBig,
    Lightbulb,
    Music,
    Scroll,
    ScrollText,
    ShieldCheck,
    Sparkles,
    Sprout,
    Sunrise,
    TreePine,
    Waypoints,
} from 'lucide-react';
import {
    READING_PLANS,
    getPlanCompletion,
    type ReadingPlan,
} from '../../lib/readingPlans';
import {
    getReadingPlanPresentation,
    type PlanCategoryId,
    type PlanSymbolId,
    type PlanVisualTone,
    type ReadingPlanPresentation,
} from '../../lib/readingPlanVisuals';

export type CategoryFilter = 'all' | PlanCategoryId;

export type PlanEntry = {
    plan: ReadingPlan;
    presentation: ReadingPlanPresentation;
};

export const PLAN_ENTRIES: PlanEntry[] = READING_PLANS.map((plan) => ({
    plan,
    presentation: getReadingPlanPresentation(plan),
}));

export const FEATURED_PREVIEW_ENTRIES = PLAN_ENTRIES.filter((entry) => entry.presentation.featured).slice(0, 3);
export const DEFAULT_PREVIEW_ENTRIES = FEATURED_PREVIEW_ENTRIES.length > 0 ? FEATURED_PREVIEW_ENTRIES : PLAN_ENTRIES.slice(0, 3);
export const PRIMARY_PREVIEW_INDEX = DEFAULT_PREVIEW_ENTRIES.length > 1 ? 1 : 0;
export const PRIMARY_PLAN_ENTRY = DEFAULT_PREVIEW_ENTRIES[PRIMARY_PREVIEW_INDEX] ?? PLAN_ENTRIES[0] ?? null;

export const ENTRY_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const CARD_WASHES: Record<
    PlanVisualTone,
    {
        start: string;
        end: string;
        glow: string;
        halo: string;
        dot: string;
    }
> = {
    warm: {
        start: '#ff7a46',
        end: '#692013',
        glow: 'rgba(255, 177, 120, 0.56)',
        halo: 'rgba(255, 141, 87, 0.18)',
        dot: 'rgba(255,255,255,0.18)',
    },
    stone: {
        start: '#b07cff',
        end: '#412069',
        glow: 'rgba(214, 191, 255, 0.52)',
        halo: 'rgba(176, 124, 255, 0.18)',
        dot: 'rgba(255,255,255,0.16)',
    },
    linen: {
        start: '#4eb4ff',
        end: '#0d3a6c',
        glow: 'rgba(134, 208, 255, 0.52)',
        halo: 'rgba(64, 159, 255, 0.16)',
        dot: 'rgba(255,255,255,0.18)',
    },
    night: {
        start: '#2f7fff',
        end: '#08224b',
        glow: 'rgba(99, 156, 255, 0.58)',
        halo: 'rgba(61, 122, 255, 0.18)',
        dot: 'rgba(255,255,255,0.16)',
    },
    ceremonial: {
        start: '#dd4f92',
        end: '#5d0f3a',
        glow: 'rgba(243, 138, 200, 0.52)',
        halo: 'rgba(221, 79, 146, 0.18)',
        dot: 'rgba(255,255,255,0.18)',
    },
};

const PLAN_SYMBOLS: Record<PlanSymbolId, typeof BookOpen> = {
    'book-open': BookOpen,
    'book-open-text': BookOpenText,
    cross: Cross,
    'fish-symbol': FishSymbol,
    music: Music,
    lightbulb: Lightbulb,
    landmark: Landmark,
    'shield-check': ShieldCheck,
    sprout: Sprout,
    'tree-pine': TreePine,
    flame: Flame,
    waypoints: Waypoints,
    gem: Gem,
    crown: Crown,
    scroll: Scroll,
    'scroll-text': ScrollText,
    sunrise: Sunrise,
    'library-big': LibraryBig,
    sparkles: Sparkles,
};

export function PlanSymbol({
    symbolId,
    size,
}: {
    symbolId: PlanSymbolId;
    size: number;
}) {
    const Icon = PLAN_SYMBOLS[symbolId] ?? BookOpen;
    return <Icon size={size} />;
}

export function getEntriesForCategory(category: CategoryFilter): PlanEntry[] {
    return category === 'all'
        ? PLAN_ENTRIES
        : PLAN_ENTRIES.filter((entry) => entry.presentation.categoryId === category);
}

export function getPlanActionLabel(planId: string, activePlanId: string | null) {
    if (activePlanId === planId) {
        return "Continuer aujourd'hui";
    }

    return getPlanCompletion(planId) > 0 ? 'Reprendre ce parcours' : 'Commencer ce parcours';
}

export function PlanTeaserPreview({
    entries,
    primaryPlanId,
}: {
    entries: PlanEntry[];
    primaryPlanId: string;
}) {
    const previewEntries = entries.slice(0, 3);
    const layouts = [
        { left: '0%', top: '22%', rotate: '-13deg', scale: 0.86, opacity: 0.58, zIndex: 10 },
        { left: '26%', top: '2%', rotate: '-1deg', scale: 1, opacity: 1, zIndex: 20 },
        { left: '56%', top: '20%', rotate: '12deg', scale: 0.86, opacity: 0.58, zIndex: 10 },
    ];

    return (
        <div className="pointer-events-none absolute right-3 top-1/2 h-[108px] w-[132px] -translate-y-1/2 sm:right-4 sm:h-[124px] sm:w-[172px] lg:right-5 lg:h-[142px] lg:w-[206px]">
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.12),transparent_62%)] blur-2xl" />
            {previewEntries.map((entry, index) => {
                const wash = CARD_WASHES[entry.presentation.art.tone];
                const layout = layouts[index] ?? layouts[1];
                const isPrimary = entry.plan.id === primaryPlanId;

                return (
                    <div
                        key={entry.plan.id}
                        className="absolute h-[84px] w-[62px] overflow-hidden rounded-[18px] border sm:h-[94px] sm:w-[72px] lg:h-[112px] lg:w-[86px]"
                        style={{
                            left: layout.left,
                            top: layout.top,
                            transform: `rotate(${layout.rotate}) scale(${layout.scale})`,
                            opacity: isPrimary ? 1 : layout.opacity,
                            zIndex: isPrimary ? 30 : layout.zIndex,
                            borderColor: 'rgba(255,255,255,0.18)',
                            background: `linear-gradient(180deg, ${wash.start} 0%, ${wash.end} 100%)`,
                            boxShadow: isPrimary ? `0 18px 42px ${entry.presentation.theme.shadow}` : '0 14px 34px rgba(0,0,0,0.22)',
                        }}
                    >
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.04)_28%,rgba(5,6,12,0.18)_58%,rgba(5,6,12,0.34)_100%)]" />
                        <div
                            className="absolute inset-0 opacity-60"
                            style={{
                                backgroundImage: `radial-gradient(${wash.dot} 0.7px, transparent 1px)`,
                                backgroundSize: '14px 14px',
                                backgroundPosition: 'center center',
                            }}
                        />
                        <div className="absolute left-2 top-2 rounded-full border border-white/16 bg-[rgba(10,10,12,0.26)] px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-[0.2em] text-[#fff1dc] backdrop-blur-md sm:text-[8px]">
                            {entry.plan.days.length} j
                        </div>
                        <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/16 bg-[rgba(255,255,255,0.10)] text-[#fffaf2] backdrop-blur-md sm:h-7 sm:w-7">
                            <PlanSymbol symbolId={entry.presentation.art.symbolId} size={12} />
                        </div>
                        <div className="absolute inset-x-2 bottom-2">
                            <div className="text-[6px] font-semibold uppercase tracking-[0.18em] text-[rgba(255,241,220,0.72)] sm:text-[7px]">
                                {entry.presentation.art.eyebrow}
                            </div>
                            <div className="mt-1 truncate text-[10px] font-semibold text-[#fff8ef] sm:text-[11px]">
                                {entry.plan.name}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function PlanStageCard({
    entry,
    completion,
    reducedMotion,
    priority = false,
    compact = false,
    side = 'center',
    showImage = true,
}: {
    entry: PlanEntry;
    completion: number;
    reducedMotion: boolean;
    priority?: boolean;
    compact?: boolean;
    side?: 'left' | 'center' | 'right';
    showImage?: boolean;
}) {
    const { plan, presentation } = entry;
    const wash = CARD_WASHES[presentation.art.tone];
    const cardHeight = compact
        ? 'h-[252px] w-[190px] sm:h-[286px] sm:w-[216px]'
        : 'h-[332px] w-[244px] sm:h-[430px] sm:w-[320px] lg:h-[550px] lg:w-[390px] xl:h-[580px] xl:w-[410px]';
    const iconSize = compact ? 18 : 20;
    const isSide = side !== 'center';
    const photoOpacity = isSide ? 0.18 : 0.24;

    return (
        <motion.div
            className={`group relative overflow-hidden rounded-[34px] border ${cardHeight}`}
            style={{
                borderColor: 'rgba(255,255,255,0.22)',
                background: `linear-gradient(180deg, ${wash.start} 0%, ${wash.end} 100%)`,
                boxShadow: isSide ? '0 26px 80px rgba(0,0,0,0.24)' : `0 34px 96px ${presentation.theme.shadow}`,
            }}
            initial={reducedMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: ENTRY_EASE }}
        >
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.04)_22%,rgba(4,7,14,0.14)_55%,rgba(4,7,14,0.36)_100%)]" />

            <div
                className="absolute inset-0 opacity-70"
                style={{
                    backgroundImage: `radial-gradient(${wash.dot} 0.8px, transparent 1.1px)`,
                    backgroundSize: compact ? '16px 16px' : '20px 20px',
                    backgroundPosition: 'center center',
                }}
            />

            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
                <div
                    className={`${compact ? 'h-[118px] w-[118px]' : 'h-[150px] w-[150px] sm:h-[176px] sm:w-[176px]'} rounded-full blur-[76px]`}
                    style={{ background: wash.glow }}
                />
            </div>

            <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-3 sm:inset-x-5 sm:top-5">
                <span className="rounded-full border border-white/16 bg-[rgba(10,10,12,0.26)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#fff0de] backdrop-blur-md">
                    {plan.days.length} j
                </span>
                {completion > 0 ? (
                    <span className="rounded-full border border-white/16 bg-[rgba(255,255,255,0.10)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#fff7ef] backdrop-blur-md">
                        <span className="inline-flex items-center gap-1.5">
                            <Check size={11} />
                            {completion}%
                        </span>
                    </span>
                ) : (
                    <span className="rounded-full border border-white/14 bg-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[rgba(255,247,239,0.8)] backdrop-blur-md">
                        {presentation.cadence}
                    </span>
                )}
            </div>

            <div className={`absolute inset-x-4 ${compact ? 'top-12 sm:top-14' : 'top-14 sm:top-16 lg:top-18'}`}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[rgba(255,243,224,0.7)]">
                    {presentation.art.eyebrow}
                </p>
                <p className={`mx-auto mt-3 font-display font-bold leading-[0.98] text-[#fffaf2] ${compact ? 'max-w-[8.5ch] text-[21px]' : 'max-w-[10.5ch] text-[28px] sm:max-w-[9ch] sm:text-[32px] lg:text-[38px] xl:text-[40px]'}`}>
                    {plan.name}
                </p>
            </div>

            <div
                className={`pointer-events-none absolute z-10 ${compact
                    ? 'left-1/2 top-[57.5%] -translate-x-1/2 -translate-y-1/2 sm:top-[58.5%]'
                    : 'right-4 top-4 sm:left-1/2 sm:right-auto sm:top-[56%] sm:-translate-x-1/2 sm:-translate-y-1/2 lg:top-[54.5%]'}`}
            >
                <div
                    className="flex items-center justify-center rounded-full border border-white/18 bg-[rgba(255,255,255,0.10)] text-[#fffaf3] backdrop-blur-xl"
                    style={{
                        height: compact ? '66px' : '54px',
                        width: compact ? '66px' : '54px',
                        boxShadow: `0 0 0 ${compact ? '18px' : '14px'} ${wash.halo}, 0 22px 60px rgba(0,0,0,0.22)`,
                    }}
                >
                    <span className="sm:hidden">
                        <PlanSymbol symbolId={presentation.art.symbolId} size={iconSize} />
                    </span>
                    <span className="hidden sm:inline">
                        <PlanSymbol symbolId={presentation.art.symbolId} size={compact ? 18 : 28} />
                    </span>
                </div>
            </div>

            <div className="absolute inset-x-5 bottom-6 text-center">
                <p className={`mx-auto mt-3 max-w-[18ch] leading-relaxed text-[rgba(255,249,241,0.84)] ${compact ? 'text-[11px]' : 'text-[13px] lg:text-[15px]'}`}>
                    {presentation.art.focus}
                </p>
            </div>

            {!compact && (
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 bg-[linear-gradient(180deg,transparent,rgba(6,7,12,0.22)_42%,rgba(6,7,12,0.56)_100%)]" />
            )}
        </motion.div>
    );
}
