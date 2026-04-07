'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Link2,
  Loader2,
  PlusCircle,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  createGroup,
  fetchActiveGroupCall,
  fetchGroupMembers,
  fetchGroups,
  moderateGroupMember,
  startGroupCallSession,
  triggerGroupCallPush,
  joinGroup,
  leaveGroup,
  updateGroup,
  fetchGroupCallPresence,
  syncCommunityData,
  type CommunityGroup,
  type CommunityGroupMember,
  type CommunityGroupMemberStatus,
  type CommunityGroupType,
  type CommunityCallProvider,
  type GroupCallSession,
} from './communityApi';
import CommunityGroupChat from './CommunityGroupChat';
import CommunityGroupCall from './CommunityGroupCall';
import { supabase } from '../lib/supabase';
import { useCommunityIdentity } from '../lib/useCommunityIdentity';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';

type CreateState = 'idle' | 'saving';
type GroupListMode = 'all' | 'joined' | 'discover';
type TranslateFn = (key: string, params?: Record<string, string | number>) => string;
type GroupAccent = {
  border: string;
  dot: string;
  chip: string;
  glow: string;
  wash: string;
};

function formatWhen(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function initials(name: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || '').toUpperCase();
  const b = (parts[1]?.[0] || '').toUpperCase();
  return (a + b) || 'G';
}

function AvatarPile({
  count,
  label,
}: {
  count: number;
  label?: string;
}) {
  const shown = Math.min(4, Math.max(0, count || 0));
  const rest = Math.max(0, (count || 0) - shown);
  const fallback = initials(label || 'Groupe');

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {Array.from({ length: shown }).map((_, index) => (
          <div
            key={`${label || 'member'}-${index}`}
            className="grid h-8 w-8 place-items-center rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[11px] font-extrabold backdrop-blur-md"
            title={label || 'Membre'}
          >
            {fallback[index] || String.fromCharCode(65 + index)}
          </div>
        ))}
        {rest > 0 ? (
          <div className="grid h-8 w-8 place-items-center rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[11px] font-extrabold">
            +{rest}
          </div>
        ) : null}
      </div>
    </div>
  );
}


function CountdownTimer({ targetDate, onComplete }: { targetDate: string; onComplete?: () => void }) {
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    const target = new Date(targetDate).getTime();
    if (isNaN(target)) return;

    const update = () => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        setTimeLeft(null);
        onComplete?.();
        return;
      }
      setTimeLeft({
        d: Math.floor(diff / (1000 * 60 * 60 * 24)),
        h: Math.floor((diff / (1000 * 60 * 60)) % 24),
        m: Math.floor((diff / (1000 * 60)) % 60),
        s: Math.floor((diff / 1000) % 60),
      });
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [targetDate, onComplete]);

  if (!timeLeft) return null;

  const parts = [
    { label: 'j', val: timeLeft.d },
    { label: 'h', val: timeLeft.h },
    { label: 'm', val: timeLeft.m },
    { label: 's', val: timeLeft.s },
  ].filter(p => p.val > 0 || p.label === 'm' || p.label === 's');

  return (
    <div className="flex items-center gap-1.5 font-mono text-lg font-black tracking-tighter text-[color:var(--accent)]">
      {parts.map((p, i) => (
        <div key={p.label} className="flex items-baseline gap-0.5">
          <span>{p.val.toString().padStart(2, '0')}</span>
          <span className="text-[10px] uppercase opacity-40">{p.label}</span>
          {i < parts.length - 1 && <span className="mx-0.5 opacity-20">:</span>}
        </div>
      ))}
    </div>
  );
}

function GroupTile({
  group,
  accent,
  typeLabel,
  onOpen,
}: {
  group: CommunityGroup;
  accent: GroupAccent;
  typeLabel: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={[
        "relative shrink-0 w-[240px] sm:w-[260px]",
        "overflow-hidden rounded-3xl border border-[color:var(--border-soft)]",
        "bg-[color:var(--surface-strong)]/95 p-4 text-left",
        "shadow-[0_14px_34px_rgba(0,0,0,0.22)]",
        "hover:border-[color:var(--border-strong)] active:scale-[0.99] transition-all",
        accent.border,
      ].join(" ")}
    >
      <div className={`pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full blur-3xl ${accent.glow}`} />
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b ${accent.wash}`} />

      <div className="relative">
        <div className="flex flex-wrap gap-2">
          <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${accent.chip}`}>
            <span className={`h-2 w-2 rounded-full ${accent.dot}`} />
            {typeLabel}
          </div>
          {group.is_paid && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-black text-amber-600 ring-1 ring-amber-500/30 backdrop-blur-md dark:text-amber-300">
              ⭐ {group.price} FCFA
            </div>
          )}
        </div>

        <div className="mt-3">
          <div className="truncate text-base font-extrabold text-[color:var(--foreground)]">{group.name}</div>
          {group.description ? (
            <div className="mt-1 line-clamp-2 text-sm text-[color:var(--foreground)]/75">
              {group.description}
            </div>
          ) : (
            <div className="mt-1 text-sm text-[color:var(--foreground)]/45">—</div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs font-bold text-[color:var(--foreground)]/70">
            {group.members_count || 0} membres
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-black text-[color:var(--accent)] uppercase tracking-widest">
            <span>Ouvrir</span>
            <span className="text-sm">↗</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function GroupCard({
  group,
  index,
  busy,
  onOpen,
  isCreator,
  onDelete,
  t,
}: {
  group: CommunityGroup;
  index: number;
  busy: boolean;
  onOpen: () => void;
  isCreator?: boolean;
  onDelete?: () => void;
  t: TranslateFn;
}) {
  const themes = [
    {
      soft: 'bg-[#eef4ff]',
      accent: 'bg-[#dbeafe]',
      text: 'text-[#1d4ed8]',
      border: 'border-[#bfdbfe]',
    },
    {
      soft: 'bg-[#eefbf3]',
      accent: 'bg-[#dcfce7]',
      text: 'text-[#15803d]',
      border: 'border-[#bbf7d0]',
    },
    {
      soft: 'bg-[#fff4ec]',
      accent: 'bg-[#ffedd5]',
      text: 'text-[#c2410c]',
      border: 'border-[#fed7aa]',
    },
  ];

  const theme = themes[index % themes.length];

  return (
    <div className="group relative h-full">
      <button
        type="button"
        onClick={onOpen}
        className="relative flex h-full w-full flex-col overflow-hidden rounded-[32px] border border-[#e7e9ee] bg-white p-6 text-left shadow-[0_16px_40px_rgba(16,24,40,0.06)] transition-all hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(16,24,40,0.1)] active:scale-[0.99]"
      >
        <div className={`absolute inset-x-0 top-0 h-24 ${theme.soft}`} />
        <div className="relative flex h-full flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${theme.border} ${theme.accent} ${theme.text}`}>
              <span className="h-2 w-2 rounded-full bg-current opacity-80" />
              {group.group_type === 'prayer'
                ? 'Prière'
                : group.group_type === 'study'
                  ? 'Étude biblique'
                  : group.group_type === 'support'
                    ? 'Accompagnement'
                    : group.group_type === 'formation'
                      ? 'Formation'
                      : 'Communauté'}
            </div>

            {group.is_paid ? (
              <span className="rounded-full bg-[#fff7e8] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#b54708]">
                Premium · {group.price} FCFA
              </span>
            ) : (
              <span className="rounded-full bg-[#ecfdf3] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#027a48]">
                Gratuit
              </span>
            )}
          </div>

          <div className="mt-6">
            <h4 className="text-2xl font-black leading-tight tracking-tight text-[#101828]">
              {group.name}
            </h4>
            <p className="mt-3 line-clamp-3 text-sm leading-7 text-[#667085]">
              {group.description || 'Un espace pour organiser des appels, enseigner, prier et grandir ensemble dans la Parole.'}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[#eaecf0] bg-[#fcfcfd] px-3 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#98a2b3]">
                Membres
              </div>
              <div className="mt-1 text-sm font-black text-[#101828]">
                {group.members_count || 0}
              </div>
            </div>

            <div className="rounded-2xl border border-[#eaecf0] bg-[#fcfcfd] px-3 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#98a2b3]">
                Accès
              </div>
              <div className="mt-1 text-sm font-black text-[#101828]">
                {group.is_paid ? 'Formation' : 'Libre'}
              </div>
            </div>
          </div>

          <div className="mt-auto pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {group.membershipStatus === 'pending' ? (
                  <span className="rounded-full bg-[#fff7e8] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#b54708]">
                    Demande en attente
                  </span>
                ) : (
                  <>
                    <AvatarPile count={group.members_count || 0} label={group.name} />
                    <span className="text-xs font-bold text-[#667085]">
                      {group.members_count || 0} membres
                    </span>
                  </>
                )}
              </div>

              <div className="inline-flex items-center gap-2 rounded-full bg-[#111827] px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-[0_10px_24px_rgba(17,24,39,0.14)]">
                Ouvrir
                <span className="text-sm">↗</span>
              </div>
            </div>
          </div>
        </div>
      </button>

      {isCreator && onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-2xl border border-white/60 bg-white/80 text-rose-600 shadow-lg backdrop-blur-md transition hover:bg-rose-500 hover:text-white"
          title="Supprimer le groupe"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}

const GROUP_TYPES: CommunityGroupType[] = ['general', 'prayer', 'study', 'support', 'formation'];

function GroupDetailTabs({
  selectedGroup,
  groupMembers,
  membersStatus,
  actor,
  actionState,
  savingGroupState,
  detailDescription,
  setDetailDescription,
  detailNextCallAt,
  setDetailNextCallAt,
  sessionTasks,
  setSessionTasks,
  taskDraft,
  setTaskDraft,
  callBusy,
  activeCallId,
  onStartGroupCall,
  onOpenCallRoom,
  onJoin,
  onLeave,
  onSaveGroupSettings,
  onCloseGroupPage,
  onShareGroup,
  onPromoteAdmin,
  onDeleteGroup,
  formatWhen,
  initials,
  renderTypeLabel,
  isGroupAdmin,
  currentUserStatus,
  onModerate,
  callParticipants,
  passCodeInput,
  setPassCodeInput,
  showDeleteConfirm,
  setShowDeleteConfirm,
  detailCallProvider,
  setDetailCallProvider,
  detailCallLink,
  setDetailCallLink,
  setFeedback,
}: {
  selectedGroup: CommunityGroup;
  groupMembers: CommunityGroupMember[];
  membersStatus: 'idle' | 'loading' | 'ready' | 'error';
  actor: { deviceId: string; displayName: string };
  actionState: Record<string, boolean>;
  savingGroupState: boolean;
  detailDescription: string;
  setDetailDescription: (v: string) => void;
  detailNextCallAt: string;
  setDetailNextCallAt: (v: string) => void;
  sessionTasks: string[];
  setSessionTasks: React.Dispatch<React.SetStateAction<string[]>>;
  taskDraft: string;
  setTaskDraft: React.Dispatch<React.SetStateAction<string>>;
  callBusy: boolean;
  activeCallId?: string | null;
  onStartGroupCall: () => Promise<void> | void;
  onOpenCallRoom: () => void;
  onJoin: (id: string, code?: string) => void;
  onLeave: (id: string) => void;
  onSaveGroupSettings: () => void;
  onCloseGroupPage: () => void;
  onShareGroup: (id: string) => void;
  onPromoteAdmin: (deviceId: string) => void;
  onDeleteGroup: (id: string) => void;
  formatWhen: (value?: string | null) => string;
  initials: (name: string) => string;
  renderTypeLabel: (value: CommunityGroupType) => string;
  isGroupAdmin: (group: CommunityGroup, deviceId: string) => boolean;
  currentUserStatus: CommunityGroupMemberStatus | null;
  onModerate: (deviceId: string, action: 'approve' | 'reject') => void;
  callParticipants: any[];
  passCodeInput: string;
  setPassCodeInput: (val: string) => void;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (val: boolean) => void;
  detailCallProvider: CommunityCallProvider | null;
  setDetailCallProvider: (val: CommunityCallProvider | null) => void;
  detailCallLink: string;
  setDetailCallLink: (val: string) => void;
  setFeedback: (val: string | null) => void;
}) {
  const [activeTab, setActiveTab] = useState<'discussion' | 'members' | 'about'>('discussion');

  const isAdmin = isGroupAdmin(selectedGroup, actor.deviceId);
  const isCreator = selectedGroup.created_by_device_id === actor.deviceId;
  const hasLiveCall = callParticipants.length > 0 || !!activeCallId;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCloseGroupPage}
          className="inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-4 py-2.5 text-xs font-semibold text-[#475467] transition hover:border-[#d0d5dd] hover:text-[#111827]"
        >
          ← Retour
        </button>

        <button
          type="button"
          onClick={() => onShareGroup(selectedGroup.id)}
          className="inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-4 py-2.5 text-xs font-semibold text-[#475467] transition hover:border-[#d0d5dd] hover:text-[#111827]"
        >
          <Link2 size={14} />
          Partager
        </button>
      </div>

      {/* HERO */}
      <div className="overflow-hidden rounded-[32px] border border-[#e9eaeb] bg-white shadow-[0_20px_45px_rgba(16,24,40,0.06)]">
        <div className="bg-[linear-gradient(135deg,#fff7e8_0%,#ffffff_55%,#f8fafc_100%)] px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-[24px] bg-[#111827] text-xl font-black text-white shadow-lg">
                {initials(selectedGroup.name)}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#f2f4f7] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#667085]">
                    {renderTypeLabel(selectedGroup.group_type)}
                  </span>

                  {selectedGroup.is_paid && (
                    <span className="rounded-full bg-[#fff4e5] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#b54708]">
                      Premium · {selectedGroup.price} FCFA
                    </span>
                  )}

                  {hasLiveCall && (
                    <span className="rounded-full bg-rose-500 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white animate-pulse">
                      En direct
                    </span>
                  )}
                </div>

                <h1 className="mt-3 text-3xl font-black tracking-tight text-[#101828]">
                  {selectedGroup.name}
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#667085]">
                  {selectedGroup.description || 'Espace de groupe, d’appel et de formation chrétienne.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => void onStartGroupCall()}
                  disabled={callBusy}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#111827] px-5 py-3 text-sm font-bold text-white shadow-[0_16px_32px_rgba(17,24,39,0.18)] transition hover:translate-y-[-1px] disabled:opacity-60"
                >
                  {callBusy ? <Loader2 size={16} className="animate-spin" /> : '📞'}
                  {hasLiveCall ? "Ouvrir l'appel" : 'Lancer une session'}
                </button>
              ) : hasLiveCall && currentUserStatus === 'approved' ? (
                <button
                  type="button"
                  onClick={onOpenCallRoom}
                  className="inline-flex items-center gap-2 rounded-2xl bg-rose-500 px-5 py-3 text-sm font-bold text-white shadow-[0_16px_32px_rgba(244,63,94,0.2)] transition hover:translate-y-[-1px]"
                >
                  Rejoindre l’appel
                </button>
              ) : null}
            </div>
          </div>

          {/* KPIs */}
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#eaecf0] bg-white px-4 py-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#98a2b3]">Membres</div>
              <div className="mt-2 text-2xl font-black text-[#101828]">{selectedGroup.members_count}</div>
            </div>

            <div className="rounded-2xl border border-[#eaecf0] bg-white px-4 py-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#98a2b3]">Accès</div>
              <div className="mt-2 text-sm font-bold text-[#101828]">
                {selectedGroup.is_paid ? 'Formation payante' : 'Accès gratuit'}
              </div>
            </div>

            <div className="rounded-2xl border border-[#eaecf0] bg-white px-4 py-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#98a2b3]">Prochaine session</div>
              <div className="mt-2 text-sm font-bold text-[#101828]">
                {selectedGroup.next_call_at ? formatWhen(selectedGroup.next_call_at) : 'Non planifiée'}
              </div>
            </div>

            <div className="rounded-2xl border border-[#eaecf0] bg-white px-4 py-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#98a2b3]">Format</div>
              <div className="mt-2 text-sm font-bold text-[#101828]">
                Appel · Chat · Bible sync
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* JOIN / ACCESS */}
      {!selectedGroup.joined ? (
        <div className="rounded-[28px] border border-[#e9eaeb] bg-white p-6 shadow-[0_20px_45px_rgba(16,24,40,0.05)]">
          {selectedGroup.is_paid && (
            <div className="mb-4 rounded-2xl border border-[#fedf89] bg-[#fffaeb] p-4">
              <div className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#b54708]">
                Accès formation
              </div>
              <input
                type="text"
                placeholder="Clé d'accès (CHARIS-XXXXX)"
                value={passCodeInput}
                onChange={(e) => setPassCodeInput(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-[#f5d08a] bg-white px-4 py-3 text-sm font-semibold text-[#101828] outline-none focus:ring-2 focus:ring-[#fdb022]/25"
              />
            </div>
          )}

          <button
            type="button"
            disabled={!!actionState[selectedGroup.id]}
            onClick={() => onJoin(selectedGroup.id, passCodeInput)}
            className="w-full rounded-2xl bg-[#111827] px-6 py-3.5 text-sm font-bold text-white shadow-[0_16px_32px_rgba(17,24,39,0.16)] transition hover:translate-y-[-1px] disabled:opacity-50"
          >
            {selectedGroup.is_paid ? "Valider l'accès" : 'Rejoindre ce groupe'}
          </button>
        </div>
      ) : (
        <div className="rounded-[28px] border border-[#e9eaeb] bg-white p-4 shadow-[0_20px_45px_rgba(16,24,40,0.05)]">
          <button
            type="button"
            disabled={!!actionState[selectedGroup.id]}
            onClick={() => onLeave(selectedGroup.id)}
            className="w-full rounded-2xl border border-[#eaecf0] bg-white px-6 py-3.5 text-sm font-semibold text-[#475467] transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-50"
          >
            Quitter le groupe
          </button>
        </div>
      )}

      {/* SESSION PANEL */}
      <div className="rounded-[32px] border border-[#e9eaeb] bg-white p-6 shadow-[0_20px_45px_rgba(16,24,40,0.05)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#98a2b3]">
              Session & pilotage
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-[#101828]">
              Prochaine session
            </h2>
            <p className="mt-2 text-sm leading-7 text-[#667085]">
              Planifie l’appel, définis le déroulé et prépare les points à aborder avec ton groupe.
            </p>
          </div>

          {selectedGroup.next_call_at && (
            <div className="rounded-2xl bg-[#f8fafc] px-4 py-3 text-sm font-bold text-[#101828] border border-[#eaecf0]">
              {formatWhen(selectedGroup.next_call_at)}
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#eaecf0] bg-[#fcfcfd] p-4">
            <label className="block">
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#98a2b3]">
                Description
              </span>
              <textarea
                value={detailDescription}
                onChange={(event) => setDetailDescription(event.target.value)}
                rows={3}
                placeholder="Décris l’objectif de la session ou de la formation..."
                className="w-full resize-none rounded-xl border border-[#eaecf0] bg-white px-4 py-3 text-sm text-[#101828] outline-none focus:ring-2 focus:ring-[#d6bbfb]/25"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-[#eaecf0] bg-[#fcfcfd] p-4">
            <label className="block">
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#98a2b3]">
                Date & heure
              </span>
              <input
                value={detailNextCallAt}
                onChange={(event) => setDetailNextCallAt(event.target.value)}
                type="datetime-local"
                className="w-full rounded-xl border border-[#eaecf0] bg-white px-4 py-3 text-sm text-[#101828] outline-none focus:ring-2 focus:ring-[#d6bbfb]/25"
              />
            </label>

            <div className="mt-4">
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#98a2b3]">
                Plateforme d’appel
              </span>
              <div className="grid grid-cols-2 gap-2">
                {(['google_meet', 'facetime', 'skype', 'other'] as CommunityCallProvider[]).map((prov) => (
                  <button
                    key={prov}
                    type="button"
                    onClick={() => setDetailCallProvider(prov)}
                    className={`rounded-xl px-3 py-2 text-[11px] font-bold uppercase transition ${
                      detailCallProvider === prov
                        ? 'bg-[#111827] text-white'
                        : 'border border-[#eaecf0] bg-white text-[#667085] hover:border-[#d0d5dd]'
                    }`}
                  >
                    {prov.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <input
                value={detailCallLink}
                onChange={(e) => setDetailCallLink(e.target.value)}
                placeholder="Lien d’appel externe (optionnel)"
                className="mt-3 w-full rounded-xl border border-[#eaecf0] bg-white px-4 py-3 text-sm text-[#101828] outline-none focus:ring-2 focus:ring-[#d6bbfb]/25"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[#eaecf0] bg-[#fcfcfd] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#98a2b3]">
              Programme de session
            </span>
            <span className="text-xs font-bold text-[#667085]">
              {sessionTasks.length} point{sessionTasks.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {sessionTasks.map((task, idx) => (
              <div key={idx} className="flex items-center gap-3 rounded-xl border border-[#eaecf0] bg-white px-3 py-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f2f4f7] text-[10px] font-black text-[#111827]">
                  {idx + 1}
                </div>
                <div className="flex-1 text-sm font-medium text-[#101828]">{task}</div>
                <button
                  type="button"
                  onClick={() => setSessionTasks(prev => prev.filter((_, i) => i !== idx))}
                  className="text-[#98a2b3] transition hover:text-rose-500"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={taskDraft}
              onChange={(e) => setTaskDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && taskDraft.trim()) {
                  setSessionTasks(prev => [...prev, taskDraft.trim()]);
                  setTaskDraft('');
                }
              }}
              placeholder="Ajouter un point à traiter..."
              className="h-11 flex-1 rounded-xl border border-[#eaecf0] bg-white px-4 text-sm text-[#101828] outline-none focus:ring-2 focus:ring-[#d6bbfb]/25"
            />
            <button
              type="button"
              onClick={() => {
                if (taskDraft.trim()) {
                  setSessionTasks(prev => [...prev, taskDraft.trim()]);
                  setTaskDraft('');
                }
              }}
              disabled={!taskDraft.trim()}
              className="h-11 rounded-xl bg-[#111827] px-4 text-sm font-bold text-white disabled:opacity-40"
            >
              Ajouter
            </button>
          </div>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={onSaveGroupSettings}
            disabled={savingGroupState}
            className="mt-5 w-full rounded-2xl bg-[#111827] px-6 py-3.5 text-sm font-bold text-white shadow-[0_16px_32px_rgba(17,24,39,0.14)] transition hover:translate-y-[-1px] disabled:opacity-60"
          >
            {savingGroupState ? 'Enregistrement...' : 'Enregistrer la session'}
          </button>
        )}
      </div>

      {/* CONTENT TABS */}
      <div className="rounded-[32px] border border-[#e9eaeb] bg-white shadow-[0_20px_45px_rgba(16,24,40,0.05)]">
        <div className="flex border-b border-[#eaecf0]">
          {[
            { key: 'discussion', label: 'Discussion' },
            { key: 'members', label: 'Membres' },
            { key: 'about', label: 'Présentation' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as 'discussion' | 'members' | 'about')}
              className={`flex-1 px-4 py-4 text-sm font-bold transition ${
                activeTab === tab.key
                  ? 'text-[#111827] border-b-2 border-[#111827]'
                  : 'text-[#667085] hover:text-[#111827]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'discussion' && (
            currentUserStatus === 'pending' ? (
              <div className="rounded-2xl border border-[#fedf89] bg-[#fffaeb] p-6 text-center">
                <div className="text-3xl">⏳</div>
                <h3 className="mt-3 font-bold text-[#101828]">Validation en cours</h3>
                <p className="mt-2 text-sm text-[#667085]">
                  Un administrateur doit valider votre adhésion avant l’accès complet au groupe.
                </p>
              </div>
            ) : (
              <CommunityGroupChat groupId={selectedGroup.id} actor={actor} />
            )
          )}

          {activeTab === 'members' && (
            <div className="space-y-3">
              {groupMembers.map((member) => {
                const isMe = member.device_id === actor.deviceId;
                const joinedAt = formatWhen(member.joined_at);

                return (
                  <div
                    key={`${member.group_id}-${member.device_id}`}
                    className="flex items-center justify-between rounded-2xl border border-[#eaecf0] bg-[#fcfcfd] px-4 py-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#111827] text-xs font-bold text-white">
                        {initials(member.display_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-[#101828]">
                          {member.display_name}
                        </div>
                        <div className="text-xs text-[#667085]">
                          {joinedAt || member.device_id.slice(0, 8)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {member.device_id === selectedGroup.created_by_device_id && (
                        <span className="rounded-full bg-[#fff4e5] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#b54708]">
                          Créateur
                        </span>
                      )}

                      {member.device_id !== selectedGroup.created_by_device_id &&
                        selectedGroup.admin_ids?.includes(member.device_id) && (
                          <span className="rounded-full bg-[#eff8ff] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#175cd3]">
                            Admin
                          </span>
                        )}

                      {isMe && (
                        <span className="rounded-full bg-[#ecfdf3] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#027a48]">
                          Vous
                        </span>
                      )}

                      {isAdmin && member.status === 'pending' && !isMe && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => onModerate(member.device_id, 'approve')}
                            className="rounded-xl bg-[#ecfdf3] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#027a48]"
                          >
                            Accepter
                          </button>
                          <button
                            onClick={() => onModerate(member.device_id, 'reject')}
                            className="rounded-xl bg-[#fef3f2] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#d92d20]"
                          >
                            Refuser
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#eaecf0] bg-[#fcfcfd] p-5">
                <p className="text-sm leading-7 text-[#667085]">
                  {selectedGroup.description || 'Aucune présentation disponible pour ce groupe.'}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#eaecf0] bg-[#fcfcfd] p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#98a2b3]">Créé par</div>
                  <div className="mt-2 text-sm font-bold text-[#101828]">{selectedGroup.created_by_name || '—'}</div>
                </div>

                <div className="rounded-2xl border border-[#eaecf0] bg-[#fcfcfd] p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#98a2b3]">Type</div>
                  <div className="mt-2 text-sm font-bold text-[#101828]">{renderTypeLabel(selectedGroup.group_type)}</div>
                </div>
              </div>

              {isCreator && selectedGroup.is_paid && (
                <div className="rounded-2xl border border-[#fedf89] bg-[#fffaeb] p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#b54708]">
                    Clé d’accès formation
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-lg font-black tracking-wider text-[#7a2e0e]">
                      {selectedGroup.pass_code}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedGroup.pass_code || '');
                        setFeedback(`Clé d'accès copiée : ${selectedGroup.pass_code}`);
                      }}
                      className="rounded-xl bg-[#f79009] px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white"
                    >
                      Copier
                    </button>
                  </div>
                </div>
              )}

              {isCreator && (
                <div className="border-t border-[#eaecf0] pt-6">
                  <div className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-rose-600">
                    Zone de danger
                  </div>
                  <p className="mb-4 text-sm leading-6 text-[#667085]">
                    La suppression du groupe est définitive et retire la salle, les membres et les échanges liés.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={actionState[selectedGroup.id]}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#fef3f2] px-5 py-3 text-sm font-bold text-[#d92d20] border border-[#fecdca]"
                  >
                    <Trash2 size={16} />
                    Supprimer le groupe
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CommunityGroups({ initialGroupId }: { initialGroupId?: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const autoJoinRequested = searchParams.get('autoJoin') === 'true';
  const queryCallId = searchParams.get('call') || '';
  const queryGroupId = searchParams.get('group') || '';
  const { identity } = useCommunityIdentity();
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [actionState, setActionState] = useState<Record<string, boolean>>({});
  const [createState, setCreateState] = useState<CreateState>('idle');
  const [savingGroupState, setSavingGroupState] = useState(false);
  const [feedRefreshToken, setFeedRefreshToken] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroupId || '');
  const [shouldScrollToDetail, setShouldScrollToDetail] = useState(false);
  const [groupMembers, setGroupMembers] = useState<CommunityGroupMember[]>([]);
  const [membersStatus, setMembersStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [callFullscreenOpen, setCallFullscreenOpen] = useState(false);
  const [callParticipants, setCallParticipants] = useState<any[]>([]);
  const [activeGroupCall, setActiveGroupCall] = useState<GroupCallSession | null>(null);
  const [startedCallSession, setStartedCallSession] = useState<GroupCallSession | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const detailPanelRef = useRef<HTMLElement | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupType, setGroupType] = useState<CommunityGroupType>('general');
  const [nextCallAt, setNextCallAt] = useState('');
  const [detailDescription, setDetailDescription] = useState('');
  const [detailNextCallAt, setDetailNextCallAt] = useState('');
  const [detailCallProvider, setDetailCallProvider] = useState<CommunityCallProvider | null>(null);
  const [detailCallLink, setDetailCallLink] = useState('');
  const [sessionTasks, setSessionTasks] = useState<string[]>([]);
  const [taskDraft, setTaskDraft] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState(0);
  const [passCodeInput, setPassCodeInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const initialSyncDone = useRef(false);

  const { user, profile } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const actor = useMemo(() => {
    return {
      deviceId: identity?.deviceId || '',
      displayName: identity?.displayName || user?.email?.split('@')[0] || t('identity.guest'),
      userId: user?.id,
    };
  }, [identity?.deviceId, identity?.displayName, user, t]);

  const ensureAuth = useCallback(() => {
    if (!user) {
      setIsAuthModalOpen(true);
      return false;
    }
    return true;
  }, [user]);

  const [searchTerm, setSearchTerm] = useState('');
  const [listMode, setListMode] = useState<GroupListMode>('all');

  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groups;
    const lower = searchTerm.toLowerCase();
    return groups.filter(g => g.name.toLowerCase().includes(lower) || (g.description && g.description.toLowerCase().includes(lower)));
  }, [groups, searchTerm]);

  const joinedGroups = useMemo(() => filteredGroups.filter((g) => !!g.joined), [filteredGroups]);
  const otherGroups = useMemo(() => filteredGroups.filter((g) => !g.joined), [filteredGroups]);
  const filteredJoinedCount = useMemo(
    () => filteredGroups.reduce((count, group) => (group.joined ? count + 1 : count), 0),
    [filteredGroups]
  );
  const filteredOtherCount = useMemo(
    () => filteredGroups.reduce((count, group) => (group.joined ? count : count + 1), 0),
    [filteredGroups]
  );

  const joinedGroupsCount = useMemo(
    () => groups.reduce((count, group) => (group.joined ? count + 1 : count), 0),
    [groups]
  );
  const mobileSwitcherGroups = useMemo(
    () => [...groups].sort((a, b) => Number(!!b.joined) - Number(!!a.joined)).slice(0, 14),
    [groups]
  );
  
  const joinedGroupsKey = useMemo(
    () => joinedGroups.map(g => `${g.id}:${g.next_call_at || ''}`).join('|'),
    [joinedGroups]
  );

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );

  const loadGroupMembers = useCallback(
    async (groupId: string) => {
      if (!groupId) {
        setGroupMembers([]);
        setMembersStatus('idle');
        return;
      }
      setMembersStatus('loading');
      try {
        const members = await fetchGroupMembers(groupId, 120);
        setGroupMembers(members);
        setMembersStatus('ready');
      } catch {
        setGroupMembers([]);
        setMembersStatus('error');
      }
    },
    []
  );

  const currentUserStatus = useMemo(() => {
    const member = groupMembers.find((m) => m.device_id === actor.deviceId);
    return member?.status || null;
  }, [groupMembers, actor.deviceId]);

  const currentCallSession = useMemo(() => {
    if (!selectedGroupId) return null;
    if (activeGroupCall?.group_id === selectedGroupId) return activeGroupCall;
    if (startedCallSession?.group_id === selectedGroupId) return startedCallSession;
    return null;
  }, [activeGroupCall, selectedGroupId, startedCallSession]);

  const currentCallId = queryCallId || currentCallSession?.id || '';

  const onModerate = useCallback(
    async (memberDeviceId: string, action: 'approve' | 'reject') => {
      if (!selectedGroup) return;
      try {
        await moderateGroupMember(selectedGroup.id, memberDeviceId, action);
        await loadGroupMembers(selectedGroup.id);
        const list = await fetchGroups(60, actor.deviceId || undefined);
        setGroups(list);
        setFeedback(action === 'approve' ? 'Membre approuvé' : 'Membre refusé');
      } catch (e) {
        console.error('Moderation failed', e);
        setFeedback('Échec de la modération');
      }
    },
    [selectedGroup, loadGroupMembers, actor.deviceId]
  );

  const isGroupAdmin = useCallback((group: CommunityGroup, deviceId: string) => {
    return group.created_by_device_id === deviceId || !!(group.admin_ids && group.admin_ids.includes(deviceId));
  }, []);

  useEffect(() => {
    if (!selectedGroupId || !supabase) {
      setCallParticipants([]);
      setActiveGroupCall(null);
      return;
    }

    const checkCall = async () => {
      const [presenceRows, activeCall] = await Promise.all([
        fetchGroupCallPresence(selectedGroupId),
        fetchActiveGroupCall(selectedGroupId),
      ]);
      setCallParticipants(presenceRows);
      setActiveGroupCall(activeCall);
      if (!activeCall && startedCallSession?.group_id === selectedGroupId) {
        setStartedCallSession(null);
      }
    };

    checkCall();
    const interval = setInterval(checkCall, 15000);
    return () => clearInterval(interval);
  }, [selectedGroupId, startedCallSession, supabase]);

  const updateGroupQuery = useCallback(
    (groupId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (groupId) params.set('group', groupId);
      else params.delete('group');
      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      router.replace(url, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const onSelectGroup = useCallback(
    (groupId: string) => {
      setSelectedGroupId(groupId);
      setShouldScrollToDetail(true);
      setFeedback(t('community.groups.opened'));
      updateGroupQuery(groupId);
    },
    [t, updateGroupQuery]
  );

  const onCloseGroupPage = useCallback(() => {
    updateGroupQuery(null);
  }, [updateGroupQuery]);

  const closeCallRoom = useCallback(() => {
    setCallFullscreenOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('call');
    params.delete('autoJoin');
    const qs = params.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    router.replace(url, { scroll: false });
  }, [pathname, router, searchParams]);

  const openCallRoom = useCallback(
    (callId?: string | null) => {
      if (!selectedGroupId) return;
      setCallFullscreenOpen(true);
      const params = new URLSearchParams(searchParams.toString());
      params.set('group', selectedGroupId);
      if (callId) params.set('call', callId);
      else params.delete('call');
      params.delete('autoJoin');
      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      router.replace(url, { scroll: false });
    },
    [pathname, router, searchParams, selectedGroupId]
  );

  const onStartGroupCall = useCallback(async () => {
    if (!ensureAuth()) return;
    if (!selectedGroup || !actor.deviceId) return;

    const busyKey = `call-${selectedGroup.id}`;
    setActionState((prev) => ({ ...prev, [busyKey]: true }));
    try {
      let call = currentCallSession;
      const shouldAnnounce = !call || call.status === 'ended';

      if (shouldAnnounce) {
        call = await startGroupCallSession({
          groupId: selectedGroup.id,
          userId: actor.deviceId,
          userName: actor.displayName,
        });
        if (call) {
          setStartedCallSession(call);
          setActiveGroupCall(call);
        }
      }

      if (shouldAnnounce && call) {
        await triggerGroupCallPush({
          groupId: selectedGroup.id,
          callerDeviceId: actor.deviceId,
          callerDisplayName: actor.displayName,
          callType: 'audio',
          groupName: selectedGroup.name,
          callId: call.id,
        });
      }

      openCallRoom(call?.id || null);
    } catch (error: any) {
      setFeedback(error?.message || 'Impossible de démarrer l’appel de groupe.');
    } finally {
      setActionState((prev) => ({ ...prev, [busyKey]: false }));
    }
  }, [actor.deviceId, actor.displayName, currentCallSession, openCallRoom, selectedGroup]);

  const onOpenCallRoom = useCallback(() => {
    openCallRoom(currentCallId || null);
  }, [currentCallId, openCallRoom]);

  useEffect(() => {
    if (!autoJoinRequested) return;
    if (!selectedGroup) return;
    if (queryGroupId && selectedGroup.id !== queryGroupId) return;

    // Ouvre directement la salle d'appel pour que CommunityGroupCall
    // puisse exécuter son auto-join interne.
    setCallFullscreenOpen(true);

    // Consommer autoJoin pour éviter les réouvertures en boucle
    // si l'utilisateur ferme ensuite la salle.
    const params = new URLSearchParams(searchParams.toString());
    params.delete('autoJoin');
    const qs = params.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    router.replace(url, { scroll: false });
  }, [autoJoinRequested, pathname, queryGroupId, router, searchParams, selectedGroup]);

  const loadGroups = useCallback(async () => {
    setStatus('loading');
    try {
      const list = await fetchGroups(60, actor.deviceId || undefined);
      setGroups(list);
      if (list.length) {
        // Validation logic for current selection
        const hasCurrent = !!selectedGroupId && list.some((item) => item.id === selectedGroupId);
        if (selectedGroupId && !hasCurrent) {
          // If the selected group is no longer in the list (e.g. deleted), clear selection
          setSelectedGroupId('');
          updateGroupQuery(null);
        }
      } else if (selectedGroupId) {
        setSelectedGroupId('');
      }
      setStatus('ready');
    } catch {
      setStatus('error');
      setFeedback(t('community.groups.loadError'));
    }
  }, [actor.deviceId, selectedGroupId, t, updateGroupQuery]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      loadGroups();
    }
  }, [mounted, loadGroups]);

  // Sync URL -> Local State (Single source of truth)
  useEffect(() => {
    const queryId = searchParams.get('group');
    let qid = queryId || '';

    // Only fallback to initialGroupId on first mount if no queryId
    if (!initialSyncDone.current) {
      if (!qid && initialGroupId) {
        qid = initialGroupId;
      }
      initialSyncDone.current = true;
    }

    if (qid !== selectedGroupId) {
      setSelectedGroupId(qid);
      if (qid) setShouldScrollToDetail(true);
    }
  }, [searchParams, initialGroupId, selectedGroupId]);

  // Real-time listener for ALL joined groups to show call scheduled notifications
  useEffect(() => {
    if (!supabase || joinedGroups.length === 0) return;

    const channels = joinedGroups.map((group) => {
      return supabase
        .channel(`group_activity:${group.id}`)
        .on('broadcast', { event: 'call_scheduled' }, ({ payload }: { payload: any }) => {
          // If it's not the admin who scheduled it (optional filter)
          if (payload.adminName) {
            setFeedback(`🚀 Appèl planifié pour "${group.name}" à ${new Date(payload.nextCallAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} par ${payload.adminName}`);
          }
        })
        .subscribe();
    });

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
      }, [joinedGroupsKey, supabase]);


  // PROACTIVE REMINDERS MONITOR (60min and 15min)
  useEffect(() => {
    if (joinedGroups.length === 0) return;

    const checkReminders = () => {
      const now = Date.now();
      joinedGroups.forEach((group) => {
        if (!group.next_call_at) return;
        const target = new Date(group.next_call_at).getTime();
        const diffInSeconds = Math.floor((target - now) / 1000);
        
        // Reminder 60 mins before (3600s)
        if (diffInSeconds > 3540 && diffInSeconds <= 3600) {
          const key = `reminder-60-${group.id}-${target}`;
          if (!localStorage.getItem(key)) {
            setFeedback(`⏰ Rappel : L'Appèl pour "${group.name}" commence dans 1 heure !`);
            localStorage.setItem(key, 'sent');
          }
        }
        
        // Reminder 15 mins before (900s)
        if (diffInSeconds > 840 && diffInSeconds <= 900) {
          const key = `reminder-15-${group.id}-${target}`;
          if (!localStorage.getItem(key)) {
            setFeedback(`🔔 Rappel : L'Appèl pour "${group.name}" commence dans 15 minutes !`);
            localStorage.setItem(key, 'sent');
          }
        }
      });
    };

    const interval = setInterval(checkReminders, 30000); // Check every 30s
    checkReminders(); // Initial check

    return () => clearInterval(interval);
  }, [joinedGroupsKey]);

  useEffect(() => {
    let timer: number | null = null;
    let pollTimer: number | null = null;

    const refreshNow = () => {
      void loadGroups();
      if (selectedGroupId) {
        void loadGroupMembers(selectedGroupId);
      }
    };

    const scheduleGroupsRefresh = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        refreshNow();
      }, 450);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshNow();
    };
    window.addEventListener('focus', refreshNow);
    document.addEventListener('visibilitychange', onVisibility);
    pollTimer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      refreshNow();
    }, 12000);

    const realtimeClient = supabase;
    const channel = realtimeClient
      ? realtimeClient
          .channel('charishub_groups_changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'charishub_groups' }, () => {
            scheduleGroupsRefresh();
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'charishub_group_members' }, () => {
            scheduleGroupsRefresh();
          })
          .subscribe()
      : null;

    return () => {
      if (timer) window.clearTimeout(timer);
      if (pollTimer) window.clearInterval(pollTimer);
      window.removeEventListener('focus', refreshNow);
      document.removeEventListener('visibilitychange', onVisibility);
      if (realtimeClient && channel) {
        realtimeClient.removeChannel(channel);
      }
    };
  }, [loadGroups, loadGroupMembers, selectedGroupId]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 2200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (!selectedGroupId) {
      setCallFullscreenOpen(false);
      setGroupMembers([]);
      setMembersStatus('idle');
      return;
    }
    void loadGroupMembers(selectedGroupId);
  }, [loadGroupMembers, selectedGroupId]);

  useEffect(() => {
    if (!selectedGroup) return;
    setDetailDescription(selectedGroup.description || '');
    setSessionTasks(selectedGroup.session_tasks || []);
    if (selectedGroup.next_call_at) {
      const date = new Date(selectedGroup.next_call_at);
      const yyyy = String(date.getFullYear());
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      setDetailNextCallAt(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
    } else {
      setDetailNextCallAt('');
    }
    setDetailCallProvider(selectedGroup.call_provider || null);
    setDetailCallLink(selectedGroup.call_link || '');
  }, [selectedGroup]);

  useEffect(() => {
    if (!shouldScrollToDetail || !selectedGroupId) return;
    const timer = window.setTimeout(() => {
      const isMobileLayout = window.matchMedia('(max-width: 1279px)').matches;
      if (isMobileLayout) {
        detailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setShouldScrollToDetail(false);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [selectedGroupId, shouldScrollToDetail]);

  useEffect(() => {
    if (!callFullscreenOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [callFullscreenOpen]);

  const onCreate = async () => {
    if (!ensureAuth()) return;

    const trimmedName = name.trim();
    if (trimmedName.length < 3) {
      setFeedback(t('community.groups.nameTooShort'));
      return;
    }
    if (!actor.deviceId) {
      setFeedback(t('community.groups.actionError'));
      return;
    }

    setCreateState('saving');
    try {
      const passCode = isPaid ? 'CHARIS-' + Math.random().toString(36).substring(2, 7).toUpperCase() : '';
      const created = await createGroup({
        name: trimmedName,
        description: description.trim(),
        group_type: groupType,
        created_by_name: actor.displayName,
        created_by_device_id: actor.deviceId,
        next_call_at: nextCallAt ? new Date(nextCallAt).toISOString() : null,
        is_paid: isPaid,
        price: price,
        pass_code: passCode,
        user_id: actor.userId,
      });

      if (isPaid && created) {
        setFeedback(`Formation créée avec succès. Clé d'accès : ${passCode}`);
      }

      setName('');
      setDescription('');
      setGroupType('general');
      setNextCallAt('');
      setIsPaid(false);
      setPrice(0);
      await loadGroups();
      setShowCreateForm(false);
      setFeedback(t('community.groups.created'));
      if (created?.id) {
        setSelectedGroupId(created.id);
        updateGroupQuery(created.id);
      }
      await loadGroups();
    } catch (error: any) {
      setFeedback(error?.message || t('community.groups.createError'));
    } finally {
      setCreateState('idle');
    }
  };

  const onJoin = async (groupId: string, code?: string) => {
    if (!ensureAuth()) return;
    if (!actor.deviceId) return;
    const group = groups.find(g => g.id === groupId);
    
    if (group?.is_paid && (!code || code.trim().toUpperCase() !== group.pass_code?.trim().toUpperCase())) {
      if (!code) {
        setFeedback("Ce groupe est une formation payante. Veuillez entrer votre clé d'accès.");
      } else {
        setFeedback("Clé d'accès incorrecte. Veuillez vérifier votre code de formation.");
      }
      return;
    }

    setActionState((prev) => ({ ...prev, [groupId]: true }));
    try {
      await joinGroup(groupId, actor.deviceId, actor.displayName, actor.userId);
      await loadGroups();
      if (groupId === selectedGroupId) {
        await loadGroupMembers(groupId);
      }
    } catch {
      setFeedback(t('community.groups.actionError'));
    } finally {
      setActionState((prev) => ({ ...prev, [groupId]: false }));
    }
  };

  const onLeave = async (groupId: string) => {
    if (!actor.deviceId) return;
    setActionState((prev) => ({ ...prev, [groupId]: true }));
    try {
      await leaveGroup(groupId, actor.deviceId);
      await loadGroups();
      if (groupId === selectedGroupId) {
        await loadGroupMembers(groupId);
      }
    } catch {
      setFeedback(t('community.groups.actionError'));
    } finally {
      setActionState((prev) => ({ ...prev, [groupId]: false }));
    }
  };

  const onSaveGroupSettings = async () => {
    if (!selectedGroup) return;
    setSavingGroupState(true);
    try {
      await updateGroup(selectedGroup.id, actor.deviceId, {
        description: detailDescription.trim(),
        call_provider: detailCallProvider,
        call_link: detailCallLink.trim() || null,
        next_call_at: detailNextCallAt ? new Date(detailNextCallAt).toISOString() : null,
        session_tasks: sessionTasks,
      });

      // Trigger push notification if a call was just scheduled
      if (detailNextCallAt) {
        try {
          const { triggerGroupCallScheduledPush } = await import('./communityApi');
          await triggerGroupCallScheduledPush({
            groupId: selectedGroup.id,
            groupName: selectedGroup.name,
            nextCallAt: detailNextCallAt,
            adminName: actor.displayName,
          });
        } catch (e) {
          console.error('Failed to trigger scheduled call push', e);
        }
      }

      setFeedback(t('community.groups.saved'));
      await loadGroups();
    } catch {
      setFeedback(t('community.groups.saveError'));
    } finally {
      setSavingGroupState(false);
    }
  };

  const onPromoteAdmin = async (memberDeviceId: string) => {
    if (!selectedGroup || !actor.deviceId || !isGroupAdmin(selectedGroup, actor.deviceId)) return;
    setActionState((prev) => ({ ...prev, [`promote-${memberDeviceId}`]: true }));
    try {
      const newAdminIds = [...(selectedGroup.admin_ids || []), memberDeviceId];
      await updateGroup(selectedGroup.id, actor.deviceId, { admin_ids: newAdminIds });
      setFeedback(t('community.groups.adminPromoted'));
      await loadGroups(); // Refresh groups to get updated admin_ids
      await loadGroupMembers(selectedGroup.id); // Refresh members list
    } catch {
      setFeedback(t('community.groups.actionError'));
    } finally {
      setActionState((prev) => ({ ...prev, [`promote-${memberDeviceId}`]: false }));
    }
  };

  const onDeleteGroup = async (groupId: string) => {
    if (!actor.deviceId) return;
    setActionState((prev) => ({ ...prev, [groupId]: true }));
    try {
      const { deleteGroup } = await import('./communityApi');
      await deleteGroup(groupId, actor.deviceId);
      setFeedback(t('community.groups.deleted') || 'Groupe supprime.');
      setSelectedGroupId('');
      updateGroupQuery('');
      await loadGroups();
    } catch (error: any) {
      setFeedback(error?.message || t('community.groups.actionError'));
    } finally {
      setActionState((prev) => ({ ...prev, [groupId]: false }));
    }
  };


  const onShareGroup = async (groupId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${origin || ''}/groups?group=${encodeURIComponent(groupId)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: t('community.groups.title'),
          text: t('community.groups.shareLabel'),
          url: shareUrl,
        });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setFeedback(t('community.groups.linkCopied'));
      }
    } catch {
      setFeedback(t('community.groups.actionError'));
    }
  };

  const renderTypeLabel = (value: CommunityGroupType) => {
    if (value === 'prayer') return t('community.groups.type.prayer');
    if (value === 'study') return t('community.groups.type.study');
    if (value === 'support') return t('community.groups.type.support');
    if (value === 'formation') return t('community.groups.type.formation');
    return t('community.groups.type.general');
  };

  const typeAccent = (value: CommunityGroupType) => {
    if (value === 'prayer') {
      return {
        border: 'border-l-4 border-l-emerald-400/70',
        dot: 'bg-emerald-300',
        chip: 'border-emerald-300/30 bg-emerald-500/10',
        glow: 'bg-emerald-500/35',
        wash: 'from-emerald-500/18 to-transparent',
      };
    }
    if (value === 'study') {
      return {
        border: 'border-l-4 border-l-sky-400/70',
        dot: 'bg-sky-300',
        chip: 'border-sky-300/30 bg-sky-500/10',
        glow: 'bg-sky-500/35',
        wash: 'from-sky-500/18 to-transparent',
      };
    }
    if (value === 'support') {
      return {
        border: 'border-l-4 border-l-amber-400/70',
        dot: 'bg-amber-300',
        chip: 'border-amber-300/30 bg-amber-500/10',
        glow: 'bg-amber-500/35',
        wash: 'from-amber-500/18 to-transparent',
      };
    }
    if (value === 'formation') {
      return {
        border: 'border-l-4 border-l-indigo-600/70',
        dot: 'bg-indigo-500',
        chip: 'border-indigo-400/30 bg-indigo-500/10',
        glow: 'bg-indigo-600/35',
        wash: 'from-indigo-600/18 to-transparent',
      };
    }
    return {
      border: 'border-l-4 border-l-violet-400/70',
      dot: 'bg-violet-300',
      chip: 'border-violet-300/30 bg-violet-500/10',
      glow: 'bg-violet-500/35',
      wash: 'from-violet-500/18 to-transparent',
    };
  };

  return (
    <div className="relative -mt-6 -mx-4 sm:-mx-6 sm:-mt-8">
      {selectedGroup ? (
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <button
            onClick={onCloseGroupPage}
            className="mb-6 inline-flex items-center gap-2 text-sm font-bold opacity-60 hover:opacity-100"
          >
            <span className="text-xl">←</span>
            Retour à la communauté
          </button>
          
          <GroupDetailTabs
            selectedGroup={selectedGroup}
            groupMembers={groupMembers}
            membersStatus={membersStatus}
            actor={actor}
            actionState={actionState}
            savingGroupState={savingGroupState}
            detailDescription={detailDescription}
            setDetailDescription={setDetailDescription}
            detailNextCallAt={detailNextCallAt}
            setDetailNextCallAt={setDetailNextCallAt}
            callBusy={!!actionState[`call-${selectedGroup.id}`]}
            activeCallId={currentCallId || null}
            onStartGroupCall={onStartGroupCall}
            onOpenCallRoom={onOpenCallRoom}
            onJoin={onJoin}
            onLeave={onLeave}
            onSaveGroupSettings={onSaveGroupSettings}
            onCloseGroupPage={onCloseGroupPage}
            onShareGroup={onShareGroup}
            onPromoteAdmin={onPromoteAdmin}
            onDeleteGroup={onDeleteGroup}
            formatWhen={formatWhen}
            initials={initials}
            renderTypeLabel={renderTypeLabel}
            isGroupAdmin={isGroupAdmin}
            currentUserStatus={currentUserStatus}
            onModerate={onModerate}
            callParticipants={callParticipants}
            passCodeInput={passCodeInput}
            setPassCodeInput={setPassCodeInput}
            showDeleteConfirm={showDeleteConfirm}
            setShowDeleteConfirm={setShowDeleteConfirm}
            sessionTasks={sessionTasks}
            setSessionTasks={setSessionTasks}
            taskDraft={taskDraft}
            setTaskDraft={setTaskDraft}
            detailCallProvider={detailCallProvider}
            setDetailCallProvider={setDetailCallProvider}
            detailCallLink={detailCallLink}
            setDetailCallLink={setDetailCallLink}
            setFeedback={setFeedback}
          />
        </div>
      ) : (
        <>
          <section className="relative overflow-hidden bg-[#fcf8f1] px-6 py-12 sm:px-12 sm:py-20 lg:py-24">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(200,159,45,0.10),transparent_38%)]" />

            <div className="absolute right-0 top-0 bottom-0 z-0 hidden w-[58%] lg:block">
              <img
                src="/images/community_hero.png"
                alt=""
                className="h-full w-full object-cover object-center opacity-95"
                aria-hidden="true"
              />
            </div>

            <div className="absolute inset-y-0 right-0 z-[1] hidden w-[65%] bg-gradient-to-r from-[#fcf8f1] via-[#fcf8f1]/45 to-transparent lg:block" />

            <div className="relative z-10 mx-auto max-w-7xl">
              <div className="max-w-3xl text-center lg:text-left">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#eadfca] bg-white/90 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#b88919] shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  Plateforme chrétienne
                </div>

                <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-[#161c35] sm:text-6xl lg:text-7xl font-display">
                  Crée tes groupes,
                  <br />
                  lance tes appels,
                  <br />
                  transmets ton enseignement.
                </h1>

                <p className="mt-8 max-w-2xl text-lg font-medium leading-relaxed text-[#4b556f] lg:text-xl">
                  Réunissez des croyants, organisez des appels en direct, animez des groupes d’étude
                  et proposez des formations chrétiennes gratuites ou payantes dans un environnement dédié.
                </p>

                <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap lg:justify-start">
                  <button
                    onClick={() => {
                      if (ensureAuth()) setShowCreateForm(true);
                    }}
                    className="h-14 rounded-full bg-[#161c35] px-8 text-sm font-black text-white shadow-[0_166px_34px_rgba(22,28,53,0.16)] transition hover:-translate-y-[1px]"
                  >
                    Créer un groupe ou une formation
                  </button>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Rechercher un groupe, une session ou une formation..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-14 w-full min-w-[260px] rounded-full border border-[#e8ebf1] bg-white px-12 text-sm font-medium text-[#101828] outline-none transition-all focus:border-[#c89f2d] focus:ring-4 focus:ring-[#c89f2d]/5"
                    />
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#98a2b3]" size={18} />
                  </div>
                </div>

                <div className="mt-10 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[#ece7db] bg-white/90 px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#c89f2d]">
                      Appels en direct
                    </div>
                    <p className="mt-2 text-sm font-medium text-[#667085]">
                      Lance des sessions de groupe et enseigne en temps réel.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#ece7db] bg-white/90 px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#c89f2d]">
                      Étude biblique
                    </div>
                    <p className="mt-2 text-sm font-medium text-[#667085]">
                      Prépare des rencontres autour de la Parole et de la prière.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#ece7db] bg-white/90 px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#c89f2d]">
                      Formations
                    </div>
                    <p className="mt-2 text-sm font-medium text-[#667085]">
                      Propose des parcours gratuits ou payants dans un cadre chrétien.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-6 py-16 sm:px-12 sm:py-20">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#98a2b3]">
                  Espaces disponibles
                </div>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-[#101828]">
                  Groupes, sessions et formations
                </h2>
              </div>
            </div>

            {showCreateForm && (
              <div className="mb-12 rounded-[32px] border border-dashed border-[#e8ebf1] bg-white p-8">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-2xl font-black">Créer un groupe ou une formation</h3>
                  <button onClick={() => setShowCreateForm(false)} className="opacity-50 hover:opacity-100">
                    <X size={24} />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest opacity-50">Nom</span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-12 rounded-2xl bg-gray-50 px-4 text-sm font-bold outline-none ring-offset-2 focus:ring-2 focus:ring-[#c89f2d]"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest opacity-50">Type</span>
                    <select
                      value={groupType}
                      onChange={(e) => setGroupType(e.target.value as CommunityGroupType)}
                      className="h-12 rounded-2xl bg-gray-50 px-4 text-sm font-bold outline-none"
                    >
                      {GROUP_TYPES.map(t => <option key={t} value={t}>{renderTypeLabel(t)}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest opacity-50">Accès</span>
                    <select
                      value={isPaid ? 'paid' : 'free'}
                      onChange={(e) => setIsPaid(e.target.value === 'paid')}
                      className="h-12 rounded-2xl bg-gray-50 px-4 text-sm font-bold outline-none"
                    >
                      <option value="free">Gratuit</option>
                      <option value="paid">Formation Payante</option>
                    </select>
                  </label>
                  {isPaid && (
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest opacity-50">Prix (FCFA)</span>
                      <input
                        type="number"
                        placeholder="Ex: 5000"
                        value={price || ''}
                        onChange={(e) => setPrice(Number(e.target.value))}
                        className="h-12 rounded-2xl bg-gray-50 px-4 text-sm font-bold outline-none ring-offset-2 focus:ring-2 focus:ring-[#c89f2d]"
                      />
                    </label>
                  )}
                  <label className="flex flex-col gap-2 lg:col-span-2">
                    <span className="text-xs font-bold uppercase tracking-widest opacity-50">Description</span>
                    <input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Décris l’objectif du groupe, de la session ou de la formation"
                      className="h-12 rounded-2xl bg-gray-50 px-4 text-sm font-bold outline-none"
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      onClick={onCreate}
                      disabled={createState === 'saving'}
                      className="h-12 w-full rounded-2xl bg-[#c89f2d] text-sm font-black text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {createState === 'saving' ? 'Création...' : 'Créer'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {status === 'loading' && (
                [1,2,3].map(i => <div key={i} className="h-[320px] animate-pulse rounded-[32px] bg-gray-100" />)
              )}
              
              {status === 'ready' && groups.length === 0 && (
                <div className="col-span-full py-20 text-center opacity-40">
                  <p className="text-xl font-bold">Aucun groupe ou formation n’est disponible pour le moment.</p>
                </div>
              )}

              {filteredGroups.map((group, i) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  index={i}
                  busy={!!actionState[group.id]}
                  onOpen={() => onSelectGroup(group.id)}
                  isCreator={group.created_by_device_id === actor.deviceId}
                  onDelete={() => {
                    setSelectedGroupId(group.id);
                    setShowDeleteConfirm(true);
                  }}
                  t={t}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {/* Feedback Toast */}
      {feedback ? (
        <div className="fixed bottom-24 left-1/2 z-[500] -translate-x-1/2 rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2 text-sm shadow-xl font-bold text-[#161c35]">
          {feedback}
        </div>
      ) : null}

      {/* GLOBAL GROUP DELETE CONFIRMATION */}
      {showDeleteConfirm && selectedGroup && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center p-4">
          <div className="w-full max-w-sm rounded-[32px] bg-white p-8 shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-black text-gray-900">Supprimer le groupe ?</h3>
              <p className="mt-2 text-sm text-gray-500 font-medium">
                Voulez-vous vraiment supprimer "{selectedGroup.name}" ?<br/>
                Cette action est irréversible.
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => {
                  onDeleteGroup(selectedGroup.id);
                  setShowDeleteConfirm(false);
                }}
                className="w-full rounded-2xl bg-rose-600 py-4 text-sm font-bold text-white shadow-lg active:scale-[0.97] transition-transform"
              >
                Oui, supprimer définitivement
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full rounded-2xl bg-gray-100 py-4 text-sm font-bold text-gray-600 active:scale-[0.97] transition-transform"
              >
                Non, garder le groupe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legacy Fullscreen Call (kept for compatibility) */}
      {callFullscreenOpen && selectedGroup ? (
        <div className="fixed inset-0 z-[90] bg-black/80 p-2 backdrop-blur-sm sm:p-4 md:pl-[90px]">
          <div className="mx-auto flex h-full w-full max-w-[1680px] flex-col gap-2">
            <div className="flex justify-end">
              <button
                type="button"
                className="btn-base rounded-full border border-white/25 bg-black/40 px-3 py-1.5 text-xs text-white"
                onClick={closeCallRoom}
              >
                {t('community.groups.callCloseFullscreen')}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-3xl">
              <CommunityGroupCall
                groupId={selectedGroup.id}
                deviceId={actor.deviceId}
                displayName={actor.displayName}
                userId={actor.userId}
                callId={currentCallId || null}
                callOwnerId={currentCallSession?.created_by || null}
                initialTasks={selectedGroup?.session_tasks || []}
                onClose={closeCallRoom}
              />
            </div>
          </div>
        </div>
      ) : null}

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}
