'use client';

import { use, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Play, RotateCcw, Calendar, CheckCircle2, Bookmark, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import StudyAppShell from '../../../../components/StudyAppShell';
import {
  PLAN_ENTRIES,
  PlanStageCard,
  ENTRY_EASE,
} from '../../../../components/bible/readingPlanUi';
import {
  getPlanProgress,
  startOrActivatePlan,
  resetPlan,
  isTodayCompleted,
  countDayChapters,
  formatDayReadingsLabel,
  getFirstUncompletedReading,
  type ActiveReadingPlan,
} from '../../../../lib/readingPlans';

export default function ReadingPlanDetail({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [progress, setProgress] = useState<ActiveReadingPlan | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const entry = PLAN_ENTRIES.find((e) => e.plan.id === id);

  useEffect(() => {
    if (id) {
      setProgress(getPlanProgress(id));
    }
  }, [id]);

  if (!entry) {
    return (
      <StudyAppShell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <h2 className="text-2xl font-bold">Plan introuvable</h2>
          <button onClick={() => router.push('/bible/plans')} className="mt-4 text-accent">
            Retour au catalogue
          </button>
        </div>
      </StudyAppShell>
    );
  }

  const handleStart = () => {
    startOrActivatePlan(id);
    const next = getFirstUncompletedReading(id);
    if (next) {
      router.push(`/bible?book=${next.bookId}&chapter=${next.chapter}&plan=${id}`);
    } else {
      router.push('/bible');
    }
  };

  const handleReset = () => {
    if (window.confirm("Êtes-vous sûr de vouloir réinitialiser votre progression pour ce plan ?")) {
      resetPlan(id);
      setProgress(null);
    }
  };

  const isStarted = !!progress;
  const isCompleted = progress && progress.completedDays.length >= entry.plan.days.length;
  const todayDone = isTodayCompleted(id);

  return (
    <StudyAppShell>
      <div className="mx-auto max-w-5xl">
        <button
          onClick={() => router.push('/bible/plans')}
          className="group mb-8 flex items-center gap-2 text-sm font-bold text-muted transition-colors hover:text-accent"
        >
          <ChevronLeft size={18} className="transition-transform group-hover:-translate-x-1" />
          Tous les plans
        </button>

        <div className="flex flex-col gap-12 lg:flex-row">
          {/* Card Presentation */}
          <div className="lg:sticky lg:top-24 lg:h-fit">
            <PlanStageCard
              entry={entry}
              completion={progress ? Math.round((progress.completedDays.length / entry.plan.days.length) * 100) : 0}
              reducedMotion={false}
              side="center"
            />

            <div className="mt-8 flex flex-col gap-3">
              <button
                onClick={handleStart}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-accent py-4 font-display text-lg font-black text-white shadow-xl shadow-accent/20 transition-transform active:scale-95"
              >
                {isStarted ? (isCompleted ? 'Relire ce plan' : todayDone ? 'Retour au texte' : "Continuer aujourd'hui") : 'Commencer le parcours'}
                <Play size={20} fill="currentColor" />
              </button>

              {isStarted && (
                <button
                  onClick={handleReset}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border-soft py-3 text-sm font-bold text-muted transition-colors hover:border-red-100 hover:bg-red-50 hover:text-red-500"
                >
                  <RotateCcw size={16} />
                  Réinitialiser la progression
                </button>
              )}
            </div>
          </div>

          {/* Details & Days List */}
          <div className="flex-1">
            <section className="mb-12">
              <h2 className="font-display text-3xl font-black text-foreground">À propos de ce plan</h2>
              <p className="mt-6 text-lg leading-relaxed text-muted">
                {entry.presentation.art.focus}
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 rounded-2xl bg-surface-strong/60 p-4 border border-border-soft shadow-sm">
                  <Calendar className="text-accent" size={20} />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Durée</div>
                    <div className="text-sm font-bold">{entry.plan.days.length} jours</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-surface-strong/60 p-4 border border-border-soft shadow-sm">
                  <Bookmark className="text-accent" size={20} />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Style</div>
                    <div className="text-sm font-bold uppercase">{entry.presentation.cadence}</div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="font-display text-2xl font-bold text-foreground">Programme</h2>
              </div>

              <div className="space-y-3">
                {entry.plan.days.map((day, idx) => {
                  const isDayDone = progress?.completedDays.includes(idx);
                  const isCurrentlyToday = progress?.todayIndex === idx;

                  return (
                    <div
                      key={idx}
                      className={`relative flex items-center gap-4 rounded-2xl border p-4 transition-all ${
                        isDayDone
                          ? 'border-accent/20 bg-accent/5'
                          : isCurrentlyToday
                          ? 'border-accent bg-surface shadow-md'
                          : 'border-border-soft bg-surface-strong/40'
                      }`}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold ${
                        isDayDone ? 'bg-accent text-white' : 'bg-foreground/5 text-muted'
                      }`}>
                        {isDayDone ? <CheckCircle2 size={20} /> : idx + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-widest text-muted">Jour {idx + 1}</span>
                          {isCurrentlyToday && (
                            <span className="rounded-full bg-foreground px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-background">AUJOURD'HUI</span>
                          )}
                        </div>
                        <div className="mt-1 truncate font-bold text-foreground">
                          {formatDayReadingsLabel(day.readings)}
                        </div>
                        <div className="text-[11px] text-muted">
                           {countDayChapters(day)} chapitres à méditer
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </StudyAppShell>
  );
}
