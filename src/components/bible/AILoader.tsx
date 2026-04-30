'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';

const MESSAGES = [
  "Méditation sur vos réflexions...",
  "Recherche de résonances bibliques...",
  "Préparation de votre temps de prière...",
  "Harmonisation avec le contexte du jour...",
  "Écoute des échos spirituels du passage...",
  "Préparation d'un éclairage sur mesure...",
];

const VERSES = [
  { text: "La parole de Dieu est vivante et efficace.", ref: "Hébreux 4:12" },
  { text: "Ta parole est une lampe à mes pieds.", ref: "Psaume 119:105" },
  { text: "Ma grâce te suffit, car ma puissance s'accomplit dans la faiblesse.", ref: "2 Cor 12:9" },
  { text: "Je puis tout par celui qui me fortifie.", ref: "Philippiens 4:13" },
  { text: "Le Seigneur est ma lumière et mon salut.", ref: "Psaume 27:1" },
  { text: "Que ta parole soit la joie et l'allégresse de mon cœur.", ref: "Jérémie 15:16" },
];

export default function AILoader() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [verse] = useState(() => VERSES[Math.floor(Math.random() * VERSES.length)]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-10 text-center animate-in fade-in zoom-in duration-500">
      <div className="relative mb-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="h-16 w-16 rounded-full border-2 border-amber-400/20 border-t-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)]"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles size={20} className="text-amber-300 animate-pulse" />
        </div>
      </div>

      <div className="h-12 flex items-center justify-center mb-6">
        <AnimatePresence mode="wait">
          <motion.p
            key={messageIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-[15px] font-medium text-amber-200/90 italic"
          >
            {MESSAGES[messageIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="max-w-[280px] rounded-2xl bg-white/[0.03] border border-white/5 p-5 backdrop-blur-sm shadow-xl"
      >
        <p className="text-[13px] leading-relaxed text-white/70 italic mb-2">
          "{verse.text}"
        </p>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/60">
          — {verse.ref}
        </p>
      </motion.div>
    </div>
  );
}
