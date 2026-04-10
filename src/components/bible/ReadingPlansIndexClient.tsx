'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { type Swiper as SwiperInstance } from 'swiper';
import { A11y, Keyboard } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Lock,
  Sparkles,
  TimerReset,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  getPlanCompletion,
  startOrActivatePlan,
  getActivePlan,
  getFirstUncompletedReading,
} from '../../lib/readingPlans';
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
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    PRIMARY_PLAN_ENTRY?.plan.id ?? null
  );
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);

  const pickerSwiperRef = useRef<SwiperInstance | null>(null);
  const pickerEntriesRef = useRef<PlanEntry[]>([]);

  const pickerEntries = useMemo(
    () => getEntriesForCategory(selectedCategory),
    [selectedCategory]
  );

  const selectedEntry =
    pickerEntries.find((entry) => entry.plan.id === selectedPlanId) ??
    pickerEntries[0] ??
    DEFAULT_PREVIEW_ENTRIES[0] ??
    null;

  const selectedIndex = Math.max(
    0,
    pickerEntries.findIndex((entry) => entry.plan.id === selectedEntry?.plan.id)
  );

  const pickerCanLoop = pickerEntries.length > 1;
  const completion = selectedEntry ? getPlanCompletion(selectedEntry.plan.id) : 0;
  const isLoggedIn = !!user?.id;

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

    return () => media.removeEventListener('change', applyPointerMode);
  }, []);

  useEffect(() => {
    if (!pickerEntries.length) return;

    const hasSelectedPlan = selectedPlanId
      ? pickerEntries.some((entry) => entry.plan.id === selectedPlanId)
      : false;

    if (!hasSelectedPlan) {
      const frame = requestAnimationFrame(() => {
        setSelectedPlanId(pickerEntries[0].plan.id);
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [pickerEntries, selectedPlanId]);

  useEffect(() => {
    pickerEntriesRef.current = pickerEntries;
  }, [pickerEntries]);

  useEffect(() => {
    if (!selectedPlanId || !pickerSwiperRef.current) return;

    const currentIndex = pickerCanLoop
      ? pickerSwiperRef.current.realIndex
      : pickerSwiperRef.current.activeIndex;

    if (currentIndex !== selectedIndex) {
      if (pickerCanLoop) {
        pickerSwiperRef.current.slideToLoop(selectedIndex, reducedMotion ? 0 : 520);
      } else {
        pickerSwiperRef.current.slideTo(selectedIndex, reducedMotion ? 0 : 520);
      }
    }
  }, [pickerCanLoop, reducedMotion, selectedIndex, selectedPlanId]);

  const navigateToPlan = useCallback(
    (planId: string, userId?: string) => {
      startOrActivatePlan(planId, userId);

      const active = getActivePlan();
      setActivePlanId(active?.plan.id ?? planId);

      const next = getFirstUncompletedReading(planId);
      if (next) {
        router.push(`/bible?book=${next.bookId}&chapter=${next.chapter}&plan=${planId}`);
      } else {
        router.push(`/bible/plans/${planId}`);
      }
    },
    [router]
  );

  const handleStartPlan = useCallback(
    (planId: string) => {
      if (!user?.id) {
        setPendingPlanId(planId);
        setShowAuthModal(true);
        return;
      }

      navigateToPlan(planId, user.id);
    },
    [navigateToPlan, user?.id]
  );

  useEffect(() => {
    if (!pendingPlanId || !user?.id) return;

    navigateToPlan(pendingPlanId, user.id);
    setPendingPlanId(null);
    setShowAuthModal(false);
  }, [navigateToPlan, pendingPlanId, user?.id]);

  const handleAuthSuccess = useCallback(() => {
    setShowAuthModal(false);
  }, []);

  const handleTrackCardSelect = useCallback(
    (planId: string, index: number) => {
      setSelectedPlanId(planId);
      if (!pickerSwiperRef.current) return;

      const currentIndex = pickerCanLoop
        ? pickerSwiperRef.current.realIndex
        : pickerSwiperRef.current.activeIndex;

      if (currentIndex !== index) {
        if (pickerCanLoop) {
          pickerSwiperRef.current.slideToLoop(index, reducedMotion ? 0 : 520);
        } else {
          pickerSwiperRef.current.slideTo(index, reducedMotion ? 0 : 520);
        }
      }
    },
    [pickerCanLoop, reducedMotion]
  );

  const handlePickerCardClick = useCallback(
    (planId: string, index: number) => {
      if (isCoarsePointer) {
        handleStartPlan(planId);
        return;
      }

      handleTrackCardSelect(planId, index);
    },
    [handleStartPlan, handleTrackCardSelect, isCoarsePointer]
  );

  const handlePickerCardDoubleClick = useCallback(
    (planId: string) => {
      handleStartPlan(planId);
    },
    [handleStartPlan]
  );

  const handlePickerSwiper = useCallback((swiper: SwiperInstance) => {
    pickerSwiperRef.current = swiper;
  }, []);

  const handlePickerSlideChange = useCallback((swiper: SwiperInstance) => {
    const nextEntry = pickerEntriesRef.current[swiper.realIndex];
    if (nextEntry) {
      setSelectedPlanId(nextEntry.plan.id);
    }
  }, []);

  if (!selectedEntry) return null;

  const primaryCtaLabel = isLoggedIn
    ? getPlanActionLabel(selectedEntry.plan.id, activePlanId)
    : 'Se connecter pour commencer';

  return (
    <>
      <div className="relative overflow-hidden rounded-[40px] border border-[#ece8df] bg-[linear-gradient(180deg,#fffefb_0%,#fbf8f1_50%,#f6f1e8_100%)] text-[#161c35] shadow-[0_40px_120px_rgba(22,28,53,0.10)]">
        <div className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-multiply" style={{ backgroundImage: 'radial-gradient(#161c35 0.8px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(200,159,45,0.10),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(56,125,255,0.06),transparent_20%)]" />
        <div
          className="pointer-events-none absolute -top-20 left-1/2 h-[260px] w-[260px] -translate-x-1/2 rounded-full blur-[110px]"
          style={{ background: selectedEntry.presentation.theme.accentSoft }}
        />

        <div className="relative z-10 border-b border-[#ece8df] px-5 py-6 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Link
                href="/bible"
                className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#161c35]/40 transition-colors hover:text-[#c89f2d]"
              >
                <ArrowLeft size={14} />
                Retour à la Parole
              </Link>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#eadfca] bg-white/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#b88922] shadow-sm">
                  <Sparkles size={12} />
                  Parcours guidés
                </div>

                <h1 className="mt-4 font-display text-[34px] font-black leading-[0.96] tracking-tight text-[#161c35] sm:text-[44px] lg:text-[52px]">
                  Bâtissez une
                  <span className="block text-[#c89f2d]">discipline de Parole</span>
                </h1>

                <p className="mt-4 max-w-[44ch] text-[15px] leading-relaxed text-[#161c35]/62 sm:text-[16px]">
                  Choisissez un parcours, avancez jour après jour, et gardez votre progression synchronisée avec votre compte.
                </p>
              </div>
            </div>

            {activePlanId ? (
              <button
                onClick={() => handleStartPlan(activePlanId)}
                className="inline-flex items-center gap-2 rounded-full bg-[#161c35] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-[#161c35]/15 transition-transform hover:scale-105 active:scale-95"
              >
                Continuer le parcours
                <ArrowUpRight size={15} />
              </button>
            ) : null}
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`rounded-full px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] transition-all ${
                selectedCategory === 'all'
                  ? 'bg-[#c89f2d] text-white shadow-md shadow-[#c89f2d]/20'
                  : 'bg-[#161c35]/5 text-[#161c35]/50 hover:bg-[#161c35]/10'
              }`}
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
                  className={`rounded-full px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] transition-all ${
                    isActive
                      ? 'bg-[#c89f2d] text-white shadow-md shadow-[#c89f2d]/20'
                      : 'bg-[#161c35]/5 text-[#161c35]/50 hover:bg-[#161c35]/10'
                  }`}
                >
                  {group.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 px-4 pb-6 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
          <div className="relative mx-auto w-full max-w-[1380px] lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:gap-8 xl:grid-cols-[minmax(0,1fr)_470px] xl:gap-10">
            <div>
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

            <motion.aside
              key={selectedEntry.plan.id}
              className="mx-auto -mt-2 max-w-[560px] text-center sm:-mt-6 lg:mx-0 lg:mt-0 lg:max-w-none"
              initial={reducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.36, ease: ENTRY_EASE }}
            >
              <div className="overflow-hidden rounded-[34px] border border-[#ece8df] bg-white/90 shadow-[0_25px_60px_rgba(22,28,53,0.08)] backdrop-blur-sm">
                <div className="relative px-6 py-6 sm:px-8 sm:py-8 lg:text-left">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(200,159,45,0.08),rgba(255,255,255,0))]" />

                  <div className="relative">
                    <div className="flex items-center justify-center gap-2 lg:justify-start">
                      <span className="rounded-full bg-[#161c35]/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#161c35]/40">
                        {selectedIndex + 1} / {pickerEntries.length}
                      </span>
                      {!isLoggedIn ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#eadfca] bg-[#fff8ec] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#b88922]">
                          <Lock size={11} />
                          Connexion requise
                        </span>
                      ) : null}
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

                    <h2 className="mt-6 font-display text-[32px] font-black leading-[1.02] tracking-tight text-[#161c35] sm:text-[42px] lg:text-[48px] xl:text-[52px]">
                      {selectedEntry.plan.name}
                    </h2>

                    <p className="mx-auto mt-4 max-w-[32ch] text-[14px] leading-relaxed text-[#161c35]/60 sm:text-[15px] lg:mx-0 lg:max-w-[24ch] lg:text-[17px]">
                      {selectedEntry.presentation.art.focus}
                    </p>

                    <div className="mt-6 grid gap-3">
                      <div className="rounded-[24px] border border-[#ece8df] bg-[#fcfaf6] px-4 py-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#b88922]">
                          <TimerReset size={13} />
                          Rythme
                        </div>
                        <p className="mt-2 text-sm font-semibold text-[#161c35]">
                          {selectedEntry.presentation.cadence}
                        </p>
                      </div>

                      <div className="rounded-[24px] border border-[#ece8df] bg-white px-4 py-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#161c35]/45">
                          <CheckCircle2 size={13} />
                          Progression
                        </div>
                        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#161c35]/8">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,#c89f2d,#e0b44b)] transition-all duration-500"
                            style={{ width: `${completion}%` }}
                          />
                        </div>
                        <p className="mt-2 text-sm font-semibold text-[#161c35]">
                          {completion}% complété
                        </p>
                      </div>

                      <div className="rounded-[24px] border border-[#ece8df] bg-white px-4 py-4">
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#161c35]/45">
                          <BookOpen size={13} />
                          Expérience
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-[#161c35]/68">
                          Reprenez exactement là où vous vous êtes arrêté, avec une progression liée à votre compte.
                        </p>
                      </div>
                    </div>

                    <motion.button
                      type="button"
                      onClick={() => handleStartPlan(selectedEntry.plan.id)}
                      className="mt-8 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#161c35] px-7 py-4 text-[14px] font-bold uppercase tracking-widest text-white shadow-xl shadow-[#161c35]/20 lg:text-[15px]"
                      whileHover={reducedMotion ? undefined : { y: -4, scale: 1.02 }}
                      whileTap={reducedMotion ? undefined : { scale: 0.985 }}
                    >
                      {primaryCtaLabel}
                      <ArrowUpRight size={18} strokeWidth={2.6} />
                    </motion.button>

                    {!isLoggedIn ? (
                      <p className="mt-3 text-center text-[12px] leading-relaxed text-[#161c35]/45 lg:text-left">
                        Connectez-vous pour sauvegarder votre avancée, reprendre vos lectures sur tous vos appareils et garder votre discipline enracinée.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </motion.aside>
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          setPendingPlanId(null);
        }}
        initialMode="register"
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}
