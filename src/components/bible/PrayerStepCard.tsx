'use client';

import { motion } from 'framer-motion';
import { Check, Pause, Play, SkipForward, Volume2, VolumeX } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PrayerFlowStep } from '../../lib/prayerFlowStore';
import PrayerAmbientPicker from './PrayerAmbientPicker';

type AmbientSound = {
  id: string;
  label: string;
  icon: LucideIcon;
  url: string;
  isYoutube?: boolean;
};

type PrayerStepCardProps = {
  step: PrayerFlowStep;
  currentIndex: number;
  totalSteps: number;
  elapsed: number;
  targetSec: number;
  isRunning: boolean;
  showSounds: boolean;
  ambientId: string;
  sounds: AmbientSound[];
  theme: {
    accent: string;
    ring: string;
  };
  onToggleRunning: () => void;
  onToggleSounds: () => void;
  onSelectSound: (id: string) => void;
  onChangeNote: (value: string) => void;
  onSkip: () => void;
  onValidate: () => void;
};

function formatTimer(sec: number) {
  const safe = Math.max(0, sec);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PrayerStepCard({
  step,
  currentIndex,
  totalSteps,
  elapsed,
  targetSec,
  isRunning,
  showSounds,
  ambientId,
  sounds,
  theme,
  onToggleRunning,
  onToggleSounds,
  onSelectSound,
  onChangeNote,
  onSkip,
  onValidate,
}: PrayerStepCardProps) {
  const circleR = 50;
  const circleC = 2 * Math.PI * circleR;
  const progress = Math.min(elapsed / targetSec, 1);
  const dashOffset = circleC * (1 - progress);
  const isTargetReached = elapsed >= targetSec;

  return (
    <motion.div
      key={currentIndex}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex flex-col gap-8"
    >
      <div className="group relative overflow-hidden rounded-[42px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))] p-10 shadow-2xl transition-all hover:border-white/20">
        <div className="relative z-10 space-y-6">
          <div className="space-y-4">
            <div className="h-0.5 w-12 rounded-full opacity-30" style={{ backgroundColor: theme.accent }} />
            <p className="whitespace-pre-line text-2xl font-black leading-relaxed tracking-tight text-white sm:text-3xl">
              {step.prompt}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center">
        <div className="relative h-48 w-48">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={circleR} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
            <motion.circle
              cx="60"
              cy="60"
              r={circleR}
              fill="none"
              className={theme.ring}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={circleC}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ type: 'tween', ease: 'linear' }}
              style={{ filter: `drop-shadow(0 0 8px ${theme.accent}40)` }}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-black tracking-tighter text-white tabular-nums">
              {formatTimer(elapsed)}
            </span>

            <motion.div
              animate={isTargetReached ? { scale: [1, 1.08, 1] } : {}}
              className={`mt-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.25em] ${
                isTargetReached ? 'text-emerald-400' : 'text-white/30'
              }`}
            >
              {isTargetReached ? (
                <>
                  <Check size={10} strokeWidth={4} />
                  Objectif
                </>
              ) : (
                `obj. ${targetSec / 60}m`
              )}
            </motion.div>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-6">
          <button
            onClick={onToggleRunning}
            className="grid h-20 w-20 place-items-center rounded-[28px] bg-surface text-slate-950 shadow-2xl transition-all hover:scale-105 active:scale-95"
          >
            {isRunning ? <Pause size={32} fill="currentColor" /> : <Play size={32} className="ml-1" fill="currentColor" />}
          </button>

          <button
            onClick={onToggleSounds}
            className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/60 transition-all hover:bg-white/10 hover:text-white"
          >
            {ambientId !== 'none' ? <Volume2 size={24} /> : <VolumeX size={24} />}
          </button>
        </div>
      </div>

      <PrayerAmbientPicker
        open={showSounds}
        sounds={sounds}
        selectedId={ambientId}
        onSelect={onSelectSound}
      />

      <div className="group rounded-[34px] border border-white/10 bg-white/[0.02] p-1 transition-all focus-within:border-white/20 focus-within:bg-white/[0.04]">
        <textarea
          value={step.userNote || ''}
          onChange={(e) => onChangeNote(e.target.value)}
          placeholder="Notez une pensée ou une prière ici..."
          className="h-32 w-full resize-none bg-transparent px-6 py-5 text-base font-medium leading-relaxed text-white outline-none placeholder:text-white/20"
        />
      </div>

      <div className="flex items-center gap-4 pb-10">
        <button
          onClick={onSkip}
          className="flex h-16 flex-1 items-center justify-center gap-2 rounded-[26px] border border-white/10 bg-white/5 text-[15px] font-black text-white/60 transition-all hover:bg-white/10 hover:text-white active:scale-95"
        >
          <SkipForward size={18} />
          <span>Passer</span>
        </button>

        <button
          onClick={onValidate}
          className="relative flex h-16 flex-[2] items-center justify-center gap-2 rounded-[26px] bg-[#fffcf9] text-[16px] font-black text-slate-950 shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Check size={20} strokeWidth={4} />
          <span>{currentIndex === totalSteps - 1 ? 'Terminer' : 'Amen, suivant'}</span>
        </button>
      </div>
    </motion.div>
  );
}
