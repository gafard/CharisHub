'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Check, Loader2, Star, X } from 'lucide-react';
import { useState } from 'react';
import type { ReadingPlan } from '@/lib/readingPlanCatalog';

interface Props {
  onClose: () => void;
  onPlanReady: (plan: ReadingPlan) => void;
}

const DURATION_OPTIONS = [7, 14, 21, 30, 40, 60, 90];
const CHAPTERS_OPTIONS = [1, 2, 3];
const TESTAMENT_OPTIONS = [
  { value: 'NT', label: 'Nouveau Testament' },
  { value: 'AT', label: 'Ancien Testament' },
  { value: 'both', label: 'Les deux' },
];

const THEME_SUGGESTIONS = [
  'Identité en Christ',
  'Psaumes de louange',
  'La grâce selon Paul',
  'Le sermon sur la montagne',
  'Prophètes et accomplissement',
  'La vie de Jésus',
  'Sagesse de Salomon',
  'Foi et promesses',
  'Le Saint-Esprit',
  "L'Église primitive",
];

export default function PersonalizedPlanModal({ onClose, onPlanReady }: Props) {
  const [theme, setTheme] = useState('');
  const [duration, setDuration] = useState(30);
  const [chaptersPerDay, setChaptersPerDay] = useState(1);
  const [testament, setTestament] = useState<'AT' | 'NT' | 'both'>('both');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState<ReadingPlan | null>(null);

  const handleGenerate = async () => {
    if (!theme.trim()) { setError('Saisis un thème pour ton plan.'); return; }
    setError('');
    setLoading(true);
    setGenerated(null);

    try {
      const res = await fetch('/api/bible/generate-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ theme, durationDays: duration, chaptersPerDay, testament }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Erreur lors de la génération.');
        return;
      }
      setGenerated(data as ReadingPlan);
    } catch {
      setError('Vision Charis est momentanément indisponible. Réessaie.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="relative w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] bg-gradient-to-b from-violet-950 to-slate-900 p-6 pb-8 shadow-2xl overflow-y-auto"
        style={{ maxHeight: '90dvh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-violet-500/20 flex items-center justify-center">
              <Star size={18} className="text-violet-400 fill-violet-400/20" />
            </div>
            <div>
              <div className="text-sm font-black text-white">Plan Personnalisé</div>
              <div className="text-[9px] font-bold text-violet-400 uppercase tracking-widest">Vision Charis</div>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full bg-white/10 text-white/60 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {generated ? (
            /* ── Plan preview ── */
            <motion.div key="preview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="rounded-[24px] border border-violet-400/20 bg-white/5 p-5">
                <div className="text-2xl mb-2">{generated.emoji}</div>
                <h3 className="text-lg font-black text-white">{generated.name}</h3>
                <p className="text-sm text-white/60 mt-1 leading-relaxed">{generated.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-xl bg-white/8 border border-white/10 px-3 py-1 text-[10px] font-bold text-white/60">
                    {generated.days.length} jours
                  </span>
                  <span className="rounded-xl bg-white/8 border border-white/10 px-3 py-1 text-[10px] font-bold text-white/60">
                    {chaptersPerDay} ch/jour
                  </span>
                  <span className="rounded-xl bg-violet-500/20 border border-violet-400/20 px-3 py-1 text-[10px] font-bold text-violet-300">
                    Vision Charis
                  </span>
                </div>
              </div>

              {/* Preview first 3 days */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Aperçu</p>
                {generated.days.slice(0, 3).map((d, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-2xl bg-white/5 border border-white/8 px-4 py-3">
                    <span className="text-[10px] font-black text-violet-400 mt-0.5">Jour {i + 1}</span>
                    <div className="flex-1 min-w-0">
                      {d.note && <p className="text-xs text-white/50 italic mb-1">{d.note}</p>}
                      {d.readings.map((r, j) => (
                        <p key={j} className="text-xs font-bold text-white/80">
                          {r.bookName} {r.chapters.length === 1 ? r.chapters[0] : `${r.chapters[0]}–${r.chapters[r.chapters.length-1]}`}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
                {generated.days.length > 3 && (
                  <p className="text-center text-[10px] text-white/30">+ {generated.days.length - 3} autres jours...</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setGenerated(null)}
                  className="flex-1 rounded-2xl border border-white/15 bg-white/8 py-3 text-sm font-black text-white/70 hover:bg-white/12"
                >
                  Régénérer
                </button>
                <button
                  onClick={() => onPlanReady(generated)}
                  className="flex-1 rounded-2xl bg-violet-500 hover:bg-violet-400 py-3 text-sm font-black text-white flex items-center justify-center gap-2"
                >
                  <Check size={16} /> Utiliser ce plan
                </button>
              </div>
            </motion.div>
          ) : (
            /* ── Form ── */
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              {/* Theme */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-2 block">Thème ou sujet biblique</label>
                <input
                  type="text"
                  value={theme}
                  onChange={e => setTheme(e.target.value)}
                  placeholder="ex: La grâce dans les épîtres de Paul..."
                  className="w-full rounded-2xl bg-white/5 border border-white/15 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-violet-400/50"
                />
                {/* Suggestions */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {THEME_SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => setTheme(s)}
                      className="rounded-xl bg-white/5 border border-white/10 px-2.5 py-1 text-[10px] font-bold text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-2 block">Durée</label>
                <div className="flex flex-wrap gap-2">
                  {DURATION_OPTIONS.map(d => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-black transition-all ${duration === d ? 'bg-violet-500 border-violet-500 text-white' : 'bg-white/5 border-white/15 text-white/60 hover:bg-white/10'}`}
                    >
                      {d}j
                    </button>
                  ))}
                </div>
              </div>

              {/* Chapters per day */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-2 block">Chapitres par jour</label>
                <div className="flex gap-2">
                  {CHAPTERS_OPTIONS.map(c => (
                    <button
                      key={c}
                      onClick={() => setChaptersPerDay(c)}
                      className={`flex-1 rounded-xl border py-2 text-sm font-black transition-all ${chaptersPerDay === c ? 'bg-violet-500 border-violet-500 text-white' : 'bg-white/5 border-white/15 text-white/60 hover:bg-white/10'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Testament */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-2 block">Testament</label>
                <div className="flex flex-col gap-2">
                  {TESTAMENT_OPTIONS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setTestament(t.value as 'AT' | 'NT' | 'both')}
                      className={`rounded-xl border px-4 py-2.5 text-sm font-bold text-left transition-all ${testament === t.value ? 'bg-violet-500/20 border-violet-400/40 text-violet-300' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/8'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-sm text-red-400 font-bold">{error}</p>}

              <button
                onClick={handleGenerate}
                disabled={loading || !theme.trim()}
                className="w-full rounded-2xl bg-violet-500 hover:bg-violet-400 disabled:opacity-40 py-3.5 text-sm font-black text-white flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Génération en cours...</>
                ) : (
                  <><Star size={16} /> Générer mon plan</>
                )}
              </button>

              <p className="text-center text-[10px] text-white/25">
                La génération peut prendre 10-20 secondes
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
