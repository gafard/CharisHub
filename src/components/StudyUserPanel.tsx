'use client';

import { Bell, BellOff, Cloud, CloudOff, Database, Download, Globe, HelpCircle, Save, Upload, UserRound, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { useSettings } from '../contexts/SettingsContext';
import { useCommunityIdentity } from '../lib/useCommunityIdentity';
import { useCloudSync } from '../contexts/CloudSyncContext';
import { supabase } from '../lib/supabase';
import SupabaseOnboardingModal from './SupabaseOnboardingModal';

export default function StudyUserPanel({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { locale, setLocale } = useI18n();
  const { notificationsEnabled, setNotificationsEnabled } = useSettings();
  const { identity, updateName } = useCommunityIdentity();
  const { syncStatus, syncToCloud, syncFromCloud, exportData, importData, isConnected } = useCloudSync();
  const [draftName, setDraftName] = useState(identity?.displayName || '');
  const [saved, setSaved] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showSupabaseOnboarding, setShowSupabaseOnboarding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isConnectedToSupabase = isConnected && !!supabase;

  useEffect(() => {
    setDraftName(identity?.displayName || '');
  }, [identity?.displayName]);

  const helper = useMemo(
    () =>
      notificationsEnabled
        ? "Les notifications sont actives. Vous pourrez recevoir les invitations d'appel."
        : "Activez les notifications pour recevoir les invitations d'appel et les rappels de session.",
    [notificationsEnabled]
  );

  const saveName = () => {
    updateName(draftName.trim());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
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
          alert(`✅ Import réussi !\n\n${Object.entries(result.counts)
            .filter(([_, count]) => count > 0)
            .map(([key, count]) => `• ${key}: ${count}`)
            .join('\n')}`);
          window.location.reload();
        } else {
          alert('❌ Échec de l\'import. Vérifiez le fichier.');
        }
      } catch (error) {
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
    
    if (minutes < 1) return 'À l\'instant';
    if (minutes < 60) return `Il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `Il y a ${hours}h`;
  };

  return (
    <section className="space-y-4">
      <div className="glass-panel rounded-3xl p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)]">
            <UserRound size={18} />
          </div>
          <div>
            <div className="text-sm font-extrabold">Ton identité</div>
            <div className="text-xs text-[color:var(--foreground)]/60">
              Tu n'es pas en train de devenir.<br/>
              Tu apprends à marcher dans ce que tu es déjà en Christ.
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Votre nom ou pseudo"
            className="w-full rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-3 text-sm outline-none transition-colors focus:border-[color:var(--accent-border)]"
          />
          <button
            type="button"
            onClick={saveName}
            className="btn-base btn-primary shrink-0 rounded-2xl px-4 py-3 text-sm"
          >
            <Save size={14} />
            {saved ? 'Enregistré' : 'Sauver'}
          </button>
        </div>

        {!compact && identity?.deviceId ? (
          <div className="mt-3 text-xs text-[color:var(--foreground)]/55">
            ID local : <span className="font-semibold">{identity.deviceId.slice(0, 12)}...</span>
          </div>
        ) : null}
      </div>

      <div className="glass-panel rounded-3xl p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)]">
            {notificationsEnabled ? <Bell size={18} /> : <BellOff size={18} />}
          </div>
          <div>
            <div className="text-sm font-extrabold">Notifications d&apos;appel</div>
            <div className="text-xs text-[color:var(--foreground)]/60">{helper}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setNotificationsEnabled(!notificationsEnabled)}
          className={[
            'mt-4 inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all',
            notificationsEnabled
              ? 'border-emerald-400/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200'
              : 'border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--foreground)]/80',
          ].join(' ')}
        >
          {notificationsEnabled ? <Bell size={15} /> : <BellOff size={15} />}
          {notificationsEnabled ? 'Désactiver' : 'Activer'}
        </button>
      </div>

      <div className="glass-panel rounded-3xl p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)]">
            <Globe size={18} />
          </div>
          <div>
            <div className="text-sm font-extrabold">Langue</div>
            <div className="text-xs text-[color:var(--foreground)]/60">
              Vous pouvez passer l&apos;interface en français ou en anglais.
            </div>
          </div>
        </div>

        <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-1">
          {[
            { value: 'fr', label: 'FR' },
            { value: 'en', label: 'EN' },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setLocale(item.value as 'fr' | 'en')}
              className={[
                'rounded-xl px-4 py-2 text-sm font-semibold transition-all',
                locale === item.value
                  ? 'bg-[color:var(--accent-soft)] text-[color:var(--foreground)]'
                  : 'text-[color:var(--foreground)]/65',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ============================================================
          BACKUP & SYNC SECTION
      ============================================================ */}
      <div className="glass-panel rounded-3xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={`grid h-11 w-11 place-items-center rounded-2xl border ${
            isConnectedToSupabase
              ? 'border-emerald-400/40 bg-emerald-500/12'
              : 'border-amber-400/40 bg-amber-500/12'
          }`}>
            {isConnectedToSupabase ? (
              <Cloud className="w-5 h-5 text-emerald-600" />
            ) : (
              <CloudOff className="w-5 h-5 text-amber-600" />
            )}
          </div>
          <div className="flex-1">
            <div className="text-sm font-extrabold">Sauvegarde & Synchronisation</div>
            <div className="text-xs text-[color:var(--foreground)]/60">
              {isConnectedToSupabase
                ? 'Cloud activé • Sync automatique toutes les 5 min'
                : 'Mode local uniquement • Configurez Supabase pour la sync cloud'}
            </div>
          </div>
          
          {/* Status badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
            isConnectedToSupabase
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
          }`}>
            {isConnectedToSupabase ? (
              <Wifi className="w-3 h-3" />
            ) : (
              <WifiOff className="w-3 h-3" />
            )}
            {isConnectedToSupabase ? 'Connecté' : 'Local'}
          </div>
        </div>

        {/* Sync actions */}
        {isConnectedToSupabase && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={async () => {
                const success = await syncFromCloud();
                if (success) alert('✅ Données cloud récupérées et fusionnées !');
                else alert('❌ Échec de la récupération. Vérifiez votre connexion.');
              }}
              disabled={syncStatus.syncing}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-blue-400/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 text-sm font-semibold hover:bg-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Récupérer cloud
            </button>

            <button
              type="button"
              onClick={async () => {
                const success = await syncToCloud();
                if (success) alert('✅ Sauvegarde cloud terminée !');
                else alert('❌ Échec de la sauvegarde. Vérifiez votre connexion.');
              }}
              disabled={syncStatus.syncing}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-sm font-semibold hover:bg-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              Sauvegarder
            </button>
          </div>
        )}

        {/* Last sync info */}
        {isConnectedToSupabase && (
          <div className="mb-3 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400">Dernière synchronisation</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {formatLastSync()}
              </span>
            </div>
            {syncStatus.syncing && (
              <div className="mt-2 w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#D4AF37] to-[#B8941F] animate-pulse"
                  style={{
                    width: syncStatus.syncProgress
                      ? `${(syncStatus.syncProgress.completed / syncStatus.syncProgress.total) * 100}%`
                      : '50%',
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Export/Import */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              exportData();
            }}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-purple-400/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 text-sm font-semibold hover:bg-purple-500/20 transition-all"
          >
            <Database className="w-4 h-4" />
            Exporter JSON
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-orange-400/30 bg-orange-500/10 text-orange-700 dark:text-orange-300 text-sm font-semibold hover:bg-orange-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-4 h-4" />
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

        {/* Info box */}
        <div className={`mt-3 px-4 py-3 rounded-xl ${
          isConnectedToSupabase
            ? 'bg-blue-50 dark:bg-blue-900/20'
            : 'bg-amber-50 dark:bg-amber-900/20'
        }`}>
          <div className="flex items-start gap-2">
            {isConnectedToSupabase ? (
              <Cloud className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            ) : (
              <CloudOff className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={`text-xs ${
                isConnectedToSupabase
                  ? 'text-blue-800 dark:text-blue-300'
                  : 'text-amber-800 dark:text-amber-300'
              }`}>
                {isConnectedToSupabase
                  ? 'Vos données (surlignages, notes, pépites, prières) sont automatiquement sauvegardées dans le cloud toutes les 5 minutes. Vous pouvez aussi exporter/importer manuellement.'
                  : 'Vos données sont sauvegardées uniquement sur cet appareil. Pour activer la synchronisation cloud et protéger vos données, configurez les variables Supabase dans votre fichier .env.local.'}
              </p>
              
              {!isConnectedToSupabase && (
                <button
                  type="button"
                  onClick={() => setShowSupabaseOnboarding(true)}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline"
                >
                  <HelpCircle className="w-3 h-3" />
                  Voir le guide de configuration →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Supabase Onboarding Modal */}
      <SupabaseOnboardingModal
        isOpen={showSupabaseOnboarding}
        onClose={() => setShowSupabaseOnboarding(false)}
      />
    </section>
  );
}
