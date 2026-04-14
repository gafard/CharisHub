'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  BookOpen,
  Calendar,
  Check,
  Clock,
  Cloud,
  Copy,
  Flame,
  Heart,
  Info,
  MessageCircle,
  Quote,
  RefreshCw,
  Share2,
  Star,
  Sun,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react';
import { getStreak, type StreakData } from '@/lib/bibleStreak';
import { getAllSessions, type PrayerFlowSession } from '@/lib/prayerFlowStore';
import { pepitesStore, type Pepite } from '@/lib/pepitesStore';
import { useAuth } from '@/contexts/AuthContext';
import { performInitialSync } from '@/lib/cloudSync';
import { WordsPullUp, WordsPullUpMultiStyle } from './ui/PrismaAnimations';

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

function getPastoralWord(): { title: string; text: string } {
  return {
    title: "Dieu t'aime inconditionnellement",
    text: "Cet espace n'est pas un lieu de performance, mais un jardin de mémoire. Chaque minute passée avec Lui est un repas pour ton âme. Sois transformé par Sa présence."
  };
}

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
            <Sun size={14} className="text-white/80" />
            <span className="text-[10px] font-black uppercase tracking-widest">Identité du Jour</span>
          </div>
          <button className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all">
            <Share2 size={16} />
          </button>
        </div>

        <Quote size={32} className="mb-4 opacity-30" />
        <WordsPullUp 
          text={`« ${verse.text} »`}
          className="text-xl md:text-2xl font-black leading-tight tracking-tight !justify-start !text-left"
        />
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
      <div className="noise-overlay opacity-[0.25]" />
    </motion.div>
  );
}

function PepiteCard({ pepite }: { pepite: Pepite }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[24px] border border-border-soft bg-surface-strong/40 p-5 backdrop-blur-md shadow-sm"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
           <Star size={16} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-accent/70">Pépite découverte</span>
      </div>
      <p className="text-sm font-medium text-foreground leading-relaxed italic">« {pepite.text} »</p>
      <div className="mt-4 text-[10px] font-bold text-muted uppercase tracking-wider">{pepite.reference}</div>
    </motion.div>
  );
}

function PastoralInsight() {
  const word = getPastoralWord();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="flex items-start gap-4 rounded-[28px] border border-border-soft bg-surface/40 p-6 backdrop-blur-xl shadow-lg ring-1 ring-black/5"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D4FF33] text-black shadow-inner">
        <Heart size={24} />
      </div>
       <div>
        <h4 className="text-sm font-black text-foreground uppercase tracking-wide">{word.title}</h4>
        <WordsPullUpMultiStyle 
          segments={[{ text: word.text, className: "mt-1 text-xs leading-relaxed text-muted" }]}
          className="!justify-start !text-left"
        />
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
      className="relative overflow-hidden rounded-[28px] border border-border-soft bg-surface-strong/60 p-5 backdrop-blur-md shadow-sm ring-1 ring-black/[0.02]"
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
      <div className="text-2xl font-black tracking-tight text-foreground">{value}</div>
      <div className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-muted">{label}</div>
      {subtext && <div className="mt-1 text-[9px] font-bold text-muted italic">{subtext}</div>}
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
      className="rounded-[28px] border border-border-soft bg-surface/50 p-6 backdrop-blur-md shadow-sm"
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-amber-600" />
          <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Activité Hebdo</span>
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
            <span className="text-[9px] font-black text-muted uppercase">{day.label}</span>
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
  const totalPrayerMinutes = Math.round(sessions.reduce((acc, s) => acc + s.totalDurationSec, 0) / 60);

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-[10px] font-black uppercase tracking-widest text-muted">
        Chargement...
      </div>
    );
  }

  return (
    <div className="relative space-y-8 pb-10 bg-noise min-h-screen">
      <div className="noise-overlay fixed inset-0 z-0 opacity-[0.05] pointer-events-none" />
      
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
            className="flex items-center gap-2 rounded-full bg-surface-strong/40 px-3 py-1.5 backdrop-blur-md border border-border-soft text-[10px] font-black tracking-wider text-muted hover:bg-surface-strong/60 transition-colors"
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
        <section className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
             <DailyVerseCard verse={dailyVerse} />
          </div>
          <div className="lg:w-1/3 flex flex-col gap-6">
             <div className="flex flex-col items-center justify-center rounded-[32px] border border-blue-200/50 bg-gradient-to-b from-blue-50/20 to-surface p-6 shadow-sm ring-1 ring-blue-100/50">
               <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface shadow-sm mb-4">
                  <Sun size={28} className="text-blue-600" />
               </div>
               <div className="text-center">
                 <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600/60 mb-1">Cœur de Grâce</div>
                 <div className="text-xl font-black text-foreground">Paix soit avec toi</div>
               </div>
             </div>
             <PastoralInsight />
          </div>
        </section>

        {/* Memory Grid */}
        <section>
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-muted/40" />
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Mémoire de Ses bontés</h4>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<BookOpen size={20} />} label="Paroles méditées" value={streak.totalChapters} subtext="Trésors ouverts" color="#3b82f6" delay={0.1} />
            <StatCard icon={<Clock size={20} />} label="Intimité" value={`${totalPrayerMinutes}m`} subtext={`${sessions.length} rencontres`} color="#ec4899" delay={0.15} />
            <StatCard icon={<Star size={20} />} label="Favoris" value={pepites.length} subtext="Lumières d'identité" color="#D4AF37" delay={0.2} />
            <StatCard icon={<Sun size={20} />} label="Réflexions" value={localData.highlights} subtext={`${localData.notes} notes`} color="#8b5cf6" delay={0.25} />
          </div>
        </section>

        {/* Heatmap Section */}
        <section>
          <WeekHeatmap days={weekDays} />
        </section>

        {/* Pepites Section */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star size={18} className="text-accent fill-accent/20" />
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Derniers Trésors</h4>
            </div>
            <div className="rounded-full bg-foreground/5 px-2 py-0.5 text-[9px] font-black">
               {pepites.length} trouvés
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pepites.slice(0, 6).map((pepite, i) => (
              <PepiteCard key={i} pepite={pepite} />
            ))}
            {pepites.length === 0 && (
              <div className="col-span-full py-10 text-center text-xs font-bold text-[#141b37]/20 border-2 border-dashed border-black/5 rounded-[32px]">
                Prends un temps de pause, Dieu a une pépite pour toi aujourd'hui.
              </div>
            )}
          </div>
        </section>

        {/* Recent Prayer Summary */}
        {sessions.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="rounded-[32px] border border-border-soft bg-gradient-to-br from-surface/80 to-surface/40 p-6 backdrop-blur-xl shadow-inner"
          >
            <div className="mb-4 flex items-center gap-2">
              <MessageCircle size={16} className="text-pink-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted">Dernier temps avec Lui</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {sessions[0].steps.filter(s => s.completed).map((step, i) => (
                <span key={i} className="flex items-center gap-1.5 rounded-xl bg-surface-strong/50 border border-border-soft px-3 py-1.5 text-[10px] font-bold text-foreground/80">
                  {step.emoji} {step.label}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between text-[10px] font-bold text-muted italic">
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
