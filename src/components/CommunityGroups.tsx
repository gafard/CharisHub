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
  deleteGroup,
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
  actor: { deviceId: string; displayName: string; userId?: string | null };
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
  isGroupAdmin: (group: CommunityGroup, userId: string | null | undefined, deviceId: string) => boolean;
  currentUserStatus: CommunityGroupMemberStatus | null;
  onModerate: (userId: string | null | undefined, deviceId: string, action: 'approve' | 'reject') => void;
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
  const [activeTab, setActiveTab] = useState<'salon' | 'programme' | 'members' | 'about'>('salon');

  const isAdmin = isGroupAdmin(selectedGroup, actor.userId, actor.deviceId);
  const isCreator = (selectedGroup.user_id && selectedGroup.user_id === actor.userId) || (selectedGroup.created_by_device_id === actor.deviceId);
  const hasLiveCall = callParticipants.length > 0 || !!activeCallId;

  return (
    <div className="space-y-6">
      {/* 1. Header Workspace */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onCloseGroupPage}
            className="grid h-10 w-10 place-items-center rounded-xl border border-[#e6e8ec] bg-white text-[#667085] transition hover:text-[#101828] hover:border-[#d0d5dd]"
          >
            ←
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#c89f2d]">
                {renderTypeLabel(selectedGroup.group_type)}
              </span>
              {selectedGroup.is_paid && (
                <span className="h-1 w-1 rounded-full bg-[#cbd5e1]" />
              )}
              {selectedGroup.is_paid && (
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#b54708]">
                  FORMATION PAYANTE
                </span>
              )}
            </div>
            <h1 className="text-xl font-black tracking-tight text-[#101828] sm:text-2xl">
              {selectedGroup.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onShareGroup(selectedGroup.id)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#e6e8ec] bg-white px-4 text-xs font-bold text-[#667085] transition hover:text-[#101828]"
          >
            <Link2 size={14} />
            Partager l'espace
          </button>
        </div>
      </div>

      {/* 2. Bandeau Session / Live */}
      <div className="overflow-hidden rounded-[32px] border border-[#e9eaeb] bg-white shadow-[0_12px_30px_rgba(16,24,40,0.04)]">
        <div className="flex flex-col lg:flex-row lg:items-stretch">
          <div className="flex-1 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              {hasLiveCall ? (
                <div className="flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-rose-600">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                  Session en direct
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Prochaine session
                </div>
              )}
            </div>

            <h2 className="mt-4 text-2xl font-black tracking-tight text-[#101828]">
              {hasLiveCall ? "Rejoignez l'enseignement en cours" : (selectedGroup.next_call_at ? formatWhen(selectedGroup.next_call_at) : 'Aucun rendez-vous planifié')}
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#667085]">
              {hasLiveCall
                ? "Plusieurs membres sont déjà connectés. Entrez dans la salle pour participer à la session biblique."
                : "Consultez le déroulé de la session dans l'onglet Programme pour vous préparer."
              }
            </p>
          </div>

          <div className="flex flex-col justify-center border-t border-[#f2f4f7] bg-[#fcfcfd] p-6 lg:w-[280px] lg:border-l lg:border-t-0 sm:p-8">
            {isAdmin ? (
              <button
                type="button"
                onClick={() => void onStartGroupCall()}
                disabled={callBusy}
                className="w-full rounded-2xl bg-[#161c35] px-6 py-4 text-sm font-black text-white shadow-[0_12px_24px_rgba(22,28,53,0.15)] transition hover:translate-y-[-1px] disabled:opacity-60"
              >
                {callBusy ? <Loader2 size={16} className="animate-spin" /> : (hasLiveCall ? "Ouvrir la salle" : "Lancer la session")}
              </button>
            ) : (
              selectedGroup.joined ? (
                hasLiveCall ? (
                  <button
                    type="button"
                    onClick={onOpenCallRoom}
                    className="w-full rounded-2xl bg-rose-600 px-6 py-4 text-sm font-black text-white shadow-[0_12px_24px_rgba(244,63,94,0.15)] transition hover:translate-y-[-1px]"
                  >
                    Entrer dans la session
                  </button>
                ) : (
                  <div className="text-center text-xs font-bold text-[#98a2b3]">
                    En attente du lancement
                  </div>
                )
              ) : (
                <div className="text-center text-xs font-bold text-[#c89f2d]">
                  Rejoins l'espace pour participer
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* 3. Layout Principal 2 Colonnes */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        
        {/* Colonne GAUCHE (Main Content) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="overflow-hidden rounded-[32px] border border-[#e9eaeb] bg-white shadow-[0_12px_24px_rgba(16,24,40,0.03)]">
            <div className="flex border-b border-[#f2f4f7] bg-[#fcfcfd]/50">
              {[
                { key: 'salon', label: 'Salon' },
                { key: 'programme', label: 'Programme' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`relative px-8 py-4 text-xs font-black uppercase tracking-[0.14em] transition ${
                    activeTab === tab.key
                      ? 'text-[#161c35]'
                      : 'text-[#98a2b3] hover:text-[#667085]'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.key && (
                    <div className="absolute bottom-0 left-8 right-8 h-1 rounded-t-full bg-[#161c35]" />
                  )}
                </button>
              ))}
            </div>

            <div className="p-1 sm:p-4">
              {activeTab === 'salon' && (
                !selectedGroup.joined ? (
                  <div className="p-8 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f9fafb] text-2xl">
                      🔒
                    </div>
                    <h3 className="mt-4 font-black text-[#101828]">Salon réservé aux membres</h3>
                    <p className="mt-2 text-sm text-[#667085]">
                      Rejoignez cet espace pour participer aux échanges et poser vos questions.
                    </p>
                  </div>
                ) : (
                  currentUserStatus === 'pending' ? (
                    <div className="p-8 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#fffbeb] text-2xl">
                        ⏳
                      </div>
                      <h3 className="mt-4 font-black text-[#101828]">Demande en attente</h3>
                      <p className="mt-2 text-sm text-[#667085]">
                        Un administrateur doit valider votre accès au salon.
                      </p>
                    </div>
                  ) : (
                    <CommunityGroupChat groupId={selectedGroup.id} actor={actor} />
                  )
                )
              )}

              {activeTab === 'programme' && (
                <div className="p-4 sm:p-6 space-y-8">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#98a2b3]">Objectifs</div>
                    <h3 className="mt-2 text-lg font-black text-[#101828]">Déroulé de la session</h3>
                    <p className="mt-2 text-sm leading-7 text-[#667085]">
                      Voici les points clés qui seront abordés durant la rencontre.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {sessionTasks.length > 0 ? sessionTasks.map((task, idx) => (
                      <div key={idx} className="flex items-center gap-4 rounded-2xl border border-[#f2f4f7] bg-white p-4">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f8fafc] text-[11px] font-black text-[#161c35] border border-[#e2e8f0]">
                          {idx + 1}
                        </div>
                        <div className="flex-1 text-sm font-bold text-[#344054]">{task}</div>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setSessionTasks(prev => prev.filter((_, i) => i !== idx))}
                            className="text-[#98a2b3] hover:text-rose-500"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    )) : (
                      <div className="rounded-2xl border-2 border-dashed border-[#f2f4f7] p-8 text-center text-sm font-medium text-[#98a2b3]">
                        Aucun point inscrit au programme pour le moment.
                      </div>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="pt-4 border-t border-[#f2f4f7]">
                       <div className="flex gap-2">
                        <input
                          value={taskDraft}
                          onChange={(e) => setTaskDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && taskDraft.trim()) {
                              setSessionTasks(prev => [...prev, taskDraft.trim()]);
                              setTaskDraft('');
                            }
                          }}
                          placeholder="Ajouter un point au programme..."
                          className="h-11 flex-1 rounded-xl border border-[#e6e8ec] bg-[#fcfcfd] px-4 text-sm font-medium text-[#101828] outline-none focus:border-[#161c35]"
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
                          className="h-11 rounded-xl bg-[#161c35] px-4 text-xs font-black uppercase tracking-[0.1em] text-white disabled:opacity-40"
                        >
                          Ajouter
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Colonne DROITE (Sidebar) */}
        <div className="space-y-6">
          {/* Section Rejoindre si non membre */}
          {!selectedGroup.joined && (
             <div className="rounded-[32px] border border-[#e9eaeb] bg-white p-6 shadow-[0_12px_24px_rgba(16,24,40,0.03)]">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#c89f2d]">Accès</div>
                <h3 className="mt-2 text-lg font-black text-[#101828]">Rejoindre l'espace</h3>
                
                {selectedGroup.is_paid && (
                  <div className="mt-4 space-y-3">
                    <p className="text-xs font-bold text-[#b54708]">Clé requise pour cette formation</p>
                    <input
                      type="text"
                      placeholder="CHARIS-XXXXX"
                      value={passCodeInput}
                      onChange={(e) => setPassCodeInput(e.target.value.toUpperCase())}
                      className="w-full rounded-xl border border-[#fedf89] bg-[#fffcf5] px-4 py-3 text-sm font-bold text-[#101828] outline-none"
                    />
                  </div>
                )}

                <button
                  onClick={() => onJoin(selectedGroup.id, passCodeInput)}
                  disabled={!!actionState[selectedGroup.id]}
                  className="mt-6 w-full rounded-2xl bg-[#161c35] py-4 text-sm font-black text-white transition hover:-translate-y-[1px]"
                >
                  {selectedGroup.is_paid ? "Valider mon code" : "Rejoindre l'espace"}
                </button>
             </div>
          )}

          {/* Section Présentation */}
          <div className="rounded-[32px] border border-[#e9eaeb] bg-white p-6 shadow-[0_12px_24px_rgba(16,24,40,0.03)]">
            <div className="flex border-b border-[#f2f4f7] -mx-6 px-6 pb-2 mb-4">
              {[
                { key: 'about', label: 'Présentation' },
                { key: 'members', label: 'Membres' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`mr-4 pb-2 text-[10px] font-black uppercase tracking-[0.14em] transition ${
                    (activeTab === tab.key || (activeTab === 'salon' && tab.key === 'about') || (activeTab === 'programme' && tab.key === 'about'))
                    ? 'text-[#161c35] border-b-2 border-[#161c35]' 
                    : 'text-[#98a2b3]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'members' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#667085]">
                  <span>{groupMembers.length} Personnes</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {groupMembers.map((member) => (
                    <div key={member.device_id} className="flex items-center gap-3 p-2 rounded-xl border border-[#f9fafb] bg-[#fcfcfd]">
                      <div className="h-8 w-8 shrink-0 rounded-lg bg-[#161c35] text-[10px] font-black text-white flex items-center justify-center">
                        {initials(member.display_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold text-[#101828]">{member.display_name}</div>
                        {selectedGroup.admin_ids?.some(id => id === member.user_id || id === member.device_id) && (
                          <div className="text-[9px] font-black text-[#c89f2d] uppercase">Administrateur</div>
                        )}
                      </div>
                      {isAdmin && member.status === 'pending' && member.device_id !== actor.deviceId && (
                        <button 
                          onClick={() => onModerate(member.user_id, member.device_id, 'approve')}
                          className="h-6 w-6 rounded-md bg-emerald-50 text-emerald-600 grid place-items-center hover:bg-emerald-100"
                        >
                          ✓
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {isAdmin ? (
                  <textarea
                    value={detailDescription}
                    onChange={(e) => setDetailDescription(e.target.value)}
                    rows={6}
                    className="w-full resize-none rounded-2xl border border-[#e6e8ec] bg-[#fcfcfd] p-4 text-sm font-medium text-[#475467] outline-none focus:border-[#161c35]"
                    placeholder="Présente l'espace de formation..."
                  />
                ) : (
                  <p className="text-sm leading-7 text-[#667085]">
                     {selectedGroup.description || "Cet espace n'a pas encore de présentation officielle."}
                  </p>
                )}
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[9px] font-black text-[#98a2b3] uppercase">Créé par</div>
                    <div className="mt-1 text-xs font-bold text-[#161c35] truncate">{selectedGroup.created_by_name}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[9px] font-black text-[#98a2b3] uppercase">Membres</div>
                    <div className="mt-1 text-xs font-bold text-[#161c35]">{selectedGroup.members_count} actifs</div>
                  </div>
                </div>

                {isAdmin && (
                  <button
                    onClick={onSaveGroupSettings}
                    disabled={savingGroupState}
                    className="w-full rounded-2xl bg-[#161c35] py-3 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:-translate-y-[1px]"
                  >
                    {savingGroupState ? "Mise à jour..." : "Enregistrer les modifications"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Pilotage Admin (Date & Provider) */}
          {isAdmin && (
            <div className="rounded-[32px] border border-[#e9eaeb] bg-white p-6 shadow-[0_12px_24px_rgba(16,24,40,0.03)]">
               <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#c89f2d]">Pilotage</div>
               <h3 className="mt-2 text-lg font-black text-[#101828]">Gestion des sessions</h3>
               
               <div className="mt-4 space-y-4">
                  <label>
                    <span className="block text-[10px] font-black uppercase text-[#98a2b3] mb-1">Date & Heure</span>
                    <input 
                      type="datetime-local"
                      value={detailNextCallAt}
                      onChange={(e) => setDetailNextCallAt(e.target.value)}
                      className="w-full rounded-xl border border-[#e6e8ec] bg-[#fcfcfd] px-4 py-3 text-xs font-bold text-[#101828]"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    {(['google_meet', 'facetime', 'skype', 'other'] as CommunityCallProvider[]).map((prov) => (
                      <button
                        key={prov}
                        type="button"
                        onClick={() => setDetailCallProvider(prov)}
                        className={`rounded-xl py-2.5 text-[9px] font-black uppercase tracking-wider transition ${
                          detailCallProvider === prov
                            ? 'bg-[#161c35] text-white shadow-md'
                            : 'bg-slate-50 text-slate-400 border border-slate-100 hover:border-slate-300'
                        }`}
                      >
                        {prov.replace('_', ' ')}
                      </button>
                    ))}
                  </div>

                  <input
                    value={detailCallLink}
                    onChange={(e) => setDetailCallLink(e.target.value)}
                    placeholder="Lien d'appel direct (optionnel)"
                    className="w-full rounded-xl border border-[#e6e8ec] bg-[#fcfcfd] px-4 py-3 text-xs font-bold text-[#101828]"
                  />
               </div>
            </div>
          )}

          {/* Zone de danger / Actions secondaires */}
          <div className="rounded-[32px] border border-[#e9eaeb] bg-white p-4 shadow-[0_12px_24px_rgba(16,24,40,0.03)]">
             {selectedGroup.joined && (
               <button
                 onClick={() => onLeave(selectedGroup.id)}
                 className="flex w-full items-center justify-between p-2 text-xs font-black uppercase tracking-wider text-[#667085] hover:text-rose-600 transition"
               >
                 Quitter cet espace
                 <span>→</span>
               </button>
             )}
             
             {isCreator && (
               <button
                 onClick={() => setShowDeleteConfirm(true)}
                 className="mt-2 flex w-full items-center justify-between p-2 text-xs font-black uppercase tracking-wider text-rose-400 hover:text-rose-600 transition"
               >
                 Supprimer l'espace
                 <Trash2 size={14} />
               </button>
             )}
          </div>
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

  const visibleGroups = useMemo(() => {
    if (listMode === 'joined') return joinedGroups;
    if (listMode === 'discover') return otherGroups;
    return filteredGroups;
  }, [listMode, joinedGroups, otherGroups, filteredGroups]);
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
    async (memberUserId: string | null | undefined, memberDeviceId: string, action: 'approve' | 'reject') => {
      if (!selectedGroup) return;
      try {
        await moderateGroupMember(selectedGroup.id, memberUserId, memberDeviceId, action);
        await loadGroupMembers(selectedGroup.id);
        const list = await fetchGroups(60, actor.userId || undefined);
        setGroups(list);
        setFeedback(action === 'approve' ? 'Membre approuvé' : 'Membre refusé');
      } catch (e) {
        console.error('Moderation failed', e);
        setFeedback('Échec de la modération');
      }
    },
    [selectedGroup, loadGroupMembers, actor.userId]
  );

  const isGroupAdmin = useCallback((group: CommunityGroup, userId: string | null | undefined, deviceId: string) => {
    if (userId && group.user_id === userId) return true;
    if (group.created_by_device_id === deviceId) return true;
    return !!(group.admin_ids && (
      (userId && group.admin_ids.includes(userId)) || 
      group.admin_ids.includes(deviceId)
    ));
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
      if (!actor.userId) throw new Error('Authentification requise.');
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
    if (!actor.userId) return;
    const group = groups.find(g => g.id === groupId);
    
    if (group?.is_paid && (!code || code.trim().toUpperCase() !== group.pass_code?.trim().toUpperCase())) {
      if (!code) {
        setFeedback("Ce groupe est une formation payante. Veuillez entrer votre clé d'accès.");
      } else {
        setFeedback("Clé d'accès incorrecte. Veuillez vérifier votre code de formation.");
      }
      return;
    }

    if (!actor.userId) return;
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
    if (!actor.userId) return;
    setActionState((prev) => ({ ...prev, [groupId]: true }));
    try {
      await leaveGroup(groupId, actor.userId);
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
    if (!actor.userId) return;
    setSavingGroupState(true);
    try {
      await updateGroup(selectedGroup.id, actor.userId, {
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

  const onPromoteAdmin = async (memberUserId: string) => {
    if (!selectedGroup || !actor.userId || !isGroupAdmin(selectedGroup, actor.userId, actor.deviceId)) return;
    setActionState((prev) => ({ ...prev, [`promote-${memberUserId}`]: true }));
    try {
      const newAdminIds = [...(selectedGroup.admin_ids || []), memberUserId];
      await updateGroup(selectedGroup.id, actor.userId, { admin_ids: newAdminIds });
      setFeedback(t('community.groups.adminPromoted'));
      await loadGroups(); // Refresh groups to get updated admin_ids
      await loadGroupMembers(selectedGroup.id); // Refresh members list
    } catch {
      setFeedback(t('community.groups.actionError'));
    } finally {
      setActionState((prev) => ({ ...prev, [`promote-${memberUserId}`]: false }));
    }
  };

  const onDeleteGroup = async (groupId: string) => {
    if (!actor.userId) return;
    setActionState((prev) => ({ ...prev, [groupId]: true }));
    try {
      await deleteGroup(groupId, actor.userId);
      setFeedback(t('community.groups.deleted'));
      setSelectedGroupId('');
      updateGroupQuery('');
      await loadGroups();
    } catch {
      setFeedback(t('community.groups.actionError'));
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
                  Réunissez des croyants, organisez des appels en direct, animez des groupes d'étude
                  et proposez des formations chrétiennes gratuites ou payantes dans un environnement dédié.
                </p>

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

          <section className="mx-auto max-w-7xl px-6 py-10 sm:px-12">
            {/* Toolbar de pilotage */}
            <div className="mb-10 rounded-[32px] border border-[#ebeef3] bg-white p-4 shadow-[0_14px_36px_rgba(16,24,40,0.06)] sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="relative w-full lg:max-w-md">
                    <input
                      type="text"
                      placeholder="Rechercher un groupe, une session ou une formation..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-12 w-full rounded-2xl border border-[#e6e8ec] bg-[#fcfcfd] px-11 text-sm font-medium text-[#101828] outline-none transition focus:border-[#c89f2d] focus:ring-4 focus:ring-[#c89f2d]/5"
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#98a2b3]" size={16} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setListMode('all')}
                      className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${
                        listMode === 'all'
                          ? 'bg-[#161c35] text-white shadow-[0_10px_24px_rgba(22,28,53,0.14)]'
                          : 'border border-[#e6e8ec] bg-white text-[#667085] hover:text-[#101828]'
                      }`}
                    >
                      Tous
                    </button>

                    <button
                      type="button"
                      onClick={() => setListMode('joined')}
                      className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${
                        listMode === 'joined'
                          ? 'bg-[#161c35] text-white shadow-[0_10px_24px_rgba(22,28,53,0.14)]'
                          : 'border border-[#e6e8ec] bg-white text-[#667085] hover:text-[#101828]'
                      }`}
                    >
                      Mes groupes
                    </button>

                    <button
                      type="button"
                      onClick={() => setListMode('discover')}
                      className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${
                        listMode === 'discover'
                          ? 'bg-[#161c35] text-white shadow-[0_10px_24px_rgba(22,28,53,0.14)]'
                          : 'border border-[#e6e8ec] bg-white text-[#667085] hover:text-[#101828]'
                      }`}
                    >
                      Découvrir
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 lg:justify-end">
                  <div className="text-sm font-bold text-[#667085]">
                    {listMode === 'all' && `${visibleGroups.length} espace(s)`}
                    {listMode === 'joined' && `${visibleGroups.length} groupe(s) rejoint(s)`}
                    {listMode === 'discover' && `${visibleGroups.length} à découvrir`}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (ensureAuth()) setShowCreateForm(true);
                    }}
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-[#c89f2d] px-6 text-sm font-black text-white shadow-[0_14px_32px_rgba(200,159,45,0.22)] transition hover:-translate-y-[1px]"
                  >
                    <PlusCircle size={18} />
                    Créer
                  </button>
                </div>
              </div>
            </div>

            {/* Formulaire de création premium */}
            {showCreateForm && (
              <div className="mb-12 overflow-hidden rounded-[36px] border border-[#ebeef3] bg-white shadow-[0_24px_60px_rgba(16,24,40,0.08)]">
                <div className="border-b border-[#eef1f5] bg-[linear-gradient(180deg,#fffdf8,white)] px-6 py-6 sm:px-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#c89f2d]">
                        Nouvel espace
                      </div>
                      <h3 className="mt-2 text-2xl font-black tracking-tight text-[#101828]">
                        Créer un groupe ou une formation
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-[#667085]">
                        Lance un espace pour enseigner, organiser des appels, accompagner un groupe
                        ou proposer une formation chrétienne gratuite ou payante.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="grid h-11 w-11 place-items-center rounded-2xl border border-[#e7eaf0] bg-white text-[#667085] transition hover:text-[#101828]"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="px-6 py-6 sm:px-8 sm:py-8">
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#98a2b3]">
                        Nom de l'espace
                      </span>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Formation sur l'identité en Christ"
                        className="h-13 rounded-2xl border border-[#e6e8ec] bg-[#fcfcfd] px-4 text-sm font-semibold text-[#101828] outline-none transition focus:border-[#c89f2d] focus:ring-4 focus:ring-[#c89f2d]/5"
                      />
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#98a2b3]">
                        Type
                      </span>
                      <select
                        value={groupType}
                        onChange={(e) => setGroupType(e.target.value as CommunityGroupType)}
                        className="h-13 rounded-2xl border border-[#e6e8ec] bg-[#fcfcfd] px-4 text-sm font-semibold text-[#101828] outline-none transition focus:border-[#c89f2d] focus:ring-4 focus:ring-[#c89f2d]/5"
                      >
                        {GROUP_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {renderTypeLabel(type)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-2 lg:col-span-2">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#98a2b3]">
                        Description
                      </span>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Décris l'objectif du groupe, le public visé, le type de rencontres ou la formation proposée..."
                        rows={4}
                        className="rounded-2xl border border-[#e6e8ec] bg-[#fcfcfd] px-4 py-3 text-sm font-medium leading-7 text-[#101828] outline-none transition focus:border-[#c89f2d] focus:ring-4 focus:ring-[#c89f2d]/5"
                      />
                    </label>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
                    <label className="flex flex-col gap-2">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#98a2b3]">
                        Accès
                      </span>
                      <select
                        value={isPaid ? 'paid' : 'free'}
                        onChange={(e) => setIsPaid(e.target.value === 'paid')}
                        className="h-13 rounded-2xl border border-[#e6e8ec] bg-[#fcfcfd] px-4 text-sm font-semibold text-[#101828] outline-none transition focus:border-[#c89f2d] focus:ring-4 focus:ring-[#c89f2d]/5"
                      >
                        <option value="free">Gratuit</option>
                        <option value="paid">Payant</option>
                      </select>
                    </label>

                    {isPaid ? (
                      <label className="flex flex-col gap-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#98a2b3]">
                          Prix
                        </span>
                        <input
                          type="number"
                          value={price || ''}
                          onChange={(e) => setPrice(Number(e.target.value))}
                          placeholder="Ex: 5000"
                          className="h-13 rounded-2xl border border-[#e6e8ec] bg-[#fcfcfd] px-4 text-sm font-semibold text-[#101828] outline-none transition focus:border-[#c89f2d] focus:ring-4 focus:ring-[#c89f2d]/5"
                        />
                      </label>
                    ) : (
                      <div className="rounded-2xl border border-[#e6e8ec] bg-[#fcfcfd] px-4 py-3">
                        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#98a2b3]">
                          Tarification
                        </div>
                        <div className="mt-1 text-sm font-bold text-[#101828]">Accès libre</div>
                      </div>
                    )}

                    <label className="flex flex-col gap-2">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#98a2b3]">
                        Prochaine rencontre
                      </span>
                      <input
                        type="datetime-local"
                        value={nextCallAt}
                        onChange={(e) => setNextCallAt(e.target.value)}
                        className="h-13 rounded-2xl border border-[#e6e8ec] bg-[#fcfcfd] px-4 text-sm font-semibold text-[#101828] outline-none transition focus:border-[#c89f2d] focus:ring-4 focus:ring-[#c89f2d]/5"
                      />
                    </label>
                  </div>

                  <div className="mt-8 flex flex-col gap-3 border-t border-[#eef1f5] pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <p className="max-w-xl text-sm leading-7 text-[#667085]">
                      Une fois créé, tu pourras gérer les membres, planifier les appels, partager le lien
                      et organiser le programme de tes sessions.
                    </p>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowCreateForm(false)}
                        className="h-12 rounded-full border border-[#e6e8ec] bg-white px-6 text-sm font-bold text-[#475467] transition hover:text-[#101828]"
                      >
                        Annuler
                      </button>

                      <button
                        type="button"
                        onClick={onCreate}
                        disabled={createState === 'saving'}
                        className="inline-flex h-12 items-center gap-2 rounded-full bg-[#161c35] px-7 text-sm font-black text-white shadow-[0_16px_34px_rgba(22,28,53,0.16)] transition hover:-translate-y-[1px] disabled:opacity-60"
                      >
                        {createState === 'saving' ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Création...
                          </>
                        ) : (
                          <>
                            <PlusCircle size={16} />
                            Créer l'espace
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Grille des groupes */}
            <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#98a2b3]">
                  Espaces disponibles
                </div>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-[#101828]">
                  Groupes, appels et formations
                </h2>
              </div>

              <div className="text-sm font-semibold text-[#667085]">
                {visibleGroups.length} résultat(s)
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
              {status === 'loading' &&
                [1, 2, 3].map((i) => (
                  <div key={i} className="h-[320px] animate-pulse rounded-[32px] bg-gray-100" />
                ))}

              {status === 'ready' && visibleGroups.length === 0 && (
                <div className="col-span-full rounded-[32px] border border-dashed border-[#dfe3ea] bg-[#fcfcfd] py-20 text-center">
                  <p className="text-xl font-black text-[#101828]">
                    Aucun espace ne correspond à votre recherche.
                  </p>
                  <p className="mt-3 text-sm font-medium text-[#667085]">
                    Essaie un autre mot-clé ou crée un nouveau groupe.
                  </p>
                </div>
              )}

              {visibleGroups.map((group, i) => (
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
