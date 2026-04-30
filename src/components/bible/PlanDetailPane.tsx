'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Lock, TimerReset, CheckCircle2, BookOpen, ArrowRight } from 'lucide-react';
import type { PlanEntry } from './readingPlanUi';

interface PlanDetailPaneProps {
  selectedEntry: PlanEntry;
  selectedIndex: number;
  totalEntries: number;
  isLoggedIn: boolean;
  completion: number;
  reducedMotion: boolean;
  primaryCtaLabel: string;
  onSelectTrack: (planId: string, index: number) => void;
  onStartPlan: (planId: string) => void;
  pickerEntries: PlanEntry[];
}

export const PlanDetailPane = React.memo(function PlanDetailPane({
  selectedEntry,
  selectedIndex,
  totalEntries,
  isLoggedIn,
  completion,
  reducedMotion,
  primaryCtaLabel,
  onSelectTrack,
  onStartPlan,
  pickerEntries,
}: PlanDetailPaneProps) {
  const ENTRY_EASE = [0.16, 1, 0.3, 1];

  return (
    <motion.aside
      key={selectedEntry.plan.id}
      className="mx-auto -mt-2 max-w-[560px] text-center sm:-mt-6 lg:mx-0 lg:mt-0 lg:max-w-none"
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: ENTRY_EASE as [number, number, number, number] }}
    >
      <div className="overflow-hidden rounded-[34px] border border-border-soft bg-surface shadow-[0_25px_60px_rgba(22,28,53,0.08)] backdrop-blur-sm">
        <div className="relative px-6 py-6 sm:px-8 sm:py-8 lg:text-left">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(200,159,45,0.08),rgba(255,255,255,0))]" />

          <div className="relative">
            <div className="flex items-center justify-center gap-2 lg:justify-start">
              <span className="rounded-full bg-foreground/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-muted">
                {selectedIndex + 1} / {totalEntries}
              </span>
              {!isLoggedIn ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border-soft bg-accent/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
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
                    onClick={() => onSelectTrack(entry.plan.id, index)}
                    aria-label={`Aller au parcours ${index + 1}`}
                    className="rounded-full transition-all"
                    style={{
                      width: isActive ? '28px' : '7px',
                      height: '7px',
                      background: isActive ? 'var(--accent)' : 'var(--foreground)',
                      opacity: isActive ? 1 : 0.1,
                    }}
                  />
                );
              })}
            </div>

            <h2 className="mt-6 font-display text-[32px] font-black leading-[1.02] tracking-tight text-foreground sm:text-[42px] lg:text-[48px] xl:text-[52px]">
              {selectedEntry.plan.name}
            </h2>

            <p className="mx-auto mt-4 max-w-[32ch] text-[14px] leading-relaxed text-muted sm:text-[15px] lg:mx-0 lg:max-w-[24ch] lg:text-[17px]">
              {selectedEntry.presentation.art.focus}
            </p>

            <div className="mt-6 grid gap-3">
              <div className="rounded-[24px] border border-border-soft bg-surface-strong px-4 py-4">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
                  <TimerReset size={13} />
                  Rythme
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {selectedEntry.presentation.cadence}
                </p>
              </div>

              <div className="rounded-[24px] border border-border-soft bg-surface px-4 py-4">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                  <CheckCircle2 size={13} />
                  Progression
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-foreground/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-accent/80 transition-all duration-500"
                    style={{ width: `${completion}%` }}
                  />
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {completion}% complété
                </p>
              </div>
            </div>

            <button
              onClick={() => onStartPlan(selectedEntry.plan.id)}
              className="mt-8 flex w-full items-center justify-between rounded-full bg-foreground px-6 py-4 text-left text-background shadow-lg transition-transform hover:scale-[1.02] active:scale-95"
            >
              <div>
                <span className="block text-[11px] font-black uppercase tracking-[0.16em] opacity-80">
                  {isLoggedIn ? 'Continuer' : 'Commencer'}
                </span>
                <span className="mt-0.5 block text-sm font-bold">
                  {primaryCtaLabel}
                </span>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-foreground">
                <ArrowRight size={16} strokeWidth={2.5} />
              </div>
            </button>
          </div>
        </div>
      </div>
    </motion.aside>
  );
});
