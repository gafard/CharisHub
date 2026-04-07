'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { type Swiper as SwiperInstance } from 'swiper';
import { A11y, Keyboard } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import { ArrowLeft, ArrowUpRight, Lock, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getPlanCompletion, startOrActivatePlan, getActivePlan, getFirstUncompletedReading, isUserRegistered } from '../../lib/readingPlans';
import { useAuth } from '../../contexts/AuthContext';
import AuthModal from '../AuthModal';
import { PLAN_GROUPS } from '../../lib/readingPlanVisuals';
import {
    DEFAULT_PREVIEW_ENTRIES,
    ENTRY_EASE,
    PRIMARY_PLAN_ENTRY,
    PlanStageCard,
    getEntriesForCategory,
    getPlanActionLabel,
    type CategoryFilter,
    type PlanEntry,
} from './readingPlanUi';

export default function ReadingPlansIndexClient() {
    const router = useRouter();
    const { user } = useAuth();
    const reducedMotion = useReducedMotion();
    const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(PRIMARY_PLAN_ENTRY?.plan.id ?? null);
    const [activePlanId, setActivePlanId] = useState<string | null>(null);
    const [isCoarsePointer, setIsCoarsePointer] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
    const pickerSwiperRef = useRef<SwiperInstance | null>(null);
    const pickerEntriesRef = useRef<PlanEntry[]>([]);

    const pickerEntries = getEntriesForCategory(selectedCategory);
    const selectedEntry = pickerEntries.find((entry) => entry.plan.id === selectedPlanId) ?? pickerEntries[0] ?? DEFAULT_PREVIEW_ENTRIES[0] ?? null;
    const selectedIndex = Math.max(0, pickerEntries.findIndex((entry) => entry.plan.id === selectedEntry?.plan.id));
    const pickerCanLoop = pickerEntries.length > 1;

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            const active = getActivePlan();
            setActivePlanId(active?.plan.id ?? null);
            if (active?.plan.id) {
                setSelectedPlanId((current) => current ?? active.plan.id);
            }
        });

        return () => cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

        const media = window.matchMedia('(pointer: coarse)');
        const applyPointerMode = () => setIsCoarsePointer(media.matches);
        applyPointerMode();
        media.addEventListener('change', applyPointerMode);

        return () => {
            media.removeEventListener('change', applyPointerMode);
        };
    }, []);

    useEffect(() => {
        const nextEntries = getEntriesForCategory(selectedCategory);
        if (!nextEntries.length) return;
        const hasSelectedPlan = selectedPlanId ? nextEntries.some((entry) => entry.plan.id === selectedPlanId) : false;
        if (!hasSelectedPlan) {
            const frame = requestAnimationFrame(() => {
                setSelectedPlanId(nextEntries[0].plan.id);
            });

            return () => cancelAnimationFrame(frame);
        }
    }, [selectedCategory, selectedPlanId]);

    useEffect(() => {
        pickerEntriesRef.current = pickerEntries;
    }, [pickerEntries]);

    useEffect(() => {
        if (!selectedPlanId || !pickerSwiperRef.current) return;

        const currentIndex = pickerCanLoop ? pickerSwiperRef.current.realIndex : pickerSwiperRef.current.activeIndex;
        if (currentIndex !== selectedIndex) {
            if (pickerCanLoop) {
                pickerSwiperRef.current.slideToLoop(selectedIndex, reducedMotion ? 0 : 520);
            } else {
                pickerSwiperRef.current.slideTo(selectedIndex, reducedMotion ? 0 : 520);
            }
        }
    }, [pickerCanLoop, reducedMotion, selectedIndex, selectedPlanId]);

    const handleStartPlan = useCallback((planId: string) => {
        // Vérifier si l'utilisateur est connecté avec Supabase Auth
        if (!user) {
            setPendingPlanId(planId);
            setShowAuthModal(true);
            return;
        }

        startOrActivatePlan(planId);
        const next = getFirstUncompletedReading(planId);
        if (next) {
            router.push(`/bible?book=${next.bookId}&chapter=${next.chapter}&plan=${planId}`);
        } else {
            router.push(`/bible/plans/${planId}`);
        }
    }, [router, user]);

    const handleAuthSuccess = useCallback(() => {
        setShowAuthModal(false);
        if (pendingPlanId) {
            startOrActivatePlan(pendingPlanId);
            const next = getFirstUncompletedReading(pendingPlanId);
            if (next) {
                router.push(`/bible?book=${next.bookId}&chapter=${next.chapter}&plan=${pendingPlanId}`);
            }
            setPendingPlanId(null);
        }
    }, [pendingPlanId, router]);

    const handleTrackCardSelect = useCallback((planId: string, index: number) => {
        setSelectedPlanId(planId);
        if (!pickerSwiperRef.current) return;

        const currentIndex = pickerCanLoop ? pickerSwiperRef.current.realIndex : pickerSwiperRef.current.activeIndex;
        if (currentIndex !== index) {
            if (pickerCanLoop) {
                pickerSwiperRef.current.slideToLoop(index, reducedMotion ? 0 : 520);
            } else {
                pickerSwiperRef.current.slideTo(index, reducedMotion ? 0 : 520);
            }
        }
    }, [pickerCanLoop, reducedMotion]);

    const handlePickerCardClick = useCallback((planId: string, index: number) => {
        if (isCoarsePointer) {
            handleStartPlan(planId);
            return;
        }

        handleTrackCardSelect(planId, index);
    }, [handleStartPlan, handleTrackCardSelect, isCoarsePointer]);

    const handlePickerCardDoubleClick = useCallback((planId: string) => {
        handleStartPlan(planId);
    }, [handleStartPlan]);

    const handlePickerSwiper = useCallback((swiper: SwiperInstance) => {
        pickerSwiperRef.current = swiper;
    }, []);

    function handlePickerSlideChange(swiper: SwiperInstance) {
        const nextEntry = pickerEntriesRef.current[swiper.realIndex];
        if (nextEntry) {
            setSelectedPlanId(nextEntry.plan.id);
        }
    }

    if (!selectedEntry) {
        return null;
    }

    return (
        <>
        <div className="relative overflow-hidden rounded-[36px] border border-[#e8ebf1] bg-[linear-gradient(180deg,#ffffff_0%,#fbf9f5_58%,#f6f4f0_100%)] text-[#161c35] shadow-[0_32px_120px_rgba(22,28,53,0.08)]">
            <div className="pointer-events-none absolute inset-0 opacity-[0.02] mix-blend-multiply" style={{ backgroundImage: 'radial-gradient(#161c35 0.8px, transparent 1px)', backgroundSize: '24px 24px', backgroundPosition: 'center center' }} />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(200,159,45,0.08),transparent_26%),radial-gradient(circle_at_bottom,rgba(56,125,255,0.05),transparent_22%)]" />

            <div className="relative z-10 border-b border-[#e8ebf1] px-5 py-5 sm:px-8 lg:px-10">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-3">
                        <Link href="/bible" className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#161c35]/40 transition-colors hover:text-[#c89f2d]">
                            <ArrowLeft size={14} />
                            Retour à la Parole
                        </Link>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#c89f2d]">
                                Exploration spirituelle
                            </p>
                            <h1 className="mt-3 font-display text-[34px] font-black leading-[0.98] text-[#161c35] sm:text-[42px] lg:text-[52px] tracking-tight">
                                Méditez la <span className="text-[#c89f2d]">Parole</span>
                            </h1>
                            <p className="mt-3 max-w-[36ch] text-[14px] leading-relaxed text-[#161c35]/60 sm:text-[15px]">
                                Choisissez un rythme qui vous correspond pour être nourri chaque jour.
                            </p>
                        </div>
                    </div>

                    {activePlanId && (
                        <button
                            onClick={() => handleStartPlan(activePlanId)}
                            className="inline-flex items-center gap-2 rounded-full bg-[#161c35] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-[#161c35]/15 transition-transform hover:scale-105 active:scale-95"
                        >
                            Continuer le parcours
                            <ArrowUpRight size={15} />
                        </button>
                    )}
                </div>

                <div className="mt-8 flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setSelectedCategory('all')}
                        className={`rounded-full px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] transition-all ${selectedCategory === 'all' ? 'bg-[#c89f2d] text-white shadow-md shadow-[#c89f2d]/20' : 'bg-[#161c35]/5 text-[#161c35]/50 hover:bg-[#161c35]/10'}`}
                    >
                        Tous
                    </button>
                    {PLAN_GROUPS.map((group) => {
                        const isActive = selectedCategory === group.id;
                        return (
                            <button
                                key={group.id}
                                type="button"
                                onClick={() => setSelectedCategory(group.id)}
                                className={`rounded-full px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] transition-all ${isActive ? 'bg-[#c89f2d] text-white shadow-md shadow-[#c89f2d]/20' : 'bg-[#161c35]/5 text-[#161c35]/50 hover:bg-[#161c35]/10'}`}
                            >
                                {group.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="relative z-10 px-4 pb-6 pt-5 sm:px-6 lg:px-8 lg:pb-8 lg:pt-7">
                <div className="relative mx-auto w-full max-w-[1360px] lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-center lg:gap-8 xl:grid-cols-[minmax(0,1fr)_430px] xl:gap-10">
                    <div>
                        <div className="pointer-events-none absolute left-1/2 top-[24%] h-[220px] w-[220px] -translate-x-1/2 rounded-full blur-[90px] sm:h-[280px] sm:w-[280px]" style={{ background: selectedEntry.presentation.theme.accentSoft }} />
                        <div className="relative h-[438px] overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)] sm:h-[530px] lg:h-[660px] lg:rounded-[34px] lg:px-10 lg:[mask-image:none] xl:px-14">
                            <Swiper
                                modules={[A11y, Keyboard]}
                                onSwiper={handlePickerSwiper}
                                onSlideChange={handlePickerSlideChange}
                                centeredSlides={true}
                                grabCursor={true}
                                keyboard={{ enabled: true }}
                                slidesPerView="auto"
                                initialSlide={selectedIndex}
                                loop={pickerCanLoop}
                                speed={reducedMotion ? 0 : 520}
                                watchSlidesProgress={true}
                                slideToClickedSlide={true}
                                resistanceRatio={0.82}
                                className="reading-plan-swiper h-full"
                                breakpoints={{
                                    0: { spaceBetween: -42 },
                                    640: { spaceBetween: -74 },
                                    1024: { spaceBetween: -148 },
                                    1360: { spaceBetween: -176 },
                                }}
                            >
                                {pickerEntries.map((entry, index) => {
                                    const offset = index - selectedIndex;
                                    const distance = Math.min(Math.abs(offset), 3);
                                    const isSelected = entry.plan.id === selectedEntry.plan.id;
                                    const cardClassName = isSelected
                                        ? 'reading-plan-slide-card is-selected'
                                        : distance === 1
                                            ? `reading-plan-slide-card ${offset < 0 ? 'is-left' : 'is-right'}`
                                            : 'reading-plan-slide-card is-distant';

                                    return (
                                        <SwiperSlide
                                            key={entry.plan.id}
                                            className="!h-[438px] !w-[204px] sm:!h-[530px] sm:!w-[264px] lg:!h-[660px] lg:!w-[392px] xl:!w-[420px]"
                                        >
                                            <button
                                                type="button"
                                                data-plan-id={entry.plan.id}
                                                onClick={() => handlePickerCardClick(entry.plan.id, index)}
                                                onDoubleClick={() => handlePickerCardDoubleClick(entry.plan.id)}
                                                aria-label={`Choisir le parcours ${entry.plan.name}`}
                                                className="flex h-full w-full items-start justify-center focus:outline-none"
                                            >
                                                <div className={cardClassName}>
                                                    <PlanStageCard
                                                        entry={entry}
                                                        completion={getPlanCompletion(entry.plan.id)}
                                                        reducedMotion={Boolean(reducedMotion)}
                                                        priority={isSelected}
                                                        side={isSelected ? 'center' : offset < 0 ? 'left' : 'right'}
                                                    />
                                                </div>
                                            </button>
                                        </SwiperSlide>
                                    );
                                })}
                            </Swiper>
                        </div>
                    </div>

                    <motion.div
                        key={selectedEntry.plan.id}
                        className="mx-auto -mt-2 max-w-[540px] text-center sm:-mt-6 lg:mx-0 lg:mt-0 lg:max-w-none lg:self-center lg:rounded-[40px] lg:border lg:border-[#e8ebf1] lg:bg-white lg:px-8 lg:py-10 lg:text-left lg:shadow-xl lg:shadow-[#161c35]/5 xl:px-9"
                        initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.36, ease: ENTRY_EASE }}
                    >
                        <div className="flex items-center justify-center gap-2 lg:justify-start">
                            <span className="rounded-full bg-[#161c35]/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#161c35]/40">
                                {selectedIndex + 1} / {pickerEntries.length}
                            </span>
                        </div>

                        <div className="mt-5 flex items-center justify-center gap-2 lg:justify-start">
                            {pickerEntries.map((entry, index) => {
                                const isActive = index === selectedIndex;
                                return (
                                    <button
                                        key={entry.plan.id}
                                        type="button"
                                        onClick={() => handleTrackCardSelect(entry.plan.id, index)}
                                        aria-label={`Aller au parcours ${index + 1}`}
                                        className="rounded-full transition-all"
                                        style={{
                                            width: isActive ? '28px' : '7px',
                                            height: '7px',
                                            background: isActive ? '#c89f2d' : '#161c35',
                                            opacity: isActive ? 1 : 0.1,
                                        }}
                                    />
                                );
                            })}
                        </div>

                        <h2 className="mt-6 font-display text-[32px] font-black leading-[1.02] text-[#161c35] sm:text-[42px] lg:text-[48px] xl:text-[54px] tracking-tight">
                            {selectedEntry.plan.name}
                        </h2>
                        <p className="mx-auto mt-4 max-w-[32ch] text-[14px] leading-relaxed text-[#161c35]/60 sm:text-[15px] lg:mx-0 lg:max-w-[22ch] lg:text-[17px]">
                            {selectedEntry.presentation.art.focus}
                        </p>

                        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.24em] text-[#c89f2d]">
                            {selectedEntry.presentation.cadence}
                        </p>

                        <motion.button
                            type="button"
                            onClick={() => handleStartPlan(selectedEntry.plan.id)}
                            className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#161c35] px-7 py-4 text-[14px] font-bold uppercase tracking-widest text-white shadow-xl shadow-[#161c35]/20 lg:px-8 lg:py-4.5 lg:text-[15px]"
                            whileHover={reducedMotion ? undefined : { y: -4, scale: 1.02 }}
                            whileTap={reducedMotion ? undefined : { scale: 0.985 }}
                        >
                            {getPlanActionLabel(selectedEntry.plan.id, activePlanId)}
                            <ArrowUpRight size={18} strokeWidth={2.6} />
                        </motion.button>
                    </motion.div>
                </div>
            </div>
        </div>

        {/* Modal d'authentification requise */}
        <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            initialMode="register"
        />
    </>
);
