'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';

/* ── Messages contextuels ─────────────────────────────────────────────── */

const GENERIC_MESSAGES = [
  "Méditation sur vos réflexions...",
  "Recherche de résonances bibliques...",
  "Préparation de votre éclairage...",
  "Harmonisation avec le contexte du jour...",
  "Écoute des échos spirituels du passage...",
  "Préparation d'un éclairage sur mesure...",
];

const PRAYER_MESSAGES = [
  "Préparation de votre temps de prière...",
  "Recherche d'échos dans vos réflexions...",
  "Composition d'invitations à prier...",
  "Écoute de ce que l'Esprit murmure...",
  "Tissage des fils de votre méditation...",
  "Harmonisation avec la Parole lue...",
];

const PLAN_MESSAGES = [
  "Construction de votre parcours spirituel...",
  "Sélection des passages clés...",
  "Organisation du rythme de lecture...",
  "Adaptation à votre thème...",
  "Finalisation de votre plan...",
  "Derniers ajustements...",
];

const LECTIO_MESSAGES = [
  "Écoute contemplative du texte...",
  "Recherche de questions pour votre cœur...",
  "Préparation d'une invitation à prier...",
  "Méditation sur les paroles de vie...",
];

const MESSAGE_MAP: Record<string, string[]> = {
  prayer: PRAYER_MESSAGES,
  plan: PLAN_MESSAGES,
  lectio: LECTIO_MESSAGES,
  generic: GENERIC_MESSAGES,
};

/* ── Versets de nourriture spirituelle ──────────────────────────────── */

const VERSES = [
  { text: "La parole de Dieu est vivante et efficace.", ref: "Hébreux 4:12" },
  { text: "Ta parole est une lampe à mes pieds, une lumière sur mon sentier.", ref: "Psaume 119:105" },
  { text: "Ma grâce te suffit, car ma puissance s'accomplit dans la faiblesse.", ref: "2 Corinthiens 12:9" },
  { text: "Je puis tout par celui qui me fortifie.", ref: "Philippiens 4:13" },
  { text: "Le Seigneur est ma lumière et mon salut, de qui aurais-je crainte ?", ref: "Psaume 27:1" },
  { text: "Que ta parole soit la joie et l'allégresse de mon cœur.", ref: "Jérémie 15:16" },
  { text: "Venez à moi, vous tous qui êtes fatigués et chargés, et je vous donnerai du repos.", ref: "Matthieu 11:28" },
  { text: "L'Éternel est mon berger : je ne manquerai de rien.", ref: "Psaume 23:1" },
  { text: "Car je connais les projets que j'ai formés sur vous, projets de paix et non de malheur.", ref: "Jérémie 29:11" },
  { text: "Sois tranquille, et sache que je suis Dieu.", ref: "Psaume 46:10" },
  { text: "Mais ceux qui se confient en l'Éternel renouvellent leur force.", ref: "Ésaïe 40:31" },
  { text: "L'amour est patient, l'amour est plein de bonté.", ref: "1 Corinthiens 13:4" },
];

/* ── Types ──────────────────────────────────────────────────────────── */

interface AILoaderProps {
  /** "full" = écran centré, "compact" = inline petit, "inline" = minimal */
  variant?: 'full' | 'compact' | 'inline';
  /** Contexte affiché (ex: "Psaume 23", "Jean 3") — personnalise les messages */
  context?: string;
  /** Type de contenu généré — choisit le jeu de messages adapté */
  type?: 'prayer' | 'plan' | 'lectio' | 'generic';
  /** Afficher un verset biblique pendant l'attente */
  showVerse?: boolean;
  /** Afficher une barre de progression estimée */
  showProgress?: boolean;
  /** Durée estimée en secondes (pour la barre de progression) */
  estimatedDuration?: number;
  /** Callback d'annulation — affiche un bouton Annuler */
  onCancel?: () => void;
}

/* ── Composant ──────────────────────────────────────────────────────── */

export default function AILoader({
  variant = 'full',
  context,
  type = 'generic',
  showVerse = true,
  showProgress = false,
  estimatedDuration = 15,
  onCancel,
}: AILoaderProps) {
  const messages = MESSAGE_MAP[type] || GENERIC_MESSAGES;
  const [messageIndex, setMessageIndex] = useState(0);
  const [verseIndex, setVerseIndex] = useState(() => Math.floor(Math.random() * VERSES.length));
  const [progressPercent, setProgressPercent] = useState(0);

  // Rotation des messages toutes les 3s
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [messages]);

  // Rotation des versets toutes les 8s
  useEffect(() => {
    if (!showVerse) return;
    const interval = setInterval(() => {
      setVerseIndex((prev) => (prev + 1) % VERSES.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [showVerse]);

  // Barre de progression estimée
  useEffect(() => {
    if (!showProgress) return;
    setProgressPercent(0);
    const stepMs = 200;
    const totalSteps = (estimatedDuration * 1000) / stepMs;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      // Courbe logarithmique : accélère vite puis ralentit (ne dépasse jamais 95%)
      const raw = Math.min(step / totalSteps, 1);
      const eased = Math.min(95, raw * 85 + Math.log(1 + raw * 10) * 3);
      setProgressPercent(eased);
    }, stepMs);
    return () => clearInterval(interval);
  }, [showProgress, estimatedDuration]);

  const currentMessage = context
    ? messages[messageIndex].replace(/\.\.\.$/, ` — ${context}...`)
    : messages[messageIndex];

  const verse = VERSES[verseIndex];

  /* ── Variant: inline (minimal) ─────────────────────────────────────── */
  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2" role="status" aria-live="polite">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          className="h-4 w-4 rounded-full border-2 border-amber-400/30 border-t-amber-400"
        />
        <span className="text-[12px] font-medium text-amber-200/80 italic animate-pulse">
          {currentMessage}
        </span>
      </div>
    );
  }

  /* ── Variant: compact ──────────────────────────────────────────────── */
  if (variant === 'compact') {
    return (
      <div
        className="flex flex-col items-center justify-center py-6 text-center"
        role="status"
        aria-live="polite"
        aria-label="Génération en cours"
      >
        <div className="relative mb-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
            className="h-10 w-10 rounded-full border-2 border-amber-400/20 border-t-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.2)]"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles size={14} className="text-amber-300 animate-pulse" />
          </div>
        </div>

        <div className="h-8 flex items-center justify-center mb-2">
          <AnimatePresence mode="wait">
            <motion.p
              key={messageIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="text-[13px] font-medium text-amber-200/80 italic"
            >
              {currentMessage}
            </motion.p>
          </AnimatePresence>
        </div>

        {showProgress && (
          <div className="w-full max-w-[200px] h-1 rounded-full bg-white/10 overflow-hidden mt-2">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-amber-400/60 to-amber-300/80"
              animate={{ width: `${progressPercent}%` }}
              transition={{ ease: 'linear', duration: 0.2 }}
            />
          </div>
        )}

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/40 hover:text-white/70 transition-colors"
          >
            <X size={12} />
            Annuler
          </button>
        )}
      </div>
    );
  }

  /* ── Variant: full (défaut) ────────────────────────────────────────── */
  return (
    <div
      className="flex flex-col items-center justify-center py-10 text-center animate-in fade-in zoom-in duration-500"
      role="status"
      aria-live="polite"
      aria-label="Génération en cours"
    >
      {/* Spinner principal */}
      <div className="relative mb-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          className="h-16 w-16 rounded-full border-2 border-amber-400/20 border-t-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)]"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles size={20} className="text-amber-300 animate-pulse" />
        </div>
      </div>

      {/* Message rotatif */}
      <div className="h-12 flex items-center justify-center mb-4">
        <AnimatePresence mode="wait">
          <motion.p
            key={messageIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-[15px] font-medium text-amber-200/90 italic"
          >
            {currentMessage}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Barre de progression */}
      {showProgress && (
        <div className="w-full max-w-[280px] h-1.5 rounded-full bg-white/10 overflow-hidden mb-6">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-400/70 to-amber-300/90"
            animate={{ width: `${progressPercent}%` }}
            transition={{ ease: 'linear', duration: 0.2 }}
          />
        </div>
      )}

      {/* Verset rotatif */}
      {showVerse && (
        <div className="h-24 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={verseIndex}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.6 }}
              className="max-w-[300px] rounded-2xl bg-white/[0.03] border border-white/5 p-5 backdrop-blur-sm shadow-xl"
            >
              <p className="text-[13px] leading-relaxed text-white/70 italic mb-2">
                « {verse.text} »
              </p>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/60">
                — {verse.ref}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Bouton Annuler */}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-semibold text-white/50 hover:text-white/80 hover:bg-white/[0.08] transition-all"
        >
          <X size={13} />
          Annuler la génération
        </button>
      )}
    </div>
  );
}
