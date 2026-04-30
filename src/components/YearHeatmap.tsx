'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import { localDB } from '@/lib/localDB';

interface ReadingEntry {
  bookName: string;
  chapter: number;
  timestamp: string;
  durationSec: number;
}

interface DayCell {
  date: string; // YYYY-MM-DD
  count: number; // chapters read
  intensity: 0 | 1 | 2 | 3 | 4;
}

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

function buildYearGrid(): DayCell[] {
  const entries: ReadingEntry[] = localDB.get<ReadingEntry[]>('readingHistory', []);

  // Aggregate chapter count per date
  const countByDate = new Map<string, number>();
  for (const entry of entries) {
    const date = entry.timestamp.slice(0, 10);
    countByDate.set(date, (countByDate.get(date) ?? 0) + 1);
  }

  const today = new Date();
  const cells: DayCell[] = [];

  // Build 365-day grid ending today
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const count = countByDate.get(date) ?? 0;
    const intensity = (count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4) as 0 | 1 | 2 | 3 | 4;
    cells.push({ date, count, intensity });
  }

  return cells;
}

function getMonthOffsets(cells: DayCell[]): { label: string; col: number }[] {
  const seen = new Set<string>();
  const offsets: { label: string; col: number }[] = [];

  // cells are grouped into weeks (columns)
  // find the first day of each month
  cells.forEach((cell, idx) => {
    const month = cell.date.slice(0, 7); // "YYYY-MM"
    if (!seen.has(month)) {
      seen.add(month);
      const col = Math.floor(idx / 7);
      const monthIdx = parseInt(cell.date.slice(5, 7)) - 1;
      offsets.push({ label: MONTH_LABELS[monthIdx], col });
    }
  });

  return offsets;
}

const INTENSITY_STYLES = [
  'bg-surface-strong/40 border border-border-soft',
  'bg-emerald-200/60 dark:bg-emerald-900/50',
  'bg-emerald-400/70 dark:bg-emerald-700/70',
  'bg-emerald-500 dark:bg-emerald-600 shadow-sm shadow-emerald-400/20',
  'bg-emerald-600 dark:bg-emerald-500 shadow-md shadow-emerald-500/30',
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function YearHeatmap() {
  const [tooltip, setTooltip] = useState<{ cell: DayCell; x: number; y: number } | null>(null);

  const cells = useMemo(() => buildYearGrid(), []);
  const monthOffsets = useMemo(() => getMonthOffsets(cells), [cells]);

  // Group cells into weeks (columns of 7)
  const weeks = useMemo(() => {
    const result: DayCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      result.push(cells.slice(i, i + 7));
    }
    return result;
  }, [cells]);

  const totalChapters = useMemo(() => cells.reduce((s, c) => s + c.count, 0), [cells]);
  const activeDays = useMemo(() => cells.filter(c => c.count > 0).length, [cells]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-[28px] border border-border-soft bg-surface/50 p-6 backdrop-blur-md shadow-sm"
    >
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-emerald-600" />
          <span className="text-[10px] font-black uppercase tracking-widest text-foreground">
            Fidélité sur 365 jours
          </span>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-bold text-muted">
          <span>{activeDays} jours actifs</span>
          <span>·</span>
          <span>{totalChapters} chapitres</span>
        </div>
      </div>

      {/* Month labels */}
      <div className="relative mb-1 overflow-x-auto">
        <div className="relative h-4 min-w-max" style={{ width: `${weeks.length * 14}px` }}>
          {monthOffsets.map(({ label, col }) => (
            <span
              key={label + col}
              className="absolute text-[9px] font-black uppercase text-muted/60"
              style={{ left: `${col * 14}px` }}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Grid */}
        <div
          className="flex gap-[2px] min-w-max mt-1"
          onMouseLeave={() => setTooltip(null)}
        >
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[2px]">
              {week.map((cell) => (
                <div
                  key={cell.date}
                  className={`h-[11px] w-[11px] rounded-[2px] transition-all cursor-pointer ${INTENSITY_STYLES[cell.intensity]} hover:scale-125 hover:z-10 relative`}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({ cell, x: rect.left, y: rect.top });
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[9px] font-bold text-muted">Moins</span>
        {INTENSITY_STYLES.map((style, i) => (
          <div key={i} className={`h-[10px] w-[10px] rounded-[2px] ${style}`} />
        ))}
        <span className="text-[9px] font-bold text-muted">Plus</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none rounded-xl bg-surface-strong/95 border border-border-soft px-3 py-2 shadow-xl backdrop-blur-xl text-[10px] font-bold text-foreground"
          style={{ left: tooltip.x + 14, top: tooltip.y - 40 }}
        >
          <div className="text-muted capitalize">{formatDate(tooltip.cell.date)}</div>
          {tooltip.cell.count > 0 ? (
            <div className="text-emerald-600 mt-0.5">
              {tooltip.cell.count} chapitre{tooltip.cell.count > 1 ? 's' : ''} lu{tooltip.cell.count > 1 ? 's' : ''}
            </div>
          ) : (
            <div className="text-muted/60 mt-0.5">Aucune lecture</div>
          )}
        </div>
      )}
    </motion.div>
  );
}
