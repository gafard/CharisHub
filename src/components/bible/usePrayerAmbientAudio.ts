'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

export type PrayerAmbientSound = {
  id: string;
  label: string;
  icon: LucideIcon;
  url: string;
  isYoutube?: boolean;
};

type UsePrayerAmbientAudioParams = {
  isOpen: boolean;
  sounds: PrayerAmbientSound[];
  initialSoundId?: string;
};

export function usePrayerAmbientAudio({
  isOpen,
  sounds,
  initialSoundId = 'none',
}: UsePrayerAmbientAudioParams) {
  const [ambientId, setAmbientId] = useState(initialSoundId);
  const [showSounds, setShowSounds] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selectedSound = useMemo(
    () => sounds.find((sound) => sound.id === ambientId) ?? sounds[0] ?? null,
    [ambientId, sounds]
  );

  const stopAudio = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current = null;
  }, []);

  useEffect(() => {
    stopAudio();

    if (!isOpen || !selectedSound?.url || selectedSound.isYoutube) return;

    const audio = new Audio(selectedSound.url);
    audio.loop = true;
    audio.volume = 0.25;
    audio.play().catch(() => {});
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [isOpen, selectedSound, stopAudio]);

  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  const selectSound = useCallback((id: string) => {
    setAmbientId(id);
    setShowSounds(false);
  }, []);

  return {
    ambientId,
    setAmbientId,
    showSounds,
    setShowSounds,
    selectedSound,
    selectSound,
    stopAudio,
    audioRef,
  };
}
