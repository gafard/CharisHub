'use client';

import {
  Bell,
  BellOff,
  Cloud,
  CloudOff,
  Database,
  Download,
  Globe,
  HelpCircle,
  LogOut,
  Save,
  Upload,
  UserRound,
  Wifi,
  WifiOff,
  Heart,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '../contexts/I18nContext';
import { useSettings } from '../contexts/SettingsContext';
import { useCommunityIdentity } from '../lib/useCommunityIdentity';
import { useCloudSync } from '../contexts/CloudSyncContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SupabaseOnboardingModal from './SupabaseOnboardingModal';

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

  const isLoggedIn = !!user;
  const isCloudReady = isConnected && !!supabase;

  // Sync draftName when identity changes
  useEffect(() => {
    if (identity?.displayName) {
      setDraftName(identity.displayName);
    }
  }, [identity?.displayName]);

  const notificationHelper = useMemo(
    () =>
      notificationsEnabled
        ? "Les notifications sont actives pour vos appels, rappels et invitations."
        : "Activez les notifications pour recevoir les appels, rappels et invitations de vos groupes.",
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
          alert(`✅ Import réussi`);
          window.location.reload();
        } else {
          alert("❌ Échec de l'import.");
        }
      } catch {
        alert('❌ Fichier invalide.');
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  const formatLastSync = () => {
    if (!syncStatus.lastSyncAt) return 'Jamais';
    const now = new Date();
    const diff = now.getTime() - syncStatus.lastSyncAt.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "À l’instant";
    if (minutes < 60) return `Il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `Il y a ${hours} h`;
  };

  return (
    <section className="space-y-4">
      {/* 👑 PORTAIL DASHBOARD (MON INTIMITÉ) */}
      <Link 
        href="/dashboard"
        className="group relative block overflow-hidden rounded-[32px] border border-amber-200/50 bg-gradient-to-br from-amber-50 to-white p-6 shadow-[0_18px_48px_rgba(200,159,45,0.12)] transition-all hover:scale-[1.01] hover:shadow-[0_24px_56px_rgba(200,159,45,0.18)] active:scale-[0.99]"
      >
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-200/20 blur-3xl transition-all group-hover:bg-amber-300/30" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-200/50">
              <Heart className="h-8 w-8 text-white animate-pulse" />
            </div>
            
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600">
                  Espace Sacré
                </span>
                <Sparkles className="h-3 w-3 text-amber-500 animate-spin-slow" />
              </div>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-[#161c35]">
                Mon Intimité
              </h2>
              <p className="text-xs font-bold text-amber-700/60 transition-colors group-hover:text-amber-700/80">
                Mémoire de Ses bontés et pépites d'identité
              </p>
            </div>
          </div>
          
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 transition-all group-hover:bg-amber-600 group-hover:text-white">
            <ArrowRight size={20} />
          </div>
        </div>
      </Link>

      {/* COMPTE */}
      <div className="overflow-hidden rounded-[32px] border border-[color:var(--border-soft)] bg-[color:var(--surface)]/95 shadow-[0_18px_40px_rgba(16,24,40,0.06)]">
        <div className="relative p-5 sm:p-6">
          {/* Subtle accent overlay */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(200,159,45,0.08),rgba(255,255,255,0))]" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)]">
                {isLoggedIn && user?.user_metadata?.avatar_url ? (
                  <img 
                    src={user.user_metadata.avatar_url} 
                    alt="Profile" 
                    className="h-full w-full rounded-2xl object-cover"
                  />
                ) : (
                  <UserRound size={18} className="text-[color:var(--foreground)]/60" />
                )}
              </div>
              <div>
                <div className="text-sm font-extrabold text-[color:var(--foreground)]">
                  Compte {isLoggedIn ? 'connecté' : 'invité'}
                </div>
                <div className="mt-1 text-[11px] font-semibold text-[color:var(--foreground)]/55 truncate max-w-[200px]">
                  {isLoggedIn ? user?.email : 'Identité locale uniquement'}
                </div>
              </div>
            </div>

            <div
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                isLoggedIn
                  ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-500/12 text-amber-700 dark:text-amber-300'
              }`}
            >
              {isLoggedIn ? <Cloud size={13} /> : <CloudOff size={13} />}
              {isLoggedIn ? 'Compte Cloud' : 'Mode Invité'}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="Ton nom d'affichage"
                className="w-full rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] px-4 py-3.5 text-sm outline-none transition-all focus:border-[color:var(--accent-border)] hover:border-[color:var(--border-strong)]"
              />
            </div>

            <button
              type="button"
              onClick={saveName}
              disabled={saving || !draftName.trim() || draftName.trim() === identity?.displayName}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#121936] px-6 py-3.5 text-sm font-bold text-white transition hover:opacity-95 disabled:opacity-30 active:scale-95 shadow-sm"
            >
              {saving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : (
                <Save size={15} />
              )}
              {saved ? 'Enregistré' : 'Sauvegarder'}
            </button>
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-[color:var(--foreground)]/58">
            Ce nom est votre identité publique sur CharisHub. Il est visible par les autres membres
            lors de vos échanges dans les groupes et durant vos sessions.
          </p>

          {isLoggedIn ? (
            <div className="mt-6 border-t border-[color:var(--border-soft)] pt-5">
              <button
                type="button"
                onClick={signOut}
                className="inline-flex items-center gap-2 rounded-2xl border border-red-500/10 bg-red-500/5 px-5 py-3 text-sm font-bold text-red-600 transition hover:bg-red-500/10 active:scale-95"
              >
                <LogOut size={15} />
                Se déconnecter
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* NOTIFICATIONS */}
      <div className="rounded-[32px] border border-[color:var(--border-soft)] bg-[color:var(--surface)]/95 p-5 shadow-[0_18px_40px_rgba(16,24,40,0.06)] sm:p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] text-[color:var(--foreground)]/70">
            {notificationsEnabled ? <Bell size={20} /> : <BellOff size={20} />}
          </div>
          <div className="flex-1">
            <div className="text-sm font-extrabold">Notifications</div>
            <div className="mt-1 text-xs leading-relaxed text-[color:var(--foreground)]/60">
              {notificationHelper}
            </div>

            <button
              type="button"
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={[
                'mt-5 inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-bold transition-all active:scale-95',
                notificationsEnabled
                  ? 'border-emerald-400/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200'
                  : 'border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] text-[color:var(--foreground)]/80 hover:border-[color:var(--border-strong)]',
              ].join(' ')}
            >
              {notificationsEnabled ? <Bell size={15} /> : <BellOff size={15} />}
              {notificationsEnabled ? 'Notifications Actives' : 'Notifications Désactivées'}
            </button>
          </div>
        </div>
      </div>

      {/* LANGUE */}
      <div className="rounded-[32px] border border-[color:var(--border-soft)] bg-[color:var(--surface)]/95 p-5 shadow-[0_18px_40px_rgba(16,24,40,0.06)] sm:p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] text-[color:var(--foreground)]/70">
            <Globe size={20} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-extrabold">Langue de l’interface</div>
            <div className="mt-1 text-xs leading-relaxed text-[color:var(--foreground)]/60">
              Choisissez la langue dans laquelle vous souhaitez utiliser l'application CharisHub.
            </div>

            <div className="mt-5 inline-flex items-center gap-1.5 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] p-1.5">
              {[
                { value: 'fr', label: 'Français' },
                { value: 'en', label: 'English' },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setLocale(item.value as 'fr' | 'en')}
                  className={[
                    'rounded-xl px-5 py-2 text-[13px] font-bold transition-all active:scale-95',
                    locale === item.value
                      ? 'bg-white shadow-sm ring-1 ring-black/5 text-[color:var(--foreground)] dark:bg-[color:var(--surface-strong)]'
                      : 'text-[color:var(--foreground)]/50 hover:text-[color:var(--foreground)]',
                  ].join(' ')}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* DONNÉES & SYNC */}
      <div className="rounded-[32px] border border-[color:var(--border-soft)] bg-[color:var(--surface)]/95 p-5 shadow-[0_18px_40px_rgba(16,24,40,0.06)] sm:p-6 transition-all">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`grid h-12 w-12 place-items-center rounded-2xl border transition-colors ${
                isCloudReady
                  ? 'border-emerald-400/40 bg-emerald-500/12'
                  : 'border-amber-400/40 bg-amber-500/12'
              }`}
            >
              {isCloudReady ? (
                <Cloud className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <CloudOff className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              )}
            </div>

            <div>
              <div className="text-sm font-extrabold">Synchronisation et Cloud</div>
              <div className="mt-1 text-xs leading-relaxed text-[color:var(--foreground)]/60">
                {isCloudReady
                  ? 'Vos travaux sont synchronisés. Vous les retrouverez sur tous vos appareils connectés.'
                  : 'Mode local actif. Vos données sont sécurisées sur cet appareil uniquement.'}
              </div>
            </div>
          </div>

          <div
            className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition-colors sm:inline-flex ${
              isCloudReady
                ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/12 text-amber-700 dark:text-amber-300'
            }`}
          >
            {isCloudReady ? <Wifi size={13} /> : <WifiOff size={13} />}
            {isCloudReady ? 'Sync Active' : 'Hors Ligne'}
          </div>
        </div>

        {isCloudReady ? (
          <>
            <div className="mt-5 rounded-2xl bg-[color:var(--surface-strong)] px-4 py-3.5 border border-[color:var(--border-soft)]/50">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-[color:var(--foreground)]/50 uppercase tracking-wider">État des données</span>
                <span className="font-bold text-[color:var(--foreground)]/80">
                  Mis à jour {formatLastSync().toLowerCase()}
                </span>
              </div>

              {syncStatus.syncing ? (
                <div className="mt-3 overflow-hidden rounded-full bg-[color:var(--surface)] h-2">
                  <div
                    className="h-full animate-pulse bg-gradient-to-r from-[#D4AF37] to-[#F1C40F]"
                    style={{
                      width: syncStatus.syncProgress
                        ? `${(syncStatus.syncProgress.completed / syncStatus.syncProgress.total) * 100}%`
                        : '50%',
                    }}
                  />
                </div>
              ) : null}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={async () => {
                  const success = await syncFromCloud();
                  if (success) alert('✅ Données récupérées avec succès.');
                }}
                disabled={syncStatus.syncing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-400/20 bg-blue-500/5 px-5 py-3.5 text-sm font-bold text-blue-700 transition hover:bg-blue-500/10 disabled:opacity-50 dark:text-blue-300 active:scale-95"
              >
                <Download size={16} />
                Actualiser
              </button>

              <button
                type="button"
                onClick={async () => {
                  const success = await syncToCloud();
                  if (success) alert('✅ Sauvegarde cloud terminée.');
                }}
                disabled={syncStatus.syncing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 px-5 py-3.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300 active:scale-95"
              >
                <Upload size={16} />
                Forcer Sauvegarde
              </button>
            </div>
          </>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-[color:var(--border-soft)] pt-5 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => exportData()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] px-5 py-3.5 text-sm font-bold text-[color:var(--foreground)]/70 transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--foreground)] active:scale-95"
          >
            <Database size={16} />
            Exporter (JSON)
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-strong)] px-5 py-3.5 text-sm font-bold text-[color:var(--foreground)]/70 transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--foreground)] active:scale-95 disabled:opacity-50"
          >
            <Upload size={16} />
            Importer (.json)
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>

        {!isCloudReady ? (
          <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <HelpCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
              <div className="flex-1">
                <p className="text-[11px] leading-relaxed text-amber-800/80 dark:text-amber-300/80">
                  La synchronisation cloud est inactive car Supabase n'est pas configuré ou vous n'êtes pas connecté.
                </p>

                <button
                  type="button"
                  onClick={() => setShowSupabaseOnboarding(true)}
                  className="mt-2 text-[11px] font-bold text-blue-700 underline underline-offset-4 hover:text-blue-800"
                >
                  Configurer le Hub Cloud
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      
      {/* 🛠️ DIAGNOSTICS & SUPPORT */}
      <div className="mt-8 rounded-[32px] border border-blue-200/50 bg-blue-50/30 p-5 shadow-sm sm:p-6">
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
      </div>

      <SupabaseOnboardingModal
        isOpen={showSupabaseOnboarding}
        onClose={() => setShowSupabaseOnboarding(false)}
      />
    </section>
  );
}
