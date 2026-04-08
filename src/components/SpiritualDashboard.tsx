'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame, BookOpen, Heart, Star, TrendingUp, Clock,
  Calendar, Award, Zap, MessageCircle, Users, Sparkles,
  Quote, Copy, Share2, Info
} from 'lucide-react';
import { getStreak, type StreakData } from '@/lib/bibleStreak';
import { getAllSessions, type PrayerFlowSession } from '@/lib/prayerFlowStore';
import { pepitesStore, type Pepite } from '@/lib/pepitesStore';
import { useAuth } from '@/contexts/AuthContext';
import { performInitialSync } from '@/lib/cloudSync';
import { RefreshCw, Check, Cloud } from 'lucide-react';

// ============================================================
// Types & Data
// ============================================================

type DailyVerse = {
  text: string;
  ref: string;
  theme: 'blue' | 'purple' | 'amber' | 'rose';
};

const DAILY_VERSES: DailyVerse[] = [
  { text: "Je puis tout par celui qui me fortifie.", ref: "Philippiens 4:13", theme: 'blue' },
  { text: "L'Éternel est mon berger: je ne manquerai de rien.", ref: "Psaume 23:1", theme: 'amber' },
  { text: "Car je connais les projets que j'ai formés sur vous, dit l'Éternel, projets de paix et non de malheur.", ref: "Jérémie 29:11", theme: 'purple' },
  { text: "Ne t'ai-je pas donné cet ordre: Fortifie-toi et prends courage ?", ref: "Josué 1:9", theme: 'rose' },
];

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
// Helpers
// ============================================================

function getPastoralWord(streak: StreakData): { title: string; text: string } {
  if (streak.current >= 7) {
    return {
      title: "La Puissance de la Constance",
      text: "Ta fidélité de 7 jours est un témoignage puissant. Continue de bâtir sur cette fondation solide, le Seigneur honore ta persévérance !"
    };
  }
  if (streak.current >= 3) {
    return {
      title: "Tu Prends de l'Élan",
      text: "Quel bonheur de voir ta série s'allonger. Ces moments quotidiens avec la Parole transforment ton cœur en profondeur."
    };
  }
  if (streak.current > 0) {
    return {
      title: "Un Pas après l'Autre",
      text: "Tu as fait le plus dur : commencer. Garde ce feu allumé aujourd'hui, une pépite t'attend dans ta lecture."
    };
  }
  return {
    title: "Dieu t'Attendait",
    text: "Heureux de te revoir ! Ne regarde pas en arrière, aujourd'hui est une nouvelle opportunité de puiser à la Source."
  };
}

// ... (fonctions collectLocalData, buildWeekData, computeBadges inchangées mais réorganisées si besoin) ...
function collectLocalData() {
  if (typeof window === 'undefined') {
    return { highlights: 0, notes: 0, bookmarks: 0, readingDays: [] as string[] };
  }
  const hlRaw = localStorage.getItem('formation_biblique_bible_highlights_v1');
  const hl = hlRaw ? Object.keys(JSON.parse(hlRaw)).length : 0;
  const ntRaw = localStorage.getItem('formation_biblique_bible_notes_v1');
  const vntRaw = localStorage.getItem('formation_biblique_bible_verse_notes_v1');
  const nt = (ntRaw ? Object.keys(JSON.parse(ntRaw)).length : 0) + (vntRaw ? Object.keys(JSON.parse(vntRaw)).length : 0);
  const bmRaw = localStorage.getItem('bible_bookmarks');
  const bm = bmRaw ? JSON.parse(bmRaw).length : 0;
  return { highlights: hl, notes: nt, bookmarks: bm, readingDays: [] };
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
    const isToday = i === 0;
    const hasReading = isToday ? streak.lastReadDate === dateStr : sessionDates.has(dateStr);
    let intensity: 0 | 1 | 2 | 3 = 0;
    if (hasReading && hasPrayer) intensity = 3;
    else if (hasReading || hasPrayer) intensity = 2;
    else if (sessionDates.has(dateStr)) intensity = 1;
    days.push({ date: dateStr, label: dayLabels[d.getDay()], hasReading, hasPrayer, intensity });
  }
  return days;
}

function computeBadges(streak: StreakData, sessions: PrayerFlowSession[], pepites: Pepite[], localData: ReturnType<typeof collectLocalData>): Badge[] {
  return [
    { id: 'first-flame', icon: <Flame size={20} />, label: 'Première Flamme', description: 'Lire la Bible 1 jour de suite', earned: streak.current >= 1, progress: Math.min(1, streak.current / 1), color: '#f97316' },
    { id: 'week-warrior', icon: <Zap size={20} />, label: 'Guerrier de la Semaine', description: '7 jours de lecture consécutifs', earned: streak.best >= 7, progress: Math.min(1, streak.best / 7), color: '#eab308' },
    { id: 'prayer-warrior', icon: <Heart size={20} />, label: 'Guerrier de Prière', description: '10 sessions de prière guidée', earned: sessions.length >= 10, progress: Math.min(1, sessions.length / 10), color: '#ec4899' },
    { id: 'deep-diver', icon: <BookOpen size={20} />, label: 'Explorateur Profond', description: 'Lire 50 chapitres', earned: streak.totalChapters >= 50, progress: Math.min(1, streak.totalChapters / 50), color: '#3b82f6' },
    { id: 'treasure-hunter', icon: <Star size={20} />, label: 'Chasseur de Trésors', description: 'Collecter 5 pépites', earned: pepites.length >= 5, progress: Math.min(1, pepites.length / 5), color: '#D4AF37' },
    { id: 'highlighter', icon: <Sparkles size={20} />, label: 'Illuminateur', description: 'Surligner 20 versets', earned: localData.highlights >= 20, progress: Math.min(1, localData.highlights / 20), color: '#8b5cf6' },
  ];
}

// ============================================================
// Premium Sub-Components
// ============================================================

function DailyVerseCard({ verse }: { verse: DailyVerse }) {
  const themeStyles = {
    blue: 'from-blue-600 to-indigo-700 shadow-blue-500/20',
    purple: 'from-purple-600 to-violet-800 shadow-purple-500/20',
    amber: 'from-amber-500 to-orange-600 shadow-amber-500/20',
    rose: 'from-rose-500 to-pink-600 shadow-rose-500/20',
  }[verse.theme];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative overflow-hidden rounded-[32px] bg-gradient-to-br ${themeStyles} p-8 text-white shadow-2xl`}
    >
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute bottom-[-20px] left-[-20px] h-32 w-32 rounded-full bg-black/10 blur-2xl" />
      
      <div className="relative z-10">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 backdrop-blur-md">
            <Sparkles size={14} className="text-white/80" />
            <span className="text-[10px] font-black uppercase tracking-widest">Identité du Jour</span>
          </div>
          <button className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all">
            <Share2 size={16} />
          </button>
        </div>

        <Quote size={32} className="mb-4 opacity-30" />
        <h3 className="text-xl md:text-2xl font-black leading-tight tracking-tight">
          « {verse.text} »
        </h3>
        <p className="mt-4 text-sm font-bold text-white/70 uppercase tracking-widest">
          {verse.ref}
        </p>

        <div className="mt-8 flex gap-3">
          <button 
            onClick={() => navigator.clipboard.writeText(`"${verse.text}" - ${verse.ref}`)}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-black uppercase tracking-wider text-black transition-transform active:scale-95"
          >
            <Copy size={16} /> Copier
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function PastoralInsight({ streak }: { streak: StreakData }) {
  const word = getPastoralWord(streak);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="flex items-start gap-4 rounded-[28px] border border-white/50 bg-white/40 p-6 backdrop-blur-xl shadow-lg ring-1 ring-black/5"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D4FF33] text-black shadow-inner">
        <Users size={24} />
      </div>
      <div>
        <h4 className="text-sm font-black text-[#141b37] uppercase tracking-wide">{word.title}</h4>
        <p className="mt-1 text-xs leading-relaxed text-[#141b37]/60">
          {word.text}
        </p>
      </div>
    </motion.div>
  );
}

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
      className="relative overflow-hidden rounded-[28px] border border-white/60 bg-white/60 p-5 backdrop-blur-md shadow-sm ring-1 ring-black/[0.02]"
    >
      <div className="absolute -right-3 -top-3 opacity-[0.05]" style={{ color, fontSize: 64 }}>
        {icon}
      </div>
      <div
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {icon}
      </div>
      <div className="text-2xl font-black tracking-tight text-[#141b37]">{value}</div>
      <div className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-[#141b37]/40">{label}</div>
      {subtext && <div className="mt-1 text-[9px] font-bold text-[#141b37]/30 italic">{subtext}</div>}
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
      className="rounded-[28px] border border-white/60 bg-white/50 p-6 backdrop-blur-md shadow-sm"
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-amber-600" />
          <span className="text-[10px] font-black uppercase tracking-widest text-[#141b37]">Activité Hebdo</span>
        </div>
        <div className="flex items-center gap-1">
           {intensityColors.map((c, i) => (
             <div key={i} className={`h-2 w-2 rounded-full ${c}`} />
           ))}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-3">
        {days.map((day) => (
          <div key={day.date} className="flex flex-col items-center gap-2">
            <span className="text-[9px] font-black text-[#141b37]/30 uppercase">{day.label}</span>
            <div
              className={`h-9 w-9 md:h-11 md:w-11 rounded-xl transition-all ${intensityColors[day.intensity]} ${
                day.intensity >= 2 ? 'ring-2 ring-amber-200/50 shadow-md shadow-amber-500/10' : ''
              }`}
            />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function BadgeCard({ badge, index }: { badge: Badge; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.05 * index, duration: 0.4 }}
      whileHover={{ y: -4 }}
      className={`relative flex flex-col items-center gap-2 rounded-[24px] border p-4 text-center transition-all ${
        badge.earned
          ? 'border-amber-200 bg-gradient-to-b from-amber-50/50 to-white shadow-md'
          : 'border-black/5 bg-black/[0.02] grayscale opacity-40'
      }`}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-inner"
        style={{
          backgroundColor: badge.earned ? `${badge.color}15` : '#f0f0f0',
          color: badge.earned ? badge.color : '#999',
        }}
      >
        {badge.icon}
      </div>
      <span className="text-[10px] font-black uppercase tracking-tight text-[#141b37]">{badge.label}</span>
      {!badge.earned && (
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[#f0ede6]">
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
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center rounded-[32px] border border-amber-200/50 bg-gradient-to-b from-amber-50/80 to-[#fffdf8] p-6 shadow-sm ring-1 ring-amber-100/50"
    >
      <div className="relative mb-4">
        <motion.div
           animate={{ scale: [1, 1.1, 1] }}
           transition={{ repeat: Infinity, duration: 4 }}
           className="h-20 w-20 rounded-full bg-amber-500/10 blur-2xl absolute inset-0"
        />
        <span className="text-5xl block drop-shadow-xl relative z-10">🔥</span>
        <div className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-white shadow-lg ring-2 ring-white">
          {streak.current}
        </div>
      </div>
      <div className="text-center">
        <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-600/60 mb-1">Série Actuelle</div>
        <div className="text-xl font-black text-[#141b37]">
          {streak.current} JOUR{streak.current > 1 ? 'S' : ''}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function SpiritualDashboard() {
  const { user } = useAuth();
  const [streak, setStreak] = useState<StreakData>({ current: 0, best: 0, lastReadDate: '', totalChapters: 0 });
  const [sessions, setSessions] = useState<PrayerFlowSession[]>([]);
  const [pepites, setPepites] = useState<Pepite[]>([]);
  const [localData, setLocalData] = useState({ highlights: 0, notes: 0, bookmarks: 0, readingDays: [] as string[] });
  const [mounted, setMounted] = useState(false);
  const [dailyVerse, setDailyVerse] = useState<DailyVerse>(DAILY_VERSES[0]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncDate, setLastSyncDate] = useState<string | null>(null);

  const refreshLocalState = () => {
    setStreak(getStreak());
    setSessions(getAllSessions());
    setPepites(pepitesStore.load());
    setLocalData(collectLocalData());
  };

  useEffect(() => {
    refreshLocalState();
    
    // Pick daily verse based on date
    const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    setDailyVerse(DAILY_VERSES[dayOfYear % DAILY_VERSES.length]);
    
    // Load last sync date
    const syncMetaRaw = localStorage.getItem('user_sync_metadata');
    if (syncMetaRaw) {
      try {
        const meta = JSON.parse(syncMetaRaw);
        if (meta.last_sync_at) setLastSyncDate(new Date(meta.last_sync_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } catch (e) {}
    }

    setMounted(true);

    // Auto sync on mount if logged in
    if (user) {
      handleSync();
    }
  }, [user]);

  const handleSync = async () => {
    if (!user || isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await performInitialSync();
      if (result.success) {
        refreshLocalState();
        setLastSyncDate(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const weekDays = useMemo(() => buildWeekData(sessions, streak), [sessions, streak]);
  const badges = useMemo(() => computeBadges(streak, sessions, pepites, localData), [streak, sessions, pepites, localData]);
  const earnedCount = badges.filter(b => b.earned).length;

  const totalPrayerMinutes = Math.round(sessions.reduce((acc, s) => acc + s.totalDurationSec, 0) / 60);

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-[10px] font-black uppercase tracking-widest text-[#141b37]/20">
        Chargement...
      </div>
    );
  }

  return (
    <div className="relative space-y-8 pb-10">
      {/* Background Orbs */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute left-[10%] top-[5%] h-[400px] w-[400px] rounded-full bg-blue-500/5 blur-[120px]" />
        <div className="absolute right-[5%] bottom-[10%] h-[350px] w-[350px] rounded-full bg-amber-500/5 blur-[100px]" />
      </div>

      {/* Cloud Sync Status */}
      {user && (
        <div className="flex justify-end pr-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 rounded-full bg-white/40 px-3 py-1.5 backdrop-blur-md border border-white/50 text-[10px] font-black tracking-wider text-[#141b37]/60 hover:bg-white/60 transition-colors"
          >
            {isSyncing ? (
              <RefreshCw size={12} className="animate-spin text-amber-500" />
            ) : (
              <Cloud size={12} className="text-blue-500" />
            )}
            {isSyncing ? 'Synchronisation...' : lastSyncDate ? `Synchronisé à ${lastSyncDate}` : 'Synchroniser'}
          </motion.button>
        </div>
      )}

      <div className="relative z-10 space-y-8">
        {/* Header Section */}
        <section className="flex flex-col md:flex-row gap-6">
          <div className="flex-1">
             <DailyVerseCard verse={dailyVerse} />
          </div>
          <div className="md:w-1/3 flex flex-col gap-6">
             <StreakFlame streak={streak} />
             <PastoralInsight streak={streak} />
          </div>
        </section>

        {/* Quick Stats Grid */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-[#141b37]/30" />
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#141b37]/40">Statistiques Glissantes</h4>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<BookOpen size={20} />} label="Chapitres" value={streak.totalChapters} subtext="Biblio intégrale" color="#3b82f6" delay={0.1} />
            <StatCard icon={<Clock size={20} />} label="Prière" value={`${totalPrayerMinutes}m`} subtext={`${sessions.length} sessions`} color="#ec4899" delay={0.15} />
            <StatCard icon={<Star size={20} />} label="Pépites" value={pepites.length} subtext="Identité trouvée" color="#D4AF37" delay={0.2} />
            <StatCard icon={<Sparkles size={20} />} label="Lumières" value={localData.highlights} subtext={`${localData.notes} réflexions`} color="#8b5cf6" delay={0.25} />
          </div>
        </section>

        {/* Heatmap Section */}
        <section>
          <WeekHeatmap days={weekDays} />
        </section>

        {/* Awards Section */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award size={18} className="text-amber-500" />
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#141b37]/40">Collection de Badges</h4>
            </div>
            <div className="rounded-full bg-black/5 px-2 py-0.5 text-[9px] font-black">
               {earnedCount}/{badges.length}
            </div>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {badges.map((badge, i) => (
              <BadgeCard key={badge.id} badge={badge} index={i} />
            ))}
          </div>
        </section>

        {/* Recent Prayer Summary */}
        {sessions.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="rounded-[32px] border border-white/60 bg-gradient-to-br from-white/80 to-white/40 p-6 backdrop-blur-xl shadow-inner shadow-white/50"
          >
            <div className="mb-4 flex items-center gap-2">
              <MessageCircle size={16} className="text-pink-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[#141b37]/40">Dernière Intimité</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {sessions[0].steps.filter(s => s.completed).map((step, i) => (
                <span key={i} className="flex items-center gap-1.5 rounded-xl bg-white/50 border border-white px-3 py-1.5 text-[10px] font-bold text-[#141b37]/80">
                  {step.emoji} {step.label}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between text-[10px] font-bold text-[#141b37]/30 italic">
               <span>
                 {new Date(sessions[0].date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
               </span>
               <div className="flex items-center gap-1">
                 <Clock size={12} /> {Math.round(sessions[0].totalDurationSec / 60)} min
               </div>
            </div>
          </motion.section>
        )}
      </div>
    </div>
  );
}
