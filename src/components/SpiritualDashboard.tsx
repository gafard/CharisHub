'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame, BookOpen, Heart, Star, TrendingUp, Clock,
  Calendar, Award, Zap, MessageCircle, Users, Sparkles
} from 'lucide-react';
import { getStreak, type StreakData } from '@/lib/bibleStreak';
import { getAllSessions, type PrayerFlowSession } from '@/lib/prayerFlowStore';
import { pepitesStore, type Pepite } from '@/lib/pepitesStore';

// ============================================================
// Types
// ============================================================

type Badge = {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  earned: boolean;
  progress: number; // 0-1
  color: string;
};

type WeekDay = {
  date: string; // YYYY-MM-DD
  label: string; // "Lun", "Mar", etc.
  hasReading: boolean;
  hasPrayer: boolean;
  intensity: 0 | 1 | 2 | 3; // for heatmap coloring
};

// ============================================================
// Data Collection
// ============================================================

function collectLocalData() {
  if (typeof window === 'undefined') {
    return {
      highlights: 0,
      notes: 0,
      bookmarks: 0,
      readingDays: [] as string[],
    };
  }

  const highlightsRaw = localStorage.getItem('formation_biblique_bible_highlights_v1');
  const highlights = highlightsRaw ? Object.keys(JSON.parse(highlightsRaw)).length : 0;

  const notesRaw = localStorage.getItem('formation_biblique_bible_notes_v1');
  const verseNotesRaw = localStorage.getItem('formation_biblique_bible_verse_notes_v1');
  const notes = (notesRaw ? Object.keys(JSON.parse(notesRaw)).length : 0)
              + (verseNotesRaw ? Object.keys(JSON.parse(verseNotesRaw)).length : 0);

  const bookmarksRaw = localStorage.getItem('bible_bookmarks');
  const bookmarks = bookmarksRaw ? JSON.parse(bookmarksRaw).length : 0;

  return { highlights, notes, bookmarks, readingDays: [] };
}

function buildWeekData(sessions: PrayerFlowSession[], streak: StreakData): WeekDay[] {
  const today = new Date();
  const days: WeekDay[] = [];
  const dayLabels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  const sessionDates = new Set(sessions.map(s => s.date.slice(0, 10)));

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const hasPrayer = sessionDates.has(dateStr);

    // Check reading from streak
    const isToday = i === 0;
    const hasReading = isToday
      ? streak.lastReadDate === dateStr
      : sessionDates.has(dateStr); // Approximation

    let intensity: 0 | 1 | 2 | 3 = 0;
    if (hasReading && hasPrayer) intensity = 3;
    else if (hasReading || hasPrayer) intensity = 2;
    else if (sessionDates.has(dateStr)) intensity = 1;

    days.push({
      date: dateStr,
      label: dayLabels[d.getDay()],
      hasReading,
      hasPrayer,
      intensity,
    });
  }

  return days;
}

function computeBadges(streak: StreakData, sessions: PrayerFlowSession[], pepites: Pepite[], localData: ReturnType<typeof collectLocalData>): Badge[] {
  const totalPrayerMin = sessions.reduce((acc, s) => acc + s.totalDurationSec, 0) / 60;

  return [
    {
      id: 'first-flame',
      icon: <Flame size={20} />,
      label: 'Première Flamme',
      description: 'Lire la Bible 1 jour de suite',
      earned: streak.current >= 1,
      progress: Math.min(1, streak.current / 1),
      color: '#f97316',
    },
    {
      id: 'week-warrior',
      icon: <Zap size={20} />,
      label: 'Guerrier de la Semaine',
      description: '7 jours de lecture consécutifs',
      earned: streak.best >= 7,
      progress: Math.min(1, streak.best / 7),
      color: '#eab308',
    },
    {
      id: 'prayer-warrior',
      icon: <Heart size={20} />,
      label: 'Guerrier de Prière',
      description: '10 sessions de prière guidée',
      earned: sessions.length >= 10,
      progress: Math.min(1, sessions.length / 10),
      color: '#ec4899',
    },
    {
      id: 'deep-diver',
      icon: <BookOpen size={20} />,
      label: 'Explorateur Profond',
      description: 'Lire 50 chapitres',
      earned: streak.totalChapters >= 50,
      progress: Math.min(1, streak.totalChapters / 50),
      color: '#3b82f6',
    },
    {
      id: 'treasure-hunter',
      icon: <Star size={20} />,
      label: 'Chasseur de Trésors',
      description: 'Collecter 5 pépites',
      earned: pepites.length >= 5,
      progress: Math.min(1, pepites.length / 5),
      color: '#D4AF37',
    },
    {
      id: 'highlighter',
      icon: <Sparkles size={20} />,
      label: 'Illuminateur',
      description: 'Surligner 20 versets',
      earned: localData.highlights >= 20,
      progress: Math.min(1, localData.highlights / 20),
      color: '#8b5cf6',
    },
  ];
}

// ============================================================
// Sub-Components
// ============================================================

function StatCard({ icon, label, value, subtext, color, delay = 0 }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="relative overflow-hidden rounded-2xl border border-[#e8ebf1] bg-white p-5 shadow-sm"
    >
      <div className="absolute -right-3 -top-3 opacity-[0.07]" style={{ color, fontSize: 64 }}>
        {icon}
      </div>
      <div
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {icon}
      </div>
      <div className="text-2xl font-extrabold tracking-tight text-[#141b37]">{value}</div>
      <div className="mt-0.5 text-xs font-semibold text-[#141b37]/50">{label}</div>
      {subtext && <div className="mt-1 text-[10px] text-[#141b37]/35">{subtext}</div>}
    </motion.div>
  );
}

function WeekHeatmap({ days }: { days: WeekDay[] }) {
  const intensityColors = [
    'bg-[#f0ede6]',
    'bg-amber-100',
    'bg-amber-300',
    'bg-amber-500',
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="rounded-2xl border border-[#e8ebf1] bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center gap-2">
        <Calendar size={16} className="text-amber-600" />
        <span className="text-sm font-bold text-[#141b37]">Cette semaine</span>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => (
          <div key={day.date} className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-semibold text-[#141b37]/40">{day.label}</span>
            <div
              className={`h-9 w-9 rounded-lg transition-all ${intensityColors[day.intensity]} ${
                day.intensity >= 2 ? 'ring-2 ring-amber-200/50' : ''
              }`}
              title={`${day.date}${day.hasReading ? ' 📖' : ''}${day.hasPrayer ? ' 🙏' : ''}`}
            />
            <div className="flex gap-0.5">
              {day.hasReading && <span className="text-[8px]">📖</span>}
              {day.hasPrayer && <span className="text-[8px]">🙏</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 text-[9px] text-[#141b37]/35">
        <span>Moins</span>
        {intensityColors.map((c, i) => (
          <div key={i} className={`h-3 w-3 rounded-sm ${c}`} />
        ))}
        <span>Plus</span>
      </div>
    </motion.div>
  );
}

function BadgeCard({ badge, index }: { badge: Badge; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 * index, duration: 0.4 }}
      className={`relative flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all ${
        badge.earned
          ? 'border-amber-200 bg-gradient-to-b from-amber-50/80 to-white shadow-sm'
          : 'border-[#e8ebf1] bg-white/50 opacity-60'
      }`}
    >
      {badge.earned && (
        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white shadow-lg">
          ✓
        </div>
      )}
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{
          backgroundColor: badge.earned ? `${badge.color}15` : '#f0f0f0',
          color: badge.earned ? badge.color : '#999',
        }}
      >
        {badge.icon}
      </div>
      <span className="text-[11px] font-bold text-[#141b37]">{badge.label}</span>
      <span className="text-[9px] text-[#141b37]/40">{badge.description}</span>
      {!badge.earned && (
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#f0ede6]">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${badge.progress * 100}%`, backgroundColor: badge.color }}
          />
        </div>
      )}
    </motion.div>
  );
}

function StreakFlame({ streak }: { streak: StreakData }) {
  const flameSize = Math.min(80, 32 + streak.current * 4);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="flex flex-col items-center rounded-2xl border border-amber-200/50 bg-gradient-to-b from-amber-50 to-[#fffdf8] p-6 shadow-sm"
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        className="relative"
      >
        <span style={{ fontSize: flameSize }} className="block drop-shadow-lg">
          🔥
        </span>
        {streak.current > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-xs font-black text-white shadow-lg"
          >
            {streak.current}
          </motion.div>
        )}
      </motion.div>
      <div className="mt-4 text-center">
        <div className="text-lg font-extrabold text-[#141b37]">
          {streak.current === 0
            ? 'Commence ta série !'
            : streak.current === 1
              ? '1 jour de suite'
              : `${streak.current} jours de suite`}
        </div>
        <div className="mt-1 text-xs text-[#141b37]/40">
          Record : {streak.best} jour{streak.best > 1 ? 's' : ''}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function SpiritualDashboard() {
  const [streak, setStreak] = useState<StreakData>({ current: 0, best: 0, lastReadDate: '', totalChapters: 0 });
  const [sessions, setSessions] = useState<PrayerFlowSession[]>([]);
  const [pepites, setPepites] = useState<Pepite[]>([]);
  const [localData, setLocalData] = useState({ highlights: 0, notes: 0, bookmarks: 0, readingDays: [] as string[] });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setStreak(getStreak());
    setSessions(getAllSessions());
    setPepites(pepitesStore.load());
    setLocalData(collectLocalData());
    setMounted(true);
  }, []);

  const weekDays = useMemo(() => buildWeekData(sessions, streak), [sessions, streak]);
  const badges = useMemo(() => computeBadges(streak, sessions, pepites, localData), [streak, sessions, pepites, localData]);
  const earnedCount = badges.filter(b => b.earned).length;

  const totalPrayerMinutes = Math.round(sessions.reduce((acc, s) => acc + s.totalDurationSec, 0) / 60);
  const totalPrayerSteps = sessions.reduce((acc, s) => acc + s.steps.filter(st => st.completed).length, 0);

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[#141b37]/40">
        Chargement du tableau de bord...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header motivationnel */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-amber-200/30 bg-gradient-to-r from-[#fdfaf3] to-[#fffdf8] p-6"
      >
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600/60">
          Tableau de Bord
        </div>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#141b37]">
          Ton parcours spirituel
        </h2>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-[#141b37]/50">
          Chaque jour de lecture et de prière te rapproche du cœur de Dieu.
          Continue de grandir, tu avances bien. 💛
        </p>
      </motion.div>

      {/* Streak + Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StreakFlame streak={streak} />
        <div className="grid grid-cols-2 gap-3 sm:col-span-1 lg:col-span-2">
          <StatCard
            icon={<BookOpen size={20} />}
            label="Chapitres lus"
            value={streak.totalChapters}
            subtext="Toute l'histoire"
            color="#3b82f6"
            delay={0.1}
          />
          <StatCard
            icon={<Clock size={20} />}
            label="Minutes de prière"
            value={totalPrayerMinutes}
            subtext={`${sessions.length} session${sessions.length > 1 ? 's' : ''}`}
            color="#ec4899"
            delay={0.15}
          />
          <StatCard
            icon={<Star size={20} />}
            label="Pépites collectées"
            value={pepites.length}
            subtext="Trésors d'identité"
            color="#D4AF37"
            delay={0.2}
          />
          <StatCard
            icon={<Sparkles size={20} />}
            label="Versets surlignés"
            value={localData.highlights}
            subtext={`${localData.notes} note${localData.notes > 1 ? 's' : ''}`}
            color="#8b5cf6"
            delay={0.25}
          />
        </div>
      </div>

      {/* Heatmap Semaine */}
      <WeekHeatmap days={weekDays} />

      {/* Badges */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Award size={16} className="text-amber-600" />
          <span className="text-sm font-bold text-[#141b37]">
            Jalons spirituels
          </span>
          <span className="ml-auto text-xs text-[#141b37]/40">
            {earnedCount}/{badges.length} débloqués
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {badges.map((badge, i) => (
            <BadgeCard key={badge.id} badge={badge} index={i} />
          ))}
        </div>
      </div>

      {/* Dernière session de prière */}
      {sessions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-2xl border border-[#e8ebf1] bg-white p-5 shadow-sm"
        >
          <div className="mb-3 flex items-center gap-2">
            <Heart size={16} className="text-pink-500" />
            <span className="text-sm font-bold text-[#141b37]">Dernière session de prière</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {sessions[0].steps.map((step, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold ${
                  step.completed
                    ? 'bg-green-50 text-green-700'
                    : 'bg-gray-50 text-gray-400'
                }`}
              >
                {step.emoji} {step.label}
              </span>
            ))}
          </div>
          <div className="mt-3 text-[10px] text-[#141b37]/35">
            {new Date(sessions[0].date).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
            {' · '}
            {Math.round(sessions[0].totalDurationSec / 60)} min
          </div>
        </motion.div>
      )}
    </div>
  );
}
