'use client';

import type { LucideIcon } from 'lucide-react';

type StepTheme = {
  accent: string;
  icon: LucideIcon;
};

type PrayerStepProgressProps = {
  steps: Array<{ type: string }>;
  currentIndex: number;
  finished: boolean;
  progress: number;
  themes: Record<string, StepTheme>;
};

export default function PrayerStepProgress({
  steps,
  currentIndex,
  finished,
  progress,
  themes,
}: PrayerStepProgressProps) {
  return (
    <div className="mb-10 flex items-center gap-2.5">
      {steps.map((step, i) => {
        const stepTheme = themes[step.type] || themes.adoration;
        const StepIcon = stepTheme.icon;
        const isActive = i === currentIndex && !finished;
        const isPast = i < currentIndex || finished;

        return (
          <div key={`${step.type}-${i}`} className="flex flex-1 flex-col items-center gap-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full transition-all duration-700"
                style={{
                  width: isPast ? '100%' : isActive ? `${progress * 100}%` : '0%',
                  backgroundColor: isPast || isActive ? stepTheme.accent : 'transparent',
                }}
              />
            </div>

            <div
              className={`transition-all duration-500 ${
                isPast || isActive ? 'scale-110 opacity-100' : 'scale-90 opacity-20'
              }`}
            >
              <StepIcon
                size={14}
                style={{ color: isPast || isActive ? stepTheme.accent : undefined }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
