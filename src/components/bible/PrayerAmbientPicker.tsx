'use client';

import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

type AmbientSound = {
  id: string;
  label: string;
  icon: LucideIcon;
  url: string;
  isYoutube?: boolean;
};

type PrayerAmbientPickerProps = {
  open: boolean;
  sounds: AmbientSound[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export default function PrayerAmbientPicker({
  open,
  sounds,
  selectedId,
  onSelect,
}: PrayerAmbientPickerProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6 shadow-2xl backdrop-blur-2xl"
        >
          <div className="mb-5 flex items-center gap-2.5 px-1">
            <div className="h-4 w-1 rounded-full bg-amber-400" />
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-white/40">
              Atmosphère sonore
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {sounds.map((sound) => {
              const Icon = sound.icon;
              const isSelected = selectedId === sound.id;

              return (
                <button
                  key={sound.id}
                  onClick={() => onSelect(sound.id)}
                  className={`flex flex-col items-center justify-center gap-2.5 rounded-[24px] px-3 py-5 transition-all ${
                    isSelected
                      ? 'bg-surface text-slate-950 shadow-xl'
                      : 'border border-white/5 bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  <Icon size={20} strokeWidth={isSelected ? 3 : 2} />
                  <span className="text-[11px] font-black tracking-tight">{sound.label}</span>
                </button>
              );
            })}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
