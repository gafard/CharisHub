'use client';

import logger from '@/lib/logger';
import {
  Bell,
  BellOff,
  Cloud,
  CloudOff,
  Globe,
  Moon,
  Sun,
  Sunrise,
  User,
  LogOut,
  Palette,
  Check,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../contexts/I18nContext';
import { useSettings } from '../contexts/SettingsContext';
import { useCommunityIdentity } from '../lib/useCommunityIdentity';
import { useCloudSync } from '../contexts/CloudSyncContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';

export default function StudyUserPanel() {
  const { locale, setLocale } = useI18n();
  const { notificationsEnabled, setNotificationsEnabled, theme, setTheme } = useSettings();
  const { isAuthenticated, identity, updateName } = useCommunityIdentity();
  const { user, profile, signOut } = useAuth();
  const { isConnected } = useCloudSync();

  const [draftName, setDraftName] = useState(identity?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const isConnectedToSupabase = isConnected && !!supabase;

  useEffect(() => {
    if (identity?.displayName) {
      setDraftName(identity.displayName);
    }
  }, [identity?.displayName]);

  const saveName = async () => {
    if (!draftName.trim() || draftName.trim() === identity?.displayName) return;
    setSaving(true);
    try {
      await updateName(draftName.trim());
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      logger.error('[StudyUserPanel] Failed to save name:', err);
    } finally {
      setSaving(false);
    }
  };

  const themes = [
    { id: 'light', name: 'Clair', icon: Sun, color: 'text-amber-500' },
    { id: 'sepia', name: 'Papyrus', icon: Sunrise, color: 'text-orange-600' },
    { id: 'dark', name: 'Sombre', icon: Moon, color: 'text-indigo-400' },
  ];

  return (
    <div className="space-y-8 pb-20">
      {/* Profil Section */}
      <section>
        <div className="mb-4 flex items-center gap-2 px-2">
          <User size={18} className="text-accent" />
          <h2 className="text-sm font-black uppercase tracking-widest text-foreground/80">Mon Identité</h2>
        </div>
        
        <div className="overflow-hidden rounded-[32px] border border-border-soft bg-surface/80 p-1 shadow-sm backdrop-blur-xl">
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-background to-surface-strong p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
            
            <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-surface shadow-xl ring-1 ring-border-soft bg-gradient-to-br from-amber-100 to-amber-50">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <User size={40} className="text-amber-600/50" />
                  )}
                </div>
                {isAuthenticated && (
                  <div className="absolute bottom-0 right-0 rounded-full border-2 border-surface bg-emerald-500 p-1.5 text-white shadow-sm">
                    <ShieldCheck size={12} strokeWidth={3} />
                  </div>
                )}
              </div>

              {/* Info & Form */}
              <div className="flex-1 text-center sm:text-left">
                <div className="mb-4">
                  <h3 className="text-xl font-black text-foreground">
                    {isAuthenticated ? 'Profil vérifié' : 'Profil visiteur'}
                  </h3>
                  <p className="mt-1 text-sm text-foreground/60">
                    {isAuthenticated 
                      ? `Connecté de façon sécurisée avec ${user?.email}`
                      : 'Vos données sont sauvegardées uniquement sur cet appareil.'}
                  </p>
                </div>

                <div className="flex max-w-sm flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onBlur={saveName}
                      placeholder="Comment vous appelez-vous ?"
                      className="w-full rounded-2xl border border-border-soft bg-surface px-5 py-3.5 text-sm font-bold text-foreground outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                    {saved && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500"
                      >
                        <Check size={18} strokeWidth={3} />
                      </motion.div>
                    )}
                  </div>
                </div>

                {!isAuthenticated && (
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-foreground px-5 py-3 text-sm font-bold text-background transition-transform active:scale-95 shadow-lg shadow-foreground/10"
                  >
                    <Cloud size={16} />
                    Sauvegarder mon compte en ligne
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Apparence */}
        <section>
          <div className="mb-4 flex items-center gap-2 px-2">
            <Palette size={18} className="text-accent" />
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground/80">Apparence</h2>
          </div>
          
          <div className="rounded-[32px] border border-border-soft bg-surface/80 p-2 shadow-sm backdrop-blur-xl">
            <div className="flex flex-col gap-2">
              {themes.map((t) => {
                const Icon = t.icon;
                const isActive = theme === t.id || (t.id === 'dark' && theme === 'deep-night');
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id as any)}
                    className={`flex items-center justify-between rounded-[24px] px-5 py-4 transition-all ${
                      isActive 
                        ? 'bg-foreground/5 shadow-inner' 
                        : 'hover:bg-foreground/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-background shadow-sm ${t.color}`}>
                        <Icon size={18} />
                      </div>
                      <span className={`text-sm font-bold ${isActive ? 'text-foreground' : 'text-foreground/70'}`}>
                        {t.name}
                      </span>
                    </div>
                    {isActive && <div className="h-2 w-2 rounded-full bg-accent" />}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Préférences */}
        <section>
          <div className="mb-4 flex items-center gap-2 px-2">
            <Bell size={18} className="text-accent" />
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground/80">Préférences</h2>
          </div>
          
          <div className="flex flex-col gap-4 rounded-[32px] border border-border-soft bg-surface/80 p-4 shadow-sm backdrop-blur-xl sm:p-6">
            
            {/* Notifications Toggle */}
            <div className="flex items-center justify-between rounded-[24px] bg-background p-4 sm:p-5 shadow-sm border border-border-soft/50">
              <div className="flex items-center gap-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${notificationsEnabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-foreground/5 text-foreground/40'}`}>
                  {notificationsEnabled ? <Bell size={18} /> : <BellOff size={18} />}
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">Rappels quotidiens</div>
                  <div className="text-xs font-medium text-foreground/50">Pour ne pas perdre le rythme</div>
                </div>
              </div>
              
              <button
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className={`relative h-7 w-12 rounded-full transition-colors duration-300 ${notificationsEnabled ? 'bg-emerald-500' : 'bg-foreground/10'}`}
              >
                <div className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${notificationsEnabled ? 'left-[26px]' : 'left-1'}`} />
              </button>
            </div>

            {/* Language Toggle */}
            <div className="flex items-center justify-between rounded-[24px] bg-background p-4 sm:p-5 shadow-sm border border-border-soft/50">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
                  <Globe size={18} />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground">Langue de l'app</div>
                  <div className="text-xs font-medium text-foreground/50">Interface et menus</div>
                </div>
              </div>
              
              <div className="flex rounded-full bg-foreground/5 p-1">
                <button
                  onClick={() => setLocale('fr')}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${locale === 'fr' ? 'bg-surface shadow-sm text-foreground' : 'text-foreground/50 hover:text-foreground'}`}
                >
                  FR
                </button>
                <button
                  onClick={() => setLocale('en')}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${locale === 'en' ? 'bg-surface shadow-sm text-foreground' : 'text-foreground/50 hover:text-foreground'}`}
                >
                  EN
                </button>
              </div>
            </div>

          </div>
        </section>
      </div>

      {/* Déconnexion */}
      {isAuthenticated && (
        <section className="flex justify-center pt-8">
          <button
            onClick={() => signOut?.()}
            className="group flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-rose-500/70 transition-colors hover:bg-rose-500/10 hover:text-rose-600"
          >
            <LogOut size={16} className="transition-transform group-hover:-translate-x-1" />
            Se déconnecter
          </button>
        </section>
      )}

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}

