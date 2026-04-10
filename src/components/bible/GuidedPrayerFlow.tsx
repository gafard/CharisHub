'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    X, Play, Pause, Check, Volume2, VolumeX, SkipForward,
    CloudRain, TreePine, Sunrise, Waves, Music, Leaf, Wind,
    Heart, Droplets, Smile, Users, Target, Sun, Info
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatDayReadingsLabel, type PlanReading } from '../../lib/readingPlans';
import { type PrayerFlowStep, savePrayerFlowSession, savePrayerFlowToJournal } from '../../lib/prayerFlowStore';

/* ─── Same sounds as PrayerTimer in the journal ─── */
const AMBIENT_SOUNDS = [
    { id: 'none', label: 'Silence', icon: Wind, url: '' },
    { id: 'rain', label: 'Pluie douce', icon: CloudRain, url: '/sounds/rain.mp3' },
    { id: 'forest', label: 'Forêt', icon: TreePine, url: '/sounds/forest.mp3' },
    { id: 'elysian', label: 'Élysée', icon: Sunrise, url: '/sounds/Elysian.mp3' },
    { id: 'mediterranean', label: 'Méditerranée', icon: Waves, url: '/sounds/mediterranean.mp3' },
    { id: 'eastern', label: 'Orient', icon: Music, url: '/sounds/eastern.mp3' },
    { id: 'harvest', label: 'Récolte', icon: Leaf, url: '/sounds/harvest.mp3' },
    { id: 'celtica', label: 'Celtique', icon: Leaf, url: '/sounds/celtica.mp3' },
];

const STEP_TARGET_SEC = 120;

const STEP_THEME: Record<string, { accent: string; accentLight: string; bg: string; ring: string; icon: LucideIcon }> = {
    adoration: { accent: '#f59e0b', accentLight: 'rgba(245,158,11,0.08)', bg: 'from-amber-100/30 to-orange-50/20 dark:from-amber-600/10 dark:to-orange-500/5', ring: 'stroke-amber-400', icon: Heart },
    repentance: { accent: '#8b5cf6', accentLight: 'rgba(139,92,246,0.08)', bg: 'from-violet-100/30 to-purple-50/20 dark:from-violet-600/10 dark:to-purple-500/5', ring: 'stroke-violet-400', icon: Droplets },
    gratitude: { accent: '#10b981', accentLight: 'rgba(16,185,129,0.08)', bg: 'from-emerald-100/30 to-teal-50/20 dark:from-emerald-600/10 dark:to-teal-500/5', ring: 'stroke-emerald-400', icon: Smile },
    intercession: { accent: '#0ea5e9', accentLight: 'rgba(14,165,233,0.08)', bg: 'from-sky-100/30 to-blue-50/20 dark:from-sky-600/10 dark:to-blue-500/5', ring: 'stroke-sky-400', icon: Users },
    engagement: { accent: '#f43f5e', accentLight: 'rgba(244,63,94,0.08)', bg: 'from-rose-100/30 to-pink-50/20 dark:from-rose-600/10 dark:to-pink-500/5', ring: 'stroke-rose-400', icon: Target },
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
    const m = Math.floor(sec / 60);
    const s = sec % 60;
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
    const [elapsed, setElapsed] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [ambientId, setAmbientId] = useState('none');
    const [showSounds, setShowSounds] = useState(false);
    const [finished, setFinished] = useState(false);
    const [finishing, setFinishing] = useState(false);
    const [sessionDurationSec, setSessionDurationSec] = useState(0);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const startTimeRef = useRef<number>(0);
    const stepStartedAtRef = useRef<number | null>(null);

    // Resync if props change
    useEffect(() => {
        if (isOpen) {
            setSteps(initialSteps);
            setCurrentIndex(0);
            setElapsed(0);
            setFinished(false);
            setFinishing(false);
            setSessionDurationSec(0);
            startTimeRef.current = Date.now();
            stepStartedAtRef.current = null;
            setIsRunning(true); // Start by default
        }
    }, [initialSteps, isOpen]);

    // Body scroll lock
    useEffect(() => {
        if (!isOpen) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, [isOpen]);

    // Precision Timer
    useEffect(() => {
        if (!isRunning || finished) {
            if (timerRef.current) clearInterval(timerRef.current);
            stepStartedAtRef.current = null;
            return;
        }

        if (stepStartedAtRef.current === null) {
            stepStartedAtRef.current = Date.now() - elapsed * 1000;
        }

        timerRef.current = setInterval(() => {
            if (stepStartedAtRef.current === null) return;
            const nextElapsed = Math.floor((Date.now() - stepStartedAtRef.current) / 1000);
            setElapsed(nextElapsed);
        }, 250);

        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isRunning, finished, elapsed]);

    // Ambient Audio handling
    useEffect(() => {
        const sound = AMBIENT_SOUNDS.find((s) => s.id === ambientId);
        if (!sound?.url) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current = null;
            }
            return;
        }
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        const audio = new Audio(sound.url);
        audio.loop = true;
        audio.volume = 0.25;
        audio.play().catch(() => { });
        audioRef.current = audio;
        return () => {
            audio.pause();
            audio.currentTime = 0;
        };
    }, [ambientId]);

    // Safety cleanup
    useEffect(() => () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        if (timerRef.current) clearInterval(timerRef.current);
    }, []);

    const currentStep = steps[currentIndex];
    const theme = STEP_THEME[currentStep?.type] || STEP_THEME.adoration;
    const readingSummary = formatDayReadingsLabel(readings);

    const handleNext = useCallback(() => {
        if (currentIndex < steps.length - 1) {
            setCurrentIndex((p) => p + 1);
            setElapsed(0);
            stepStartedAtRef.current = null;
        } else {
            setIsRunning(false);
            setSessionDurationSec(Math.round((Date.now() - startTimeRef.current) / 1000));
            setFinished(true);
        }
    }, [currentIndex, steps.length]);

    const handleValidateStep = useCallback(() => {
        setSteps((prev) => {
            const u = [...prev];
            u[currentIndex] = { ...u[currentIndex], completed: true, durationSec: elapsed };
            return u;
        });
        handleNext();
    }, [currentIndex, elapsed, handleNext]);

    const handleFinish = useCallback(() => {
        if (finishing) return;
        setFinishing(true);

        const totalDuration = Math.round((Date.now() - startTimeRef.current) / 1000);
        const session = savePrayerFlowSession({
            planId,
            dayIndex,
            readings,
            readingSummary,
            steps,
            totalDurationSec: totalDuration,
        });
        savePrayerFlowToJournal(session);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        onComplete();
    }, [dayIndex, onComplete, planId, readingSummary, readings, steps, finishing]);

    if (!isOpen) return null;

    const circleR = 50;
    const circleC = 2 * Math.PI * circleR;
    const dashOffset = circleC * (1 - Math.min(elapsed / STEP_TARGET_SEC, 1));

    return (
        <div className="fixed inset-0 z-[20001] flex items-center justify-center overflow-hidden">
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-[#06080d]/92 backdrop-blur-3xl"
                />
            </AnimatePresence>

            {/* Dynamic Background Halos */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.15, 0.25, 0.15]
                    }}
                    transition={{ duration: 12, repeat: Infinity }}
                    className="absolute -left-20 -top-20 h-[600px] w-[600px] rounded-full blur-[140px]"
                    style={{ backgroundColor: theme.accent }}
                />
                <div className="absolute -right-20 -bottom-20 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[130px]" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="relative flex h-full w-full max-w-2xl flex-col bg-transparent px-6 py-8 sm:px-8 sm:py-10"
            >
                {/* Header Section */}
                <div className="mb-10 flex items-start justify-between gap-6">
                    <div className="flex-1">
                        <motion.div
                            key={`header-${currentIndex}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex flex-col gap-3"
                        >
                            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: theme.accent }}>
                                {finished ? <Check size={10} strokeWidth={4} /> : <span className="opacity-80">Phase {currentIndex + 1} / {steps.length}</span>}
                                <span>{finished ? 'Accompli' : currentStep?.label}</span>
                            </div>
                            <h2 className="font-display text-3xl font-black tracking-tight text-white sm:text-5xl">
                                {finished ? 'Moment de Paix' : currentStep?.label}
                            </h2>
                            <div className="flex items-center gap-2 text-[13px] font-semibold text-white/45">
                                <Sun size={14} className="opacity-60" />
                                <span>{readingSummary}</span>
                            </div>
                        </motion.div>
                    </div>
                    <button
                        onClick={() => { if (audioRef.current) audioRef.current.pause(); onClose(); }}
                        className="group grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/60 transition-all hover:bg-white/[0.08] hover:text-white"
                        aria-label="Quitter"
                    >
                        <X size={20} className="transition group-hover:rotate-90" />
                    </button>
                </div>

                {/* Stepper Logic View */}
                <div className="mb-10 flex items-center gap-2.5">
                    {steps.map((step, i) => {
                        const stepIconTheme = STEP_THEME[step.type] || STEP_THEME.adoration;
                        const StepIcon = stepIconTheme.icon;
                        const isActive = i === currentIndex && !finished;
                        const isPast = i < currentIndex || finished;
                        return (
                            <div key={step.type} className="flex-1 flex flex-col items-center gap-3">
                                <div
                                    className="h-1.5 w-full rounded-full transition-all duration-1000 overflow-hidden bg-white/10"
                                >
                                    <motion.div
                                        initial={false}
                                        animate={{ width: isPast ? '100%' : isActive ? `${Math.min((elapsed / STEP_TARGET_SEC) * 100, 100)}%` : '0%' }}
                                        className="h-full"
                                        style={{ backgroundColor: isPast || isActive ? stepIconTheme.accent : 'transparent' }}
                                    />
                                </div>
                                <div className={`transition-all duration-500 ${isPast || isActive ? 'opacity-100 scale-110' : 'opacity-20 scale-90'}`}>
                                    <StepIcon size={14} style={{ color: isPast || isActive ? stepIconTheme.accent : undefined }} />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Content Area */}
                <div className="relative flex-1 overflow-visible">
                    <AnimatePresence mode="wait">
                        {finished ? (
                            <motion.div
                                key="finished"
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                className="flex flex-col gap-6"
                            >
                                <div className="text-center">
                                    <p className="text-xl font-medium text-white/60">
                                        Session de <span className="font-black text-white">{formatTimer(sessionDurationSec)}</span>
                                    </p>
                                </div>

                                <div className="grid gap-3">
                                    {steps.map((s) => {
                                        const st = STEP_THEME[s.type] || STEP_THEME.adoration;
                                        const SIcon = st.icon;
                                        return (
                                            <div key={s.type} className={`group flex items-center gap-4 rounded-[28px] border border-white/5 bg-white/[0.03] p-5 transition-all hover:bg-white/[0.05] ${!s.completed ? 'opacity-30' : ''}`}>
                                                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/5 shadow-inner">
                                                    <SIcon size={20} style={{ color: st.accent }} strokeWidth={2.5} />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-base font-black text-white">{s.label}</p>
                                                    {s.completed && s.userNote.trim() && (
                                                        <p className="mt-1 line-clamp-1 text-sm text-white/40 italic">"{s.userNote}"</p>
                                                    )}
                                                </div>
                                                {s.completed && (
                                                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400/10 text-emerald-400">
                                                        <Check size={18} strokeWidth={3} />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-4 flex flex-col gap-4">
                                    <button
                                        onClick={handleFinish}
                                        disabled={finishing}
                                        className="relative flex h-16 w-full items-center justify-center gap-3 overflow-hidden rounded-[26px] bg-white text-lg font-black text-slate-950 shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                                    >
                                        <Check size={22} strokeWidth={4} />
                                        Terminer & Sauvegarder
                                    </button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key={currentIndex}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                className="flex flex-col gap-8"
                            >
                                {/* Prompt Card Premium */}
                                <div className="group relative overflow-hidden rounded-[42px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))] p-10 shadow-2xl transition-all hover:border-white/20">
                                    <div className="absolute top-0 right-0 h-40 w-40 rounded-full blur-[80px]" style={{ backgroundColor: `${theme.accent}15` }} />
                                    <div className="absolute -bottom-6 -left-6 h-6 w-32 rounded-full blur-2xl" style={{ backgroundColor: theme.accent }} />

                                    <div className="relative z-10 space-y-4">
                                        <div className="h-0.5 w-12 rounded-full opacity-30" style={{ backgroundColor: theme.accent }} />
                                        <p className="whitespace-pre-line text-2xl font-black leading-relaxed tracking-tight text-white sm:text-3xl">
                                            {currentStep?.prompt}
                                        </p>
                                    </div>
                                </div>

                                {/* Timer Section */}
                                <div className="flex flex-col items-center">
                                    <div className="relative h-48 w-48">
                                        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                                            <circle cx="60" cy="60" r={circleR} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                                            <motion.circle
                                                cx="60" cy="60" r={circleR}
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
                                            <span className="text-4xl font-black tabular-nums tracking-tighter text-white">
                                                {formatTimer(elapsed)}
                                            </span>
                                            <motion.div
                                                animate={elapsed >= STEP_TARGET_SEC ? { scale: [1, 1.1, 1], color: '#10b981' } : {}}
                                                className="mt-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-white/30"
                                            >
                                                {elapsed >= STEP_TARGET_SEC ? (
                                                    <><Check size={10} strokeWidth={4} /> Objectif</>
                                                ) : (
                                                    `obj. ${STEP_TARGET_SEC / 60}m`
                                                )}
                                            </motion.div>
                                        </div>
                                    </div>

                                    {/* Playback Controls */}
                                    <div className="mt-8 flex items-center gap-6">
                                        <button
                                            onClick={() => setIsRunning(!isRunning)}
                                            className="grid h-20 w-20 place-items-center rounded-[28px] bg-white text-slate-950 shadow-2xl transition-all hover:scale-105 active:scale-95"
                                        >
                                            {isRunning ? <Pause size={32} fill="currentColor" /> : <Play size={32} className="ml-1" fill="currentColor" />}
                                        </button>
                                        <button
                                            onClick={() => setShowSounds(!showSounds)}
                                            className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5 text-white/60 transition-all hover:bg-white/10 hover:text-white backdrop-blur-md"
                                        >
                                            {ambientId !== 'none' ? <Volume2 size={24} /> : <VolumeX size={24} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Ambient Sound Selector Premium */}
                                <AnimatePresence>
                                    {showSounds && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 10 }}
                                            className="rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6 shadow-2xl backdrop-blur-2xl"
                                        >
                                            <div className="mb-5 flex items-center gap-2.5 px-1">
                                                <div className="h-4 w-1 rounded-full bg-amber-400" />
                                                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-white/40">
                                                    Atmosphère sonore
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                                {AMBIENT_SOUNDS.map((s) => {
                                                    const SndIcon = s.icon;
                                                    const isSelected = ambientId === s.id;
                                                    return (
                                                        <button
                                                            key={s.id}
                                                            onClick={() => { setAmbientId(s.id); setShowSounds(false); }}
                                                            className={`flex flex-col items-center justify-center gap-2.5 rounded-[24px] px-3 py-5 transition-all ${isSelected
                                                                ? 'bg-white text-slate-950 shadow-xl'
                                                                : 'border border-white/5 bg-white/5 text-white/60 hover:bg-white/10'
                                                                }`}
                                                        >
                                                            <SndIcon size={20} strokeWidth={isSelected ? 3 : 2} />
                                                            <span className="text-[11px] font-black tracking-tight">{s.label}</span>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Input Section */}
                                <div className="group rounded-[34px] border border-white/10 bg-white/[0.02] p-1 transition-all focus-within:border-white/20 focus-within:bg-white/[0.04]">
                                    <textarea
                                        value={steps[currentIndex]?.userNote || ''}
                                        onChange={(e) => {
                                            setSteps((prev) => {
                                                const u = [...prev];
                                                u[currentIndex] = { ...u[currentIndex], userNote: e.target.value };
                                                return u;
                                            });
                                        }}
                                        placeholder="Notez une pensée ou une prière ici..."
                                        className="h-32 w-full resize-none bg-transparent px-6 py-5 text-base font-medium leading-relaxed text-white outline-none placeholder:text-white/20"
                                    />
                                </div>

                                {/* Navigation Actions */}
                                <div className="flex items-center gap-4 pb-10">
                                    <button
                                        onClick={handleNext}
                                        className="flex h-16 flex-1 items-center justify-center gap-2 rounded-[26px] border border-white/10 bg-white/5 text-[15px] font-black text-white/60 transition-all hover:bg-white/10 hover:text-white active:scale-95"
                                    >
                                        <SkipForward size={18} />
                                        <span>Passer</span>
                                    </button>
                                    <button
                                        onClick={handleValidateStep}
                                        className="flex h-16 flex-[2] items-center justify-center gap-2 rounded-[26px] bg-[#fffcf9] text-[16px] font-black text-slate-950 shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        <Check size={20} strokeWidth={4} />
                                        <span>{currentIndex === steps.length - 1 ? 'Terminer' : 'Amen, suivant'}</span>
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* Live Indicator (Bottom bar) */}
            <AnimatePresence>
                {!finished && (
                    <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 50, opacity: 0 }}
                        className="fixed bottom-0 left-0 right-0 flex justify-center pb-6"
                    >
                        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[#0c0e14]/80 px-5 py-2.5 shadow-2xl backdrop-blur-xl">
                            <div className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/50">Session en cours</span>
                            <div className="h-4 w-px bg-white/10" />
                            <span className="text-sm font-black text-white tabular-nums">{formatTimer(Math.round((Date.now() - startTimeRef.current) / 1000))}</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
