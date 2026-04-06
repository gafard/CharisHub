'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    X, Play, Pause, Check, Volume2, VolumeX, SkipForward,
    CloudRain, TreePine, Sparkles, Waves, Music, Leaf, Wind,
    Heart, Droplets, Smile, Users, Target
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatDayReadingsLabel, type PlanReading } from '../../lib/readingPlans';
import { type PrayerFlowStep, savePrayerFlowSession, savePrayerFlowToJournal } from '../../lib/prayerFlowStore';

/* ─── Same sounds as PrayerTimer in the journal ─── */
const AMBIENT_SOUNDS = [
    { id: 'none', label: 'Silence', icon: Wind, url: '' },
    { id: 'rain', label: 'Pluie douce', icon: CloudRain, url: '/sounds/rain.mp3' },
    { id: 'forest', label: 'Forêt', icon: TreePine, url: '/sounds/forest.mp3' },
    { id: 'elysian', label: 'Élysée', icon: Sparkles, url: '/sounds/Elysian.mp3' },
    { id: 'mediterranean', label: 'Méditerranée', icon: Waves, url: '/sounds/mediterranean.mp3' },
    { id: 'eastern', label: 'Orient', icon: Music, url: '/sounds/eastern.mp3' },
    { id: 'harvest', label: 'Récolte', icon: Leaf, url: '/sounds/harvest.mp3' },
    { id: 'celtica', label: 'Celtique', icon: Leaf, url: '/sounds/celtica.mp3' },
];

const STEP_TARGET_SEC = 120;

/* ─── Step accent palettes ─── */
const STEP_THEME: Record<string, { accent: string; accentLight: string; bg: string; ring: string; icon: LucideIcon }> = {
    adoration: { accent: '#f59e0b', accentLight: 'rgba(245,158,11,0.08)', bg: 'from-amber-100/50 to-orange-50/50 dark:from-amber-600/10 dark:to-orange-500/5', ring: 'stroke-amber-400', icon: Heart },
    repentance: { accent: '#8b5cf6', accentLight: 'rgba(139,92,246,0.08)', bg: 'from-violet-100/50 to-purple-50/50 dark:from-violet-600/10 dark:to-purple-500/5', ring: 'stroke-violet-400', icon: Droplets },
    gratitude: { accent: '#10b981', accentLight: 'rgba(16,185,129,0.08)', bg: 'from-emerald-100/50 to-teal-50/50 dark:from-emerald-600/10 dark:to-teal-500/5', ring: 'stroke-emerald-400', icon: Smile },
    intercession: { accent: '#0ea5e9', accentLight: 'rgba(14,165,233,0.08)', bg: 'from-sky-100/50 to-blue-50/50 dark:from-sky-600/10 dark:to-blue-500/5', ring: 'stroke-sky-400', icon: Users },
    engagement: { accent: '#f43f5e', accentLight: 'rgba(244,63,94,0.08)', bg: 'from-rose-100/50 to-pink-50/50 dark:from-rose-600/10 dark:to-pink-500/5', ring: 'stroke-rose-400', icon: Target },
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
    const [sessionDurationSec, setSessionDurationSec] = useState(0);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const startTimeRef = useRef<number>(0);

    useEffect(() => {
        startTimeRef.current = Date.now();
    }, []);

    useEffect(() => {
        if (isRunning) timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isRunning]);

    useEffect(() => {
        const sound = AMBIENT_SOUNDS.find((s) => s.id === ambientId);
        if (!sound?.url) { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } return; }
        if (audioRef.current) audioRef.current.pause();
        const audio = new Audio(sound.url);
        audio.loop = true;
        audio.volume = 0.3;
        audio.play().catch(() => { });
        audioRef.current = audio;
        return () => { audio.pause(); };
    }, [ambientId]);

    useEffect(() => () => {
        if (audioRef.current) audioRef.current.pause();
        if (timerRef.current) clearInterval(timerRef.current);
    }, []);

    const currentStep = steps[currentIndex];
    const theme = STEP_THEME[currentStep?.type] || STEP_THEME.adoration;
    const readingSummary = formatDayReadingsLabel(readings);

    const handleValidateStep = useCallback(() => {
        setSteps((prev) => {
            const u = [...prev];
            u[currentIndex] = { ...u[currentIndex], completed: true, durationSec: elapsed };
            return u;
        });
        if (currentIndex < steps.length - 1) {
            setCurrentIndex((p) => p + 1);
            setElapsed(0);
        } else {
            setIsRunning(false);
            setSessionDurationSec(Math.round((Date.now() - startTimeRef.current) / 1000));
            setFinished(true);
        }
    }, [currentIndex, elapsed, steps.length]);

    const handleSkipStep = useCallback(() => {
        if (currentIndex < steps.length - 1) {
            setCurrentIndex((p) => p + 1);
            setElapsed(0);
        } else {
            setIsRunning(false);
            setSessionDurationSec(Math.round((Date.now() - startTimeRef.current) / 1000));
            setFinished(true);
        }
    }, [currentIndex, steps.length]);

    const handleFinish = useCallback(() => {
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
        if (audioRef.current) audioRef.current.pause();
        onComplete();
    }, [dayIndex, onComplete, planId, readingSummary, readings, steps]);

    if (!isOpen) return null;

    const circleR = 50;
    const circleC = 2 * Math.PI * circleR;
    const dashOffset = circleC * (1 - Math.min(elapsed / STEP_TARGET_SEC, 1));

    return (
        <div className="fixed inset-0 z-[20001] flex items-center justify-center animate-in fade-in duration-500">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(240,194,123,0.12),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(78,180,255,0.08),transparent_22%),rgba(12,14,20,0.86)] backdrop-blur-2xl transition-colors duration-1000" />

            <div className="relative w-full max-w-2xl max-h-[100vh] flex flex-col overflow-hidden px-5 py-6 sm:px-6 sm:py-8 animate-in zoom-in-[0.98] duration-500">
                {/* Top bar */}
                <div className="mb-7 flex items-center justify-between gap-4">
                    <div>
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: theme.accent }}>
                            {finished ? 'Terminé' : `Étape ${currentIndex + 1} sur ${steps.length}`}
                        </p>
                        <h2 className="font-display text-[34px] font-bold tracking-tight text-[#fff7ec] sm:text-[42px]">
                            {finished ? 'Prière accomplie' : currentStep?.label}
                        </h2>
                        <p className="mt-2 max-w-[36ch] text-[13px] leading-relaxed text-[rgba(255,240,222,0.58)]">
                            {readingSummary}
                        </p>
                    </div>
                    <button
                        onClick={() => { if (audioRef.current) audioRef.current.pause(); onClose(); }}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[rgba(255,240,222,0.7)] transition-colors hover:bg-white/[0.1] backdrop-blur-xl"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Progress pills */}
                <div className="mb-8 flex items-center gap-2">
                    {steps.map((step, i) => {
                        const stepIconTheme = STEP_THEME[step.type] || STEP_THEME.adoration;
                        const StepIcon = stepIconTheme.icon;
                        const isActive = i === currentIndex && !finished;
                        return (
                            <div key={step.type} className="flex-1 flex flex-col items-center gap-2">
                                <div
                                    className="w-full h-[6px] rounded-full transition-all duration-700 shadow-inner"
                                    style={{
                                        backgroundColor: step.completed
                                            ? theme.accent
                                            : isActive
                                                ? `${theme.accent}40`
                                                : 'rgba(255,255,255,0.12)',
                                    }}
                                />
                                <div className={`transition-all duration-500 ${step.completed || isActive ? 'opacity-100 scale-100' : 'opacity-30 scale-90 text-white/40'}`}>
                                    <StepIcon size={14} style={{ color: step.completed || isActive ? stepIconTheme.accent : undefined }} />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Main content */}
                <div className="flex-1 overflow-y-auto pb-4 scrollbar-hide">
                    {finished ? (
                        /* ═══ FINISHED ═══ */
                        <div className="space-y-6 animate-in fade-in zoom-in-[0.98] duration-700">
                            <div className="mb-4 text-center">
                                <p className="text-[15px] font-medium text-[rgba(255,240,222,0.62)]">
                                    Vous avez prié pendant <strong className="font-bold text-[#fff7ec]">{formatTimer(sessionDurationSec)}</strong>
                                </p>
                            </div>

                            <div className="space-y-3">
                                {steps.map((s) => {
                                    const st = STEP_THEME[s.type] || STEP_THEME.adoration;
                                    const SIcon = st.icon;
                                    return (
                                        <div key={s.type} className={`flex items-center gap-4 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5 shadow-[0_18px_54px_rgba(0,0,0,0.18)] ${!s.completed ? 'opacity-40' : ''}`}>
                                            <div className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center" style={{ backgroundColor: st.accentLight }}>
                                                <SIcon size={18} style={{ color: st.accent }} strokeWidth={2.5} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[15px] font-bold leading-snug text-[#fff7ec]">{s.label}</p>
                                                {s.completed && s.userNote.trim() && (
                                                    <p className="mt-0.5 truncate text-[13px] text-[rgba(255,240,222,0.56)]">{s.userNote}</p>
                                                )}
                                            </div>
                                            {s.completed && (
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08]">
                                                    <Check size={16} className="text-[rgba(255,240,222,0.74)]" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <p className="mt-6 text-center text-[12px] font-medium text-[rgba(255,240,222,0.4)]">
                                Sauvegardé dans votre Journal de Prière
                            </p>

                            <button
                                onClick={handleFinish}
                                className="relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-[22px] bg-[#fff7ef] py-4 text-[16px] font-bold text-[#160d0a] shadow-[0_18px_40px_rgba(0,0,0,0.24)] transition-all active:scale-[0.98] group"
                            >
                                <div className="absolute inset-0 bg-black/5 opacity-0 transition-opacity group-active:opacity-100" />
                                <Check size={20} strokeWidth={3} />
                                Terminer la session
                            </button>
                        </div>
                    ) : currentStep ? (
                        /* ═══ ACTIVE STEP ═══ */
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500" key={currentIndex}>

                            {/* Prompt — large bold question card */}
                            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-8 shadow-[0_22px_60px_rgba(0,0,0,0.2)]">
                                {/* Decorative soft glow behind text */}
                                <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-50 blur-3xl" style={{ backgroundColor: theme.accent }} />
                                <p className="relative z-10 whitespace-pre-line text-[19px] font-bold leading-relaxed text-[#fff7ec]">
                                    {currentStep.prompt}
                                </p>
                            </div>

                            {/* Timer */}
                            <div className="flex flex-col items-center py-4">
                                <div className="relative w-40 h-40">
                                    <svg className="w-full h-full -rotate-90 drop-shadow-md" viewBox="0 0 112 112">
                                        <circle cx="56" cy="56" r={circleR} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" />
                                        <circle
                                            cx="56" cy="56" r={circleR}
                                            fill="none"
                                            className={`${theme.ring} transition-all duration-1000 ease-linear`}
                                            strokeWidth="6"
                                            strokeLinecap="round"
                                            strokeDasharray={circleC}
                                            strokeDashoffset={dashOffset}
                                            style={{ filter: `drop-shadow(0 0 4px ${theme.accent}60)` }}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-3xl font-bold tabular-nums tracking-tight text-[#fff7ec]">
                                            {formatTimer(elapsed)}
                                        </span>
                                        <span className={`text-[10px] mt-1 font-bold uppercase tracking-[0.15em] transition-colors duration-500 ${elapsed >= STEP_TARGET_SEC ? 'text-emerald-500' : 'text-black/30 dark:text-white/30'
                                            }`}>
                                            {elapsed >= STEP_TARGET_SEC ? '✓ objectif' : `obj. ${STEP_TARGET_SEC / 60}min`}
                                        </span>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="flex items-center gap-4 mt-6">
                                    <button
                                        onClick={() => setIsRunning(!isRunning)}
                                        className="flex h-16 w-16 items-center justify-center rounded-full bg-[#fff7ef] text-[#160d0a] shadow-[0_18px_36px_rgba(0,0,0,0.24)] transition-all hover:scale-105 active:scale-95"
                                    >
                                        {isRunning ? <Pause size={26} fill="currentColor" /> : <Play size={26} className="ml-1" fill="currentColor" />}
                                    </button>
                                    <button
                                        onClick={() => setShowSounds(!showSounds)}
                                        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[rgba(255,240,222,0.74)] transition-colors hover:bg-white/[0.1] backdrop-blur-md"
                                    >
                                        {ambientId !== 'none' ? <Volume2 size={20} /> : <VolumeX size={20} />}
                                    </button>
                                </div>
                            </div>

                            {/* Sound picker (Frosted Glass) */}
                            {showSounds && (
                                <div className="animate-in fade-in slide-in-from-top-4 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-4 shadow-[0_20px_54px_rgba(0,0,0,0.2)] duration-300">
                                    <div className="flex items-center justify-between mb-3 px-2">
                                        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[rgba(255,240,222,0.5)]">
                                            Ambiance sonore
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {AMBIENT_SOUNDS.map((s) => {
                                            const SndIcon = s.icon;
                                            const isSelected = ambientId === s.id;
                                            return (
                                                <button
                                                    key={s.id}
                                                    onClick={() => { setAmbientId(s.id); setShowSounds(false); }}
                                                    className={`flex items-center gap-3 px-4 py-3.5 rounded-[20px] text-[13px] font-semibold transition-all ${isSelected
                                                        ? 'bg-[#fff7ef] text-[#160d0a] shadow-[0_12px_28px_rgba(0,0,0,0.2)]'
                                                        : 'bg-white/[0.05] text-[rgba(255,240,222,0.7)] hover:bg-white/[0.1]'
                                                        }`}
                                                >
                                                    <SndIcon size={16} strokeWidth={isSelected ? 2.5 : 2} />
                                                    {s.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Note area */}
                            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] shadow-[0_18px_54px_rgba(0,0,0,0.2)] transition-all focus-within:ring-2 focus-within:ring-white/10">
                                <textarea
                                    value={steps[currentIndex]?.userNote || ''}
                                    onChange={(e) => {
                                        setSteps((prev) => {
                                            const u = [...prev];
                                            u[currentIndex] = { ...u[currentIndex], userNote: e.target.value };
                                            return u;
                                        });
                                    }}
                                    placeholder="Écrivez votre prière ou pensée..."
                                    className="min-h-[110px] w-full resize-none bg-transparent px-6 py-5 text-[15px] font-medium leading-relaxed text-[#fff7ec] outline-none placeholder:text-[rgba(255,240,222,0.3)]"
                                />
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-3 pb-4">
                                <button
                                    onClick={handleSkipStep}
                                    className="flex items-center justify-center gap-1.5 rounded-[20px] border border-white/10 bg-white/[0.04] px-6 py-4 text-[14px] font-bold text-[rgba(255,240,222,0.68)] transition-colors hover:bg-white/[0.08] hover:text-white"
                                >
                                    <SkipForward size={16} />
                                    <span>Passer</span>
                                </button>
                                <button
                                    onClick={handleValidateStep}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-[20px] bg-[#fff7ef] py-4 text-[15px] font-bold text-[#160d0a] shadow-[0_18px_36px_rgba(0,0,0,0.24)] transition-transform active:scale-[0.98]"
                                >
                                    <Check size={18} strokeWidth={3} />
                                    {currentIndex === steps.length - 1 ? 'Terminer' : 'Amen, suivant'}
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
