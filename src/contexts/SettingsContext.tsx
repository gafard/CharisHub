'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEYS = {
  autoPlayNext: 'formation_biblique_auto_play_next',
  textScale: 'formation_biblique_text_scale',
  dataSaver: 'formation_biblique_data_saver',
  accent: 'formation_biblique_accent',
  notifications: 'formation_biblique_notifications',
  reminders: 'formation_biblique_reminders',
  reminderTime: 'formation_biblique_reminder_time',
  syncId: 'formation_biblique_sync_id',
} as const;

type AudioQuality = 'auto' | 'low' | 'high';
type TextScale = 1 | 1.1 | 1.2;
type Accent = 'blue' | 'emerald' | 'amber';

type SettingsState = {
  isOpen: boolean;
  open: boolean; // Alias pour isOpen pour compatibilité avec SettingsPanel
  openSettings: () => void;
  closeSettings: () => void;

  // assistance à la méditation
  autoPlayOnOpen: boolean;
  setAutoPlayOnOpen: (v: boolean) => void;

  autoTranscribe: boolean;
  setAutoTranscribe: (v: boolean) => void;

  autoSummarize: boolean;
  setAutoSummarize: (v: boolean) => void;

  // lecture enchaînée
  autoPlayNext: boolean;
  setAutoPlayNext: (v: boolean) => void;

  // autres options
  autoplayOnOpen: boolean; // Alias pour compatibilité avec SettingsPanel
  setAutoplayOnOpen: (v: boolean) => void;

  audioQuality: AudioQuality;
  setAudioQuality: (q: AudioQuality) => void;

  // personnalisation UX
  textScale: TextScale;
  setTextScale: (v: TextScale) => void;

  dataSaver: boolean;
  setDataSaver: (v: boolean) => void;

  accent: Accent;
  setAccent: (v: Accent) => void;

  notificationsEnabled: boolean;
  setNotificationsEnabled: (v: boolean) => void;

  remindersEnabled: boolean;
  setRemindersEnabled: (v: boolean) => void;

  reminderTime: string; // "HH:MM"
  setReminderTime: (v: string) => void;

  syncId: string;
  setSyncId: (v: string) => void;
  regenerateSyncId: () => void;
};

const SettingsContext = createContext<SettingsState | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  const [autoPlayOnOpen, setAutoPlayOnOpen] = useState(true);
  const [autoTranscribe, setAutoTranscribe] = useState(false);
  const [autoSummarize, setAutoSummarize] = useState(false);
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [audioQuality, setAudioQuality] = useState<AudioQuality>('auto');
  const [textScale, setTextScale] = useState<TextScale>(1);
  const [dataSaver, setDataSaver] = useState(false);
  const [accent, setAccent] = useState<Accent>('blue');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('19:00');
  const [syncId, setSyncIdState] = useState('');

  useEffect(() => {
    setHasMounted(true);
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEYS.autoPlayNext);
      if (saved === '0' || saved === '1') {
        setAutoPlayNext(saved === '1');
      }
      const savedScale = Number(localStorage.getItem(STORAGE_KEYS.textScale));
      if (savedScale === 1 || savedScale === 1.1 || savedScale === 1.2) {
        setTextScale(savedScale as TextScale);
      }
      const savedData = localStorage.getItem(STORAGE_KEYS.dataSaver);
      if (savedData === '0' || savedData === '1') {
        setDataSaver(savedData === '1');
      }
      const savedAccent = localStorage.getItem(STORAGE_KEYS.accent) as Accent | null;
      if (savedAccent === 'blue' || savedAccent === 'emerald' || savedAccent === 'amber') {
        setAccent(savedAccent);
      }
      const savedNotif = localStorage.getItem(STORAGE_KEYS.notifications);
      if (savedNotif === '0' || savedNotif === '1') {
        setNotificationsEnabled(savedNotif === '1');
      }
      const savedReminders = localStorage.getItem(STORAGE_KEYS.reminders);
      if (savedReminders === '0' || savedReminders === '1') {
        setRemindersEnabled(savedReminders === '1');
      }
      const savedTime = localStorage.getItem(STORAGE_KEYS.reminderTime);
      if (savedTime && /^\d{2}:\d{2}$/.test(savedTime)) {
        setReminderTime(savedTime);
      }
      const savedSync = localStorage.getItem(STORAGE_KEYS.syncId);
      if (savedSync) setSyncIdState(savedSync);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.autoPlayNext, autoPlayNext ? '1' : '0');
    }
  }, [autoPlayNext]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.textScale, String(textScale));
    }
  }, [textScale]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.dataSaver, dataSaver ? '1' : '0');
    }
  }, [dataSaver]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.accent, accent);
    }
  }, [accent]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.notifications, notificationsEnabled ? '1' : '0');
    }
  }, [notificationsEnabled]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.reminders, remindersEnabled ? '1' : '0');
    }
  }, [remindersEnabled]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.reminderTime, reminderTime);
    }
  }, [reminderTime]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (syncId) localStorage.setItem(STORAGE_KEYS.syncId, syncId);
      else localStorage.removeItem(STORAGE_KEYS.syncId);
    }
  }, [syncId]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty('--text-scale', String(textScale));
    root.dataset.dataSaver = dataSaver ? '1' : '0';
    const accentMap: Record<Accent, { a: string; b: string; rgb: string; border: string; soft: string }> = {
      blue: { a: '#2563eb', b: '#0ea5e9', rgb: '37, 99, 235', border: 'rgba(37, 99, 235, 0.55)', soft: 'rgba(37, 99, 235, 0.25)' },
      emerald: { a: '#10b981', b: '#22c55e', rgb: '16, 185, 129', border: 'rgba(16, 185, 129, 0.55)', soft: 'rgba(16, 185, 129, 0.22)' },
      amber: { a: '#f59e0b', b: '#f97316', rgb: '245, 158, 11', border: 'rgba(245, 158, 11, 0.55)', soft: 'rgba(245, 158, 11, 0.22)' },
    };
    const colors = accentMap[accent];
    root.style.setProperty('--accent', colors.a);
    root.style.setProperty('--accent-2', colors.b);
    root.style.setProperty('--accent-rgb', colors.rgb);
    root.style.setProperty('--accent-border', colors.border);
    root.style.setProperty('--accent-soft', colors.soft);
  }, [textScale, dataSaver, accent]);

  const value = useMemo<SettingsState>(() => ({
    isOpen: hasMounted ? isOpen : false,
    open: hasMounted ? isOpen : false, // Alias pour compatibilité avec SettingsPanel
    openSettings: () => setIsOpen(true),
    closeSettings: () => setIsOpen(false),

    autoPlayOnOpen,
    setAutoPlayOnOpen,

    autoTranscribe,
    setAutoTranscribe,

    autoSummarize,
    setAutoSummarize,

    autoPlayNext,
    setAutoPlayNext,

    // Alias pour compatibilité avec SettingsPanel
    autoplayOnOpen: autoPlayOnOpen,
    setAutoplayOnOpen: setAutoPlayOnOpen,

    audioQuality,
    setAudioQuality,

    textScale,
    setTextScale,

    dataSaver,
    setDataSaver,

    accent,
    setAccent,

    notificationsEnabled: hasMounted ? notificationsEnabled : false,
    setNotificationsEnabled,

    remindersEnabled: hasMounted ? remindersEnabled : false,
    setRemindersEnabled,

    reminderTime,
    setReminderTime,

    syncId,
    setSyncId: setSyncIdState,
    regenerateSyncId: () => {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let out = '';
      for (let i = 0; i < 6; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
      setSyncIdState(out);
    },
  }), [hasMounted, isOpen, autoPlayOnOpen, autoTranscribe, autoSummarize, autoPlayNext, audioQuality, textScale, dataSaver, accent, notificationsEnabled, remindersEnabled, reminderTime, syncId]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
