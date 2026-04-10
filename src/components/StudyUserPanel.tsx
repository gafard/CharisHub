'use client';

import {
  Bell,
  BellOff,
  CheckCircle2,
  Cloud,
  CloudOff,
  Database,
  Download,
  Globe,
  HelpCircle,
  LogOut,
  Save,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { useSettings } from '../contexts/SettingsContext';
import { useCommunityIdentity } from '../lib/useCommunityIdentity';
import { useCloudSync } from '../contexts/CloudSyncContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SupabaseOnboardingModal from './SupabaseOnboardingModal';

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
    <section className="overflow-hidden rounded-[30px] border border-[color:var(--border-soft)] bg-[color:var(--surface)]/92 shadow-[0_14px_36px_rgba(16,24,40,0.06)]">
      <div className="border-b border-[color:var(--border-soft)] px-5 py-5 sm:px-6">
        <div className="flex items-start gap-4">
          {icon ? (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--surface-strong)] text-[color:var(--accent)] ring-1 ring-[color:var(--border-soft)]">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            {eyebrow ? (
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--foreground)]/45">
                {eyebrow}
              </div>
            ) : null}
            <h3 className="mt-1 text-lg font-extrabold tracking-tight text-[color:var(--foreground)]">
              {title}
            </h3>
            {description ? (
              <p className="mt-1 text-sm leading-6 text-[color:var(--foreground)]/62">
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
      {ok ? <CheckCircle2 size={13} /> : <HelpCircle size={13} />}
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
    <div className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)]/70 p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--surface)] text-[color:var(--accent)] ring-1 ring-[color:var(--border-soft)]">
        {icon}
      </div>
      <div className="text-base font-black tracking-tight text-[color:var(--foreground)]">
        {value}
      </div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--foreground)]/46">
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
  const { notificationsEnabled, setNotificationsEnabled } = useSettings();
  const { isAuthenticated, identity, updateName } = useCommunityIdentity();
  const { user, signOut } = useAuth();
  const { syncStatus, syncToCloud, syncFromCloud, exportData, importData, isConnected } = useCloudSync();

  const [draftName, setDraftName] = useState(identity?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showSupabaseOnboarding, setShowSupabaseOnboarding] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        const result = importData(json);
        if (result.success) {
          alert(
            `✅ Import réussi !\n\n${Object.entries(result.counts)
              .filter(([_, count]) => count > 0)
              .map(([key, count]) => `• ${key}: ${count}`)
              .join('\n')}`
          );
          window.location.reload();
        } else {
          alert("❌ Échec de l'import. Vérifiez le fichier.");
        }
      } catch {
        alert('❌ Fichier invalide');
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const formatLastSync = () => {
    if (!syncStatus.lastSyncAt) return 'Jamais synchronisé';
    const now = new Date();
    const diff = now.getTime() - syncStatus.lastSyncAt.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "À l'instant";
    if (minutes < 60) return `Il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `Il y a ${hours}h`;
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
            className="h-13 w-full rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] px-4 text-sm font-medium outline-none transition focus:border-[color:var(--accent-border)] hover:border-[color:var(--border-strong)]"
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

        <div className="mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)]/65 p-4 text-xs leading-6 text-[color:var(--foreground)]/62">
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
                : 'border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] text-[color:var(--foreground)]/80 hover:border-[color:var(--border-strong)]',
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
          <div className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-1">
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
                    ? 'bg-white shadow-sm ring-1 ring-black/5 text-[color:var(--foreground)] dark:bg-[color:var(--surface-strong)]'
                    : 'text-[color:var(--foreground)]/60 hover:text-[color:var(--foreground)]',
                ].join(' ')}
              >
                {item.label}
              </button>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Sync */}
      <SectionCard
        eyebrow="Données"
        title="Sauvegarde & synchronisation"
        description="Gardez vos surlignages, notes, pépites et données de prière disponibles sur vos appareils."
        icon={isConnectedToSupabase ? <Cloud size={20} /> : <CloudOff size={20} />}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusPill
            ok={isConnectedToSupabase}
            label={isConnectedToSupabase ? 'Synchronisation cloud active' : 'Mode local uniquement'}
          />

          <div
            className={[
              'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold',
              isConnectedToSupabase
                ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
            ].join(' ')}
          >
            {isConnectedToSupabase ? <Wifi size={13} /> : <WifiOff size={13} />}
            {isConnectedToSupabase ? 'Connecté' : 'Hors cloud'}
          </div>
        </div>

        {isConnectedToSupabase ? (
          <div className="mt-4 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)]/70 p-4">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-[color:var(--foreground)]/60">Dernière synchronisation</span>
              <span className="font-bold text-[color:var(--foreground)]">{formatLastSync()}</span>
            </div>

            {syncStatus.syncing ? (
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-[#D4AF37] to-[#B8941F] transition-all"
                    style={{
                      width: syncStatus.syncProgress
                        ? `${(syncStatus.syncProgress.completed / syncStatus.syncProgress.total) * 100}%`
                        : '50%',
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {isConnectedToSupabase ? (
            <>
              <button
                type="button"
                onClick={async () => {
                  const success = await syncFromCloud();
                  alert(success ? '✅ Données cloud récupérées.' : '❌ Échec de la récupération.');
                }}
                disabled={syncStatus.syncing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-400/25 bg-blue-500/10 px-4 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-500/15 disabled:opacity-50 dark:text-blue-300"
              >
                <Download size={15} />
                Récupérer
              </button>

              <button
                type="button"
                onClick={async () => {
                  const success = await syncToCloud();
                  alert(success ? '✅ Sauvegarde cloud terminée.' : '❌ Échec de la sauvegarde.');
                }}
                disabled={syncStatus.syncing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-500/15 disabled:opacity-50 dark:text-emerald-300"
              >
                <Upload size={15} />
                Sauvegarder
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowSupabaseOnboarding(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-700 transition hover:bg-amber-500/15 dark:text-amber-300 sm:col-span-2"
            >
              <HelpCircle size={15} />
              Voir le guide cloud
            </button>
          )}

          <button
            type="button"
            onClick={() => exportData()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] px-4 py-3 text-sm font-bold text-[color:var(--foreground)]/70 transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--foreground)]"
          >
            <Database size={15} />
            Exporter JSON
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] px-4 py-3 text-sm font-bold text-[color:var(--foreground)]/70 transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--foreground)] disabled:opacity-50"
          >
            <Upload size={15} />
            Importer JSON
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>

        <div
          className={[
            'mt-4 rounded-2xl border p-4 text-xs leading-6',
            isConnectedToSupabase
              ? 'border-blue-400/20 bg-blue-500/8 text-blue-900 dark:text-blue-200'
              : 'border-amber-400/20 bg-amber-500/8 text-amber-900 dark:text-amber-200',
          ].join(' ')}
        >
          {isConnectedToSupabase ? (
            <>
              Vos données d’étude et de prière sont synchronisées avec le cloud.
              Vous pouvez aussi exporter une sauvegarde manuelle pour archivage.
            </>
          ) : (
            <>
              Vos données sont enregistrées uniquement sur cet appareil. Activez la
              synchronisation cloud pour mieux protéger votre progression et vos contenus.
            </>
          )}
        </div>
      </SectionCard>

      {/* Compte */}
      {isAuthenticated ? (
        <SectionCard
          eyebrow="Compte"
          title="Session connectée"
          description="Gérez votre accès à CharisHub."
          icon={<ShieldCheck size={20} />}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)]/70 px-4 py-3 text-sm text-[color:var(--foreground)]/70">
              Connecté en tant que <span className="font-bold text-[color:var(--foreground)]">{user?.email || 'Utilisateur'}</span>
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

      {/* Diagnostics Appels */}
      <section className="rounded-[30px] border border-blue-200/50 bg-blue-50/30 p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-blue-200 bg-white text-blue-600">
            <HelpCircle size={20} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-extrabold text-blue-900">Diagnostics Appels</div>
            <p className="mt-1 text-[11px] font-medium text-blue-700/70">
              Utilisez cet outil pour vérifier si votre téléphone est prêt à recevoir des appels.
            </p>

            <div className="mt-4 space-y-2 rounded-2xl bg-white/60 p-4 text-[10px] font-mono border border-blue-100">
              <div className="flex justify-between">
                <span className="text-blue-900/40">Appareil (ID):</span>
                <span className="font-bold text-blue-900 select-all">{identity?.deviceId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-900/40">Compte (ID):</span>
                <span className="font-bold text-blue-900 select-all">{identity?.userId || 'Non connecté'}</span>
              </div>
              <div className="border-t border-blue-100 pt-2">
                <span className="text-blue-900/40">Canaux Actifs (Realtime):</span>
                <div className="mt-1 space-y-1">
                  {typeof window !== 'undefined' && (window as any).__callSystemStatus?.channels ? (
                    Object.entries((window as any).__callSystemStatus.channels).map(([name, status]) => (
                      <div key={name} className="flex justify-between">
                        <span className="max-w-[150px] truncate">{name}</span>
                        <span className={status === 'SUBSCRIBED' ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                          {String(status)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-blue-900/30 italic">Aucun canal actif - essayez de redémarrer</div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  try {
                    const audio = new Audio('/sounds/Elysian.mp3');
                    audio.play().catch(e => alert("Test sonnerie : " + e.message + "\nAssurez-vous que le mode silencieux est désactivé."));
                    setTimeout(() => {
                      audio.pause();
                      audio.currentTime = 0;
                    }, 4000);
                  } catch (e: any) {
                    alert("Erreur critique : " + e.message);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-[11px] font-bold text-white transition hover:bg-blue-700 active:scale-95 shadow-sm"
              >
                Tester la sonnerie
              </button>
              
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-xl bg-white border border-blue-200 px-4 py-3 text-[11px] font-bold text-blue-600 transition hover:bg-blue-50 active:scale-95 shadow-sm"
              >
                Réinitialiser Realtime
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Bloc inspiration */}
      <div className="overflow-hidden rounded-[30px] border border-[color:var(--border-soft)] bg-[linear-gradient(135deg,rgba(200,159,45,0.10),rgba(255,255,255,0))] px-5 py-5 shadow-[0_14px_36px_rgba(16,24,40,0.05)] sm:px-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--surface)] text-[color:var(--accent)] ring-1 ring-[color:var(--border-soft)]">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--foreground)]/44">
              CharisHub
            </div>
            <div className="mt-1 text-lg font-extrabold tracking-tight text-[color:var(--foreground)]">
              Un espace personnel pensé pour la croissance
            </div>
            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]/62">
              Votre profil, vos groupes, vos temps de prière, vos notes et vos sessions
              d’étude forment un seul parcours. Cette page vous aide à garder cet espace clair,
              protégé et prêt pour la suite.
            </p>
          </div>
        </div>
      </div>

      <SupabaseOnboardingModal
        isOpen={showSupabaseOnboarding}
        onClose={() => setShowSupabaseOnboarding(false)}
      />
    </div>
  );
}
