'use client';

import {
  Bell,
  BellOff,
  CheckCircle2,
  Cloud,
  CloudOff,
  Globe,
  Moon,
  Save,
  ShieldCheck,
  Sun,
  UserRound,
  LogOut,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { useSettings } from '../contexts/SettingsContext';
import { useCommunityIdentity } from '../lib/useCommunityIdentity';
import { useCloudSync } from '../contexts/CloudSyncContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

function SectionCard({
  eyebrow,
  title,
  description,
  icon,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[30px] border border-border-soft bg-surface/92 shadow-[0_14px_36px_rgba(16,24,40,0.06)]">
      <div className="border-b border-border-soft px-5 py-5 sm:px-6">
        <div className="flex items-start gap-4">
          {icon ? (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-strong text-[color:var(--accent)] ring-1 ring-[color:var(--border-soft)]">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            {eyebrow ? (
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground/45">
                {eyebrow}
              </div>
            ) : null}
            <h3 className="mt-1 text-lg font-extrabold tracking-tight text-foreground">
              {title}
            </h3>
            {description ? (
              <p className="mt-1 text-sm leading-6 text-foreground/62">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

function StatusPill({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) {
  return (
    <div
      className={[
        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold',
        ok
          ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
          : 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
      ].join(' ')}
    >
      {ok ? <CheckCircle2 size={13} /> : <div className="h-1 w-1 rounded-full bg-current" />}
      {label}
    </div>
  );
}

function QuickMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-border-soft bg-surface-strong/70 p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-surface text-[color:var(--accent)] ring-1 ring-[color:var(--border-soft)]">
        {icon}
      </div>
      <div className="text-base font-black tracking-tight text-foreground">
        {value}
      </div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-foreground/46">
        {label}
      </div>
    </div>
  );
}

export default function StudyUserPanel({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { locale, setLocale } = useI18n();
  const { notificationsEnabled, setNotificationsEnabled, theme, setTheme } = useSettings();
  const { isAuthenticated, identity, updateName } = useCommunityIdentity();
  const { user, signOut } = useAuth();
  const { isConnected } = useCloudSync();

  const [draftName, setDraftName] = useState(identity?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const isConnectedToSupabase = isConnected && !!supabase;

  // Sync draftName when identity changes
  useEffect(() => {
    if (identity?.displayName) {
      setDraftName(identity.displayName);
    }
  }, [identity?.displayName]);

  const helper = useMemo(
    () =>
      notificationsEnabled
        ? "Les notifications sont actives. Vous pourrez recevoir les invitations d'appel et les rappels de session."
        : "Activez les notifications pour recevoir les invitations d'appel et les rappels de session.",
    [notificationsEnabled]
  );

  const saveName = async () => {
    if (!draftName.trim()) return;
    setSaving(true);
    try {
      await updateName(draftName.trim());
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save name:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Bandeau résumé */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <QuickMetric
          label="Compte"
          value={isAuthenticated ? 'Connecté' : 'Invité'}
          icon={<ShieldCheck size={18} />}
        />
        <QuickMetric
          label="Synchronisation"
          value={isConnectedToSupabase ? 'Cloud actif' : 'Local'}
          icon={isConnectedToSupabase ? <Cloud size={18} /> : <CloudOff size={18} />}
        />
        <QuickMetric
          label="Notifications"
          value={notificationsEnabled ? 'Activées' : 'Désactivées'}
          icon={notificationsEnabled ? <Bell size={18} /> : <BellOff size={18} />}
        />
        <QuickMetric
          label="Langue"
          value={locale === 'fr' ? 'Français' : 'English'}
          icon={<Globe size={18} />}
        />
      </div>

      {/* Identité */}
      <SectionCard
        eyebrow="Identité"
        title="Profil d’affichage"
        description="Ce nom est utilisé dans les groupes, les échanges, les appels et votre expérience d’apprentissage."
        icon={<UserRound size={20} />}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusPill
            ok={isAuthenticated}
            label={
              isAuthenticated
                ? `Compte connecté${user?.email ? ` • ${user.email}` : ''}`
                : 'Mode invité local'
            }
          />
          {saved ? (
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-300">
              Profil enregistré
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder={isAuthenticated ? "Nom d'affichage" : 'Pseudo invité'}
            className="h-13 w-full rounded-2xl border border-border-soft bg-surface-strong px-4 text-sm font-medium outline-none transition focus:border-[color:var(--accent-border)] hover:border-border-strong"
          />
          <button
            type="button"
            onClick={saveName}
            disabled={saving || !draftName.trim() || draftName.trim() === identity?.displayName}
            className="inline-flex h-13 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#121936] px-5 text-sm font-bold text-white shadow-[0_14px_32px_rgba(18,25,54,0.22)] transition hover:translate-y-[-1px] disabled:opacity-50"
          >
            {saving ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            ) : (
              <Save size={15} />
            )}
            {saved ? 'Enregistré' : 'Sauvegarder'}
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-border-soft bg-surface-strong/65 p-4 text-xs leading-6 text-foreground/62">
          {isAuthenticated ? (
            <>
              Votre nom est relié à votre compte et vous suit dans vos groupes, formations,
              appels et interactions sur plusieurs appareils.
            </>
          ) : (
            <>
              En mode invité, votre nom reste enregistré uniquement sur cet appareil.
              Connectez-vous pour sécuriser votre identité et retrouver vos données partout.
            </>
          )}
        </div>
      </SectionCard>

      {/* Préférences */}
      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          eyebrow="Préférences"
          title="Notifications"
          description={helper}
          icon={notificationsEnabled ? <Bell size={20} /> : <BellOff size={20} />}
        >
          <button
            type="button"
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className={[
              'inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all',
              notificationsEnabled
                ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-border-soft bg-surface-strong text-foreground/80 hover:border-border-strong',
            ].join(' ')}
          >
            {notificationsEnabled ? <Bell size={15} /> : <BellOff size={15} />}
            {notificationsEnabled ? 'Désactiver les notifications' : 'Activer les notifications'}
          </button>
        </SectionCard>

        <SectionCard
          eyebrow="Préférences"
          title="Langue de l’interface"
          description="Choisissez la langue utilisée dans l’application."
          icon={<Globe size={20} />}
        >
          <div className="inline-flex items-center gap-2 rounded-2xl border border-border-soft bg-surface-strong p-1">
            {[
              { value: 'fr', label: 'FR' },
              { value: 'en', label: 'EN' },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setLocale(item.value as 'fr' | 'en')}
                className={[
                  'rounded-xl px-4 py-2 text-sm font-bold transition-all',
                  locale === item.value
                    ? 'bg-surface shadow-sm ring-1 ring-black/5 text-foreground dark:bg-surface-strong'
                    : 'text-foreground/60 hover:text-foreground',
                ].join(' ')}
              >
                {item.label}
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Préférences"
          title="Thème"
          description="Ajustez l'apparence selon l'heure ou vos préférences."
          icon={theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
        >
          <div className="inline-flex items-center gap-2 rounded-2xl border border-border-soft bg-surface-strong p-1">
            {[
              { value: 'light', label: 'Clair', icon: <Sun size={14} /> },
              { value: 'dark', label: 'Sombre', icon: <Moon size={14} /> },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setTheme(item.value as 'light' | 'dark')}
                className={[
                  'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all',
                  theme === item.value
                    ? 'bg-surface shadow-sm ring-1 ring-black/5 text-foreground dark:bg-surface-strong'
                    : 'text-foreground/60 hover:text-foreground',
                ].join(' ')}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Compte */}
      {isAuthenticated ? (
        <SectionCard
          eyebrow="Compte"
          title="Session connectée"
          description="Gérez votre accès à CharisHub."
          icon={<ShieldCheck size={20} />}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="rounded-2xl border border-border-soft bg-surface-strong/70 px-4 py-3 text-sm text-foreground/70">
              Connecté en tant que <span className="font-bold text-foreground">{user?.email || 'Utilisateur'}</span>
            </div>

            <button
              type="button"
              onClick={() => signOut?.()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-500/15 dark:text-rose-300"
            >
              <LogOut size={15} />
              Déconnexion
            </button>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
