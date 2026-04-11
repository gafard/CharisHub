'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Haptics } from '@/lib/haptics';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CloudRain,
  TreePine,
  Sunrise,
  Waves,
  Music,
  Leaf,
  Wind,
  Heart,
  Droplets,
  Smile,
  Users,
  Target,
  Sun,
  X,
  type LucideIcon,
} from 'lucide-react';

import { formatDayReadingsLabel, type PlanReading } from '../../lib/readingPlans';
import {
  type PrayerFlowStep,
  savePrayerFlowSession,
  savePrayerFlowToJournal,
} from '../../lib/prayerFlowStore';

import { usePrayerFlowTimer } from './usePrayerFlowTimer';
import { usePrayerAmbientAudio } from './usePrayerAmbientAudio';
import PrayerStepProgress from './PrayerStepProgress';
import PrayerStepCard from './PrayerStepCard';
import PrayerFinishSummary from './PrayerFinishSummary';

const STEP_TARGET_SEC = 120;

const AMBIENT_SOUNDS = [
  { id: 'none', label: 'Silence', icon: Wind, url: '' },
  { id: 'rain', label: 'Pluie douce', icon: CloudRain, url: '/sounds/rain.mp3' },
  { id: 'forest', label: 'Forêt', icon: TreePine, url: '/sounds/forest.mp3' },
  { id: 'elysian', label: 'Élysée', icon: Sunrise, url: '/sounds/Elysian.mp3' },
  { id: 'mediterranean', label: 'Méditerranée', icon: Waves, url: '/sounds/mediterranean.mp3' },
  { id: 'eastern', label: 'Orient', icon: Music, url: '/sounds/eastern.mp3' },
  { id: 'harvest', label: 'Récolte', icon: Leaf, url: '/sounds/harvest.mp3' },
  { id: 'celtica', label: 'Celtique', icon: Leaf, url: '/sounds/celtica.mp3' },
] satisfies Array<{ id: string; label: string; icon: LucideIcon; url: string }>;

const STEP_THEME: Record<
  string,
  {
    accent: string;
    accentLight: string;
    ring: string;
    icon: LucideIcon;
  }
> = {
  adoration: {
    accent: '#f59e0b',
    accentLight: 'rgba(245,158,11,0.08)',
    ring: 'stroke-amber-400',
    icon: Heart,
  },
  repentance: {
    accent: '#8b5cf6',
    accentLight: 'rgba(139,92,246,0.08)',
    ring: 'stroke-violet-400',
    icon: Droplets,
  },
  gratitude: {
    accent: '#10b981',
    accentLight: 'rgba(16,185,129,0.08)',
    ring: 'stroke-emerald-400',
    icon: Smile,
  },
  intercession: {
    accent: '#0ea5e9',
    accentLight: 'rgba(14,165,233,0.08)',
    ring: 'stroke-sky-400',
    icon: Users,
  },
  engagement: {
    accent: '#f43f5e',
    accentLight: 'rgba(244,63,94,0.08)',
    ring: 'stroke-rose-400',
    icon: Target,
  },
};

interface GuidedPrayerFlowProps {
  isOpen: boolean;
  steps: PrayerFlowStep[];
  planId: string;
  dayIndex: number;
  readings: PlanReading[];
  onComplete: () => void;
  onClose: () => void;
}

function formatTimer(sec: number) {
  const safe = Math.max(0, sec);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function GuidedPrayerFlow({
  isOpen,
  steps: initialSteps,
  planId,
  dayIndex,
  readings,
  onComplete,
  onClose,
}: GuidedPrayerFlowProps) {
  const [steps, setSteps] = useState<PrayerFlowStep[]>(initialSteps);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [sessionDurationSec, setSessionDurationSec] = useState(0);

  const {
    isRunning,
    setIsRunning,
    elapsed,
    sessionElapsed,
    resetSession,
    resetStep,
    stopTimer,
    getSessionDuration,
  } = usePrayerFlowTimer({
    isOpen,
    finished,
    autoStart: true,
  });

  const {
    ambientId,
    showSounds,
    setShowSounds,
    selectSound,
    stopAudio,
  } = usePrayerAmbientAudio({
    isOpen,
    sounds: AMBIENT_SOUNDS,
    initialSoundId: 'none',
  });

  const currentStep = steps[currentIndex];
  const theme = STEP_THEME[currentStep?.type] || STEP_THEME.adoration;
  const readingSummary = useMemo(() => formatDayReadingsLabel(readings), [readings]);

  useEffect(() => {
    if (!isOpen) return;
    setSteps(initialSteps);
    setCurrentIndex(0);
    setFinished(false);
    setFinishing(false);
    setSessionDurationSec(0);
    resetSession();
  }, [initialSteps, isOpen, resetSession]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    stopTimer();
    stopAudio();
    setIsRunning(false);
    onClose();
  }, [onClose, setIsRunning, stopAudio, stopTimer]);

  const goToNextStep = useCallback(() => {
    if (currentIndex < steps.length - 1) {
      Haptics.medium();
      setCurrentIndex((prev) => prev + 1);
      resetStep();
      return;
    }

    setIsRunning(false);
    stopTimer();
    const total = getSessionDuration();
    setSessionDurationSec(total);
    setFinished(true);
  }, [currentIndex, getSessionDuration, resetStep, setIsRunning, steps.length, stopTimer]);

  const handleChangeNote = useCallback(
    (value: string) => {
      setSteps((prev) => {
        const next = [...prev];
        next[currentIndex] = {
          ...next[currentIndex],
          userNote: value,
        };
        return next;
      });
    },
    [currentIndex]
  );

  const handleValidateStep = useCallback(() => {
    setSteps((prev) => {
      const next = [...prev];
      next[currentIndex] = {
        ...next[currentIndex],
        completed: true,
        durationSec: elapsed,
      };
      return next;
    });

    goToNextStep();
  }, [currentIndex, elapsed, goToNextStep]);

  const handleFinish = useCallback(() => {
    if (finishing) return;

    setFinishing(true);
    Haptics.success();
    stopTimer();
    stopAudio();

    const totalDuration = getSessionDuration();

    const session = savePrayerFlowSession({
      planId,
      dayIndex,
      readings,
      readingSummary,
      steps,
      totalDurationSec: totalDuration,
    });

    savePrayerFlowToJournal(session);
    onComplete();
  }, [
    dayIndex,
    finishing,
    getSessionDuration,
    onComplete,
    planId,
    readingSummary,
    readings,
    steps,
    stopAudio,
    stopTimer,
  ]);

  if (!isOpen) return null;

  const progress = Math.min(elapsed / STEP_TARGET_SEC, 1);

  return (
    <div className="fixed inset-0 z-[20001] flex flex-col items-center overflow-y-auto pb-10">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-[#06080d]/92 backdrop-blur-3xl"
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.14, 0.22, 0.14] }}
          transition={{ duration: 12, repeat: Infinity }}
          className="absolute -left-20 -top-20 h-[600px] w-[600px] rounded-full blur-[140px]"
          style={{ backgroundColor: theme.accent }}
        />
        <div className="absolute -right-20 -bottom-20 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[130px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative flex w-full max-w-2xl flex-col bg-transparent px-6 py-8 sm:px-8 sm:py-10"
      >
        <div className="mb-10 flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex flex-col gap-3">
              <div
                className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]"
                style={{ color: theme.accent }}
              >
                <span>{finished ? 'Accompli' : `Phase ${currentIndex + 1} / ${steps.length}`}</span>
              </div>

              <h2 className="font-display text-3xl font-black tracking-tight text-white sm:text-5xl">
                {finished ? 'Moment de Paix' : currentStep?.label}
              </h2>

              <div className="flex items-center gap-2 text-[13px] font-semibold text-white/45">
                <Sun size={14} className="opacity-60" />
                <span>{readingSummary}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="group grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/60 transition-all hover:bg-white/[0.08] hover:text-white"
            aria-label="Quitter"
          >
            <X size={20} className="transition group-hover:rotate-90" />
          </button>
        </div>

        <PrayerStepProgress
          steps={steps}
          currentIndex={currentIndex}
          finished={finished}
          progress={progress}
          themes={STEP_THEME}
        />

        <div className="relative flex-1 overflow-visible">
          <AnimatePresence mode="wait">
            {finished ? (
              <PrayerFinishSummary
                steps={steps}
                sessionDurationSec={sessionDurationSec}
                themes={STEP_THEME}
                finishing={finishing}
                onFinish={handleFinish}
              />
            ) : currentStep ? (
              <PrayerStepCard
                step={currentStep}
                currentIndex={currentIndex}
                totalSteps={steps.length}
                elapsed={elapsed}
                targetSec={STEP_TARGET_SEC}
                isRunning={isRunning}
                showSounds={showSounds}
                ambientId={ambientId}
                sounds={AMBIENT_SOUNDS}
                theme={theme}
                onToggleRunning={() => setIsRunning((prev) => !prev)}
                onToggleSounds={() => setShowSounds((prev) => !prev)}
                onSelectSound={selectSound}
                onChangeNote={handleChangeNote}
                onSkip={goToNextStep}
                onValidate={handleValidateStep}
              />
            ) : null}
          </AnimatePresence>
        </div>
      </motion.div>

      {!finished ? (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-0 left-0 right-0 flex justify-center pb-6"
        >
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[#0c0e14]/80 px-5 py-2.5 shadow-2xl backdrop-blur-xl">
            <div className="h-2 w-2 rounded-full animate-pulse bg-orange-400" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/50">
              Session en cours
            </span>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-sm font-black text-white tabular-nums">
              {formatTimer(sessionElapsed)}
            </span>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
