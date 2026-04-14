'use client';

import { Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PrayerFlowStep } from '../../lib/prayerFlowStore';

type StepTheme = {
  accent: string;
  icon: LucideIcon;
};

type PrayerFinishSummaryProps = {
  steps: PrayerFlowStep[];
  sessionDurationSec: number;
  themes: Record<string, StepTheme>;
  finishing: boolean;
  onFinish: () => void;
};

function formatTimer(sec: number) {
  const safe = Math.max(0, sec);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PrayerFinishSummary({
  steps,
  sessionDurationSec,
  themes,
  finishing,
  onFinish,
}: PrayerFinishSummaryProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <p className="text-xl font-medium text-white/60">
          Session de <span className="font-black text-white">{formatTimer(sessionDurationSec)}</span>
        </p>
      </div>

      <div className="grid gap-3">
        {steps.map((step, index) => {
          const theme = themes[step.type] || themes.adoration;
          const Icon = theme.icon;

          return (
            <div
              key={`${step.type}-${index}`}
              className={`flex items-center gap-4 rounded-[28px] border border-white/5 bg-white/[0.03] p-5 transition-all hover:bg-white/[0.05] ${
                !step.completed ? 'opacity-30' : ''
              }`}
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/5 shadow-inner">
                <Icon size={20} style={{ color: theme.accent }} strokeWidth={2.5} />
              </div>

              <div className="flex-1">
                <p className="text-base font-black text-white">{step.label}</p>
                {step.completed && step.userNote.trim() ? (
                  <p className="mt-1 line-clamp-1 text-sm italic text-white/40">
                    "{step.userNote}"
                  </p>
                ) : null}
              </div>

              {step.completed ? (
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400/10 text-emerald-400">
                  <Check size={18} strokeWidth={3} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <button
        onClick={onFinish}
        disabled={finishing}
        className="relative flex h-16 w-full items-center justify-center gap-3 overflow-hidden rounded-[26px] bg-surface text-lg font-black text-slate-950 shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
      >
        <Check size={22} strokeWidth={4} />
        Terminer & Sauvegarder
      </button>
    </div>
  );
}
