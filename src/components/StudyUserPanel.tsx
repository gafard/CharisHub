'use client';

import { Bell, BellOff, Globe, Save, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { useSettings } from '../contexts/SettingsContext';
import { useCommunityIdentity } from '../lib/useCommunityIdentity';

export default function StudyUserPanel({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { locale, setLocale } = useI18n();
  const { notificationsEnabled, setNotificationsEnabled } = useSettings();
  const { identity, updateName } = useCommunityIdentity();
  const [draftName, setDraftName] = useState(identity?.displayName || '');
  const [saved, setSaved] = useState(false);

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
    </section>
  );
}
