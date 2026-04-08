'use client';

import logger from '@/lib/logger';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  CameraOff,
  Hand,
  MessageSquareText,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  Send,
  Sparkles,
  Users,
  BookOpen,
  ChevronLeft,
  Link2,
  Circle,
  Square,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import BibleReader from './BibleReader';
import InterlinearViewer from './InterlinearViewer';
import BibleStrongViewer from './BibleStrongViewer';
import { getWebRtcIceServers } from '../lib/webrtc';
import { useI18n } from '../contexts/I18nContext';
import VerseOverlay from './bible/VerseOverlay';
import {
  activateGroupCallSession,
  clearGroupCallPresence,
  endGroupCallSession,
  logGroupCallEvent,
  respondToGroupCallInvitation,
  upsertGroupCallPresence,
} from './communityApi';
import { BIBLE_BOOKS } from '../lib/bibleCatalog';
import { releaseAudioFocus } from '../lib/audioFocus';

type PeerMeta = {
  peerId: string;
  displayName: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
};

type RemotePeer = PeerMeta & {
  stream: MediaStream | null;
  handRaised?: boolean;
};

type JoinMode = 'video' | 'audio';
type ChatTab = 'chat' | 'participants' | 'bible';
type ViewMode = 'grid' | 'speaker' | 'bible';
type ShareViewMode = 'fit' | 'fill';
type NetworkQuality = 'excellent' | 'good' | 'fair' | 'weak' | 'offline';

type CallParticipant = {
  peerId: string;
  displayName: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  stream: MediaStream | null;
  isLocal: boolean;
  handRaised?: boolean;
};

type ChatMessage = {
  id: string;
  peerId: string;
  displayName: string;
  text: string;
  createdAt: string;
  mine: boolean;
};

type PresenceStatePayload = {
  peerId?: string;
  displayName?: string;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  joinedAt?: string;
  handRaised?: boolean;
};

type SignalPayload =
  | {
      from: string;
      to: string;
      type: 'offer' | 'answer';
      signal: RTCSessionDescriptionInit;
    }
  | {
      from: string;
      to: string;
      type: 'ice-candidate';
      signal: RTCIceCandidateInit;
    };

type UiSyncPayload =
  | { type: 'hand'; peerId: string; active: boolean }
  | { type: 'screen-share'; peerId: string; active: boolean }
  | { type: 'bible.sync'; peerId: string; reference: string | null; content: string | null; metadata?: { bookId: string; chapter: number; verse: number } }
  | { type: 'speaker.authorizations'; peerIds: string[] }
  | { type: 'call.ended'; peerId: string; callId?: string | null };

type RoomChatPayload = {
  message: ChatMessage;
};

const ICE_SERVERS = getWebRtcIceServers();
const CALL_BIBLE_SETTINGS_KEY = 'formation_biblique_bible_settings_v1';

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

function initials(name: string) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] || 'I';
  const second = words[1]?.[0] || words[0]?.[1] || 'N';
  return `${first}${second}`.toUpperCase();
}

function isPeerShowingVideo(participant: CallParticipant | null) {
  if (!participant || !participant.videoEnabled) return false;
  return (participant.stream?.getVideoTracks().length ?? 0) > 0;
}

function ParticipantThumb({
  participant,
  active,
  speaking,
  networkQuality: peerQuality,
  onClick,
}: {
  participant: CallParticipant;
  active: boolean;
  speaking: boolean;
  networkQuality?: NetworkQuality;
  onClick: () => void;
}) {
  const showVideo = isPeerShowingVideo(participant);
  const name = participant.displayName || 'Invite';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-[180px] w-full min-w-[200px] flex-1 overflow-hidden rounded-[24px] border transition-all duration-300 ${
        active 
          ? 'border-[#D4FF33] ring-1 ring-[#D4FF33]/30 shadow-lg' 
          : 'border-white/10 bg-white/5 hover:border-white/20'
      }`}
    >
      <video
        autoPlay
        playsInline
        muted={participant.isLocal}
        className={`h-full w-full object-cover transition-opacity duration-500 ${showVideo ? 'opacity-100' : 'opacity-0'}`}
        ref={(element) => {
          if (!element || !participant.stream) return;
          if (element.srcObject !== participant.stream) {
            element.srcObject = participant.stream;
          }
        }}
      />
      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-black">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 font-bold text-white shadow-xl">
            {initials(name)}
          </div>
        </div>
      )}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 backdrop-blur-md ring-1 ring-white/10">
        <div className={`h-1.5 w-1.5 rounded-full ${participant.audioEnabled ? 'bg-emerald-400' : 'bg-rose-500'}`} />
        <span className="text-[10px] font-bold text-white/90">{name}</span>
      </div>
      {/* === FONCTIONNALITÉ 3: INDICATEUR QUALITÉ RÉSEAU === */}
      {peerQuality && peerQuality !== 'excellent' && (
        <div className={`absolute right-3 bottom-3 flex items-center gap-1 rounded-full px-2 py-0.5 backdrop-blur-md ring-1 ring-white/10 ${
          peerQuality === 'good' ? 'bg-emerald-500/80' :
          peerQuality === 'fair' ? 'bg-amber-500/80' :
          peerQuality === 'weak' ? 'bg-orange-500/80' :
          'bg-red-500/80'
        }`}>
          <div className={`h-1.5 w-1.5 rounded-full ${
            peerQuality === 'good' ? 'bg-white' :
            peerQuality === 'fair' ? 'bg-white' :
            peerQuality === 'weak' ? 'bg-white' :
            'bg-white animate-pulse'
          }`} />
          <span className="text-[8px] font-black text-white uppercase">
            {peerQuality === 'good' ? 'Bon' :
             peerQuality === 'fair' ? 'Moyen' :
             peerQuality === 'weak' ? 'Faible' :
             'Hors ligne'}
          </span>
        </div>
      )}
      {speaking && (
        <div className="absolute right-3 top-3 animate-pulse text-[#D4FF33]">
          <Mic size={14} />
        </div>
      )}
    </button>
  );
}

function StageVideo({
  participant,
  speaking,
  screenSharing,
  shareViewMode,
  localAudioEnabled,
  localVideoEnabled,
  localScreenSharing,
  handRaised,
  isRecording,
  onToggleAudio,
  onToggleVideo,
  onToggleShare,
  onToggleHand,
  onStartRecording,
  onStopRecording,
  onLeave,
  isLocalHost,
  isPip,
}: {
  participant: CallParticipant | null;
  speaking: boolean;
  screenSharing: boolean;
  shareViewMode: ShareViewMode;
  localAudioEnabled: boolean;
  localVideoEnabled: boolean;
  localScreenSharing: boolean;
  handRaised: boolean;
  isRecording: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleShare: () => void;
  onToggleHand: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onLeave: () => void;
  isLocalHost: boolean;
  isPip?: boolean;
}) {
  const showVideo = isPeerShowingVideo(participant);
  const name = participant?.displayName || 'Invite';
  const objectModeClass = screenSharing && shareViewMode === 'fit' ? 'object-contain' : 'object-cover';

  if (isPip) {
    return (
      <div className="absolute bottom-6 right-6 z-[60] h-48 w-48 overflow-hidden rounded-[24px] border border-white/20 bg-slate-900 shadow-2xl ring-1 ring-white/10">
        <video
          autoPlay
          playsInline
          muted={participant?.isLocal}
          className={`h-full w-full object-cover ${showVideo ? 'opacity-100' : 'opacity-0'}`}
          ref={(element) => {
            if (!element || !participant?.stream) return;
            if (element.srcObject !== participant.stream) {
              element.srcObject = participant.stream;
            }
          }}
        />
        {!showVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0c14]">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 font-bold text-white">
              {initials(name)}
            </div>
          </div>
        )}
        <div className="absolute bottom-2 left-2 rounded-full bg-black/40 px-2 py-0.5 text-[8px] font-bold text-white/90 backdrop-blur-md">
          {name} (Présentateur)
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/60 shadow-2xl transition-all duration-500">
      <video
        autoPlay
        playsInline
        muted={participant?.isLocal}
        className={`absolute inset-0 h-full w-full ${objectModeClass} ${showVideo ? 'opacity-100' : 'opacity-0'}`}
        ref={(element) => {
          if (!element || !participant?.stream) return;
          if (element.srcObject !== participant.stream) {
            element.srcObject = participant.stream;
          }
        }}
      />
      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0c14]">
          <div className="flex h-32 w-32 items-center justify-center rounded-full border border-white/10 bg-white/5 text-3xl font-black text-white/90 shadow-2xl backdrop-blur-3xl">
            {initials(name)}
          </div>
        </div>
      )}

      {/* Internal Floating Action Bar */}
      {isLocalHost && (
        <div className="absolute bottom-4 md:bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-2 md:gap-4 rounded-[32px] md:rounded-[40px] bg-black/60 p-2 backdrop-blur-3xl ring-1 ring-white/10 max-w-[95vw] sm:max-w-none">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleAudio(); }}
            className={`flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full transition-all ${
              localAudioEnabled ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-[#D4FF33] text-black shadow-[0_0_15px_rgba(212,255,51,0.3)]'
            }`}
          >
            {localAudioEnabled ? <Mic size={18} className="md:w-[20px]" /> : <MicOff size={18} className="md:w-[20px]" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleVideo(); }}
            className={`flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full transition-all ${
              localVideoEnabled ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-[#D4FF33] text-black shadow-[0_0_15px_rgba(212,255,51,0.3)]'
            }`}
          >
            {localVideoEnabled ? <Camera size={18} className="md:w-[20px]" /> : <CameraOff size={18} className="md:w-[20px]" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleHand(); }}
            className={`flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full transition-all ${
              handRaised ? 'bg-[#D4FF33] text-black shadow-[0_0_15px_rgba(212,255,51,0.3)]' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title={handRaised ? 'Baisser la main' : 'Lever la main'}
          >
            <Hand size={18} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleShare(); }}
            className={`hidden sm:flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full transition-all ${
              localScreenSharing ? 'bg-[#D4FF33] text-black shadow-[0_0_15px_rgba(212,255,51,0.3)]' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <ScreenShare size={18} className="md:w-[20px]" />
          </button>
          {/* === BOUTON ENREGISTREMENT (Visible uniquement sur plus grands écrans ou avec scroll sur mobile) === */}
          <button
            onClick={(e) => { e.stopPropagation(); isRecording ? onStopRecording() : onStartRecording(); }}
            className={`flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full transition-all ${
              isRecording ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title={isRecording ? 'Arrêter l\'enregistrement' : 'Démarrer l\'enregistrement'}
          >
            {isRecording ? <Square size={16} className="md:w-[18px]" /> : <Circle size={16} className="md:w-[18px]" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onLeave(); }}
            className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-rose-500 text-white shadow-xl hover:bg-rose-600 active:scale-95 transition-all"
          >
            <Phone size={18} className="rotate-[135deg] md:w-[20px]" />
          </button>
        </div>
      )}

      {/* Floating Meta Labels */}
      <div className="absolute left-4 top-4 md:left-6 md:top-6 flex flex-wrap items-center gap-2 md:gap-3">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-3 py-1.5 md:px-4 md:py-2 backdrop-blur-xl ring-1 ring-white/5">
          {participant?.isLocal && (
             <div className="h-5 w-5 md:h-6 md:w-6 overflow-hidden rounded-full border border-white/20 bg-white/10">
               <div className="flex h-full w-full items-center justify-center text-[7px] md:text-[8px] font-black">{initials(name)}</div>
             </div>
          )}
          <span className="text-[10px] md:text-xs font-bold text-white/90 truncate max-w-[80px] md:max-w-none">{name}</span>
        </div>
        {speaking && (
           <div className="flex items-center gap-1.5 md:gap-2 rounded-full bg-[#D4FF33] px-2 py-0.5 md:px-3 md:py-1 text-[8px] md:text-[9px] font-black uppercase tracking-wider text-black">
             <Mic size={9} className="md:w-[10px]" /> <span className="hidden xs:inline">EN PAROLE</span>
           </div>
        )}
        {participant?.handRaised && (
          <div className="flex items-center gap-1.5 md:gap-2 rounded-full bg-amber-400 px-2 py-0.5 md:px-3 md:py-1 text-[8px] md:text-[9px] font-black uppercase tracking-wider text-black">
            <Hand size={9} className="md:w-[10px]" /> <span className="hidden xs:inline">MAIN LEVÉE</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommunityGroupCall({
  groupId,
  deviceId,
  displayName,
  callId,
  callOwnerId,
  onClose,
  initialTasks = [],
  userId,
}: {
  groupId: string;
  deviceId: string;
  displayName: string;
  callId?: string | null;
  callOwnerId?: string | null;
  onClose?: () => void;
  initialTasks?: string[];
  userId?: string | null;
}) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const queryCallId = searchParams.get('call') || '';
  const autoJoinRequested = searchParams.get('autoJoin') === 'true';
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(false);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(true);
  const [localScreenSharing, setLocalScreenSharing] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'programme' | 'chat'>('programme');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activePeerId, setActivePeerId] = useState('local');
  const [speakingPeerId, setSpeakingPeerId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sharedBibleRef, setSharedBibleRef] = useState<string | null>(null);
  const [sharedBibleContent, setSharedBibleContent] = useState<string | null>(null);
  const [shareViewMode, setShareViewMode] = useState<ShareViewMode>('fit');
  const [screenSharePeerId, setScreenSharePeerId] = useState<string | null>(null);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [authorizedSpeakers, setAuthorizedSpeakers] = useState<Set<string>>(new Set());
  const [sharedBibleMetadata, setSharedBibleMetadata] = useState<{ bookId: string; chapter: number; verse: number } | undefined>(undefined);
  const [showInterlinear, setShowInterlinear] = useState(false);
  const [showStrongViewer, setShowStrongViewer] = useState(false);
  const [currentStrongNumber, setCurrentStrongNumber] = useState<string | null>(null);

  // === NOUVELLES FONCTIONNALITÉS ===
  // 1. Chronomètre d'appel
  const [callDurationSec, setCallDurationSec] = useState(0);

  // 3. Indicateur qualité réseau
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>('good');
  const [peerNetworkQuality, setPeerNetworkQuality] = useState<Map<string, NetworkQuality>>(new Map());

  // 5. Sondages
  const [activePoll, setActivePoll] = useState<{ id: string; question: string; options: string[]; votes: Map<number, string[]>; closed: boolean } | null>(null);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollDraftQuestion, setPollDraftQuestion] = useState('');
  const [pollDraftOptions, setPollDraftOptions] = useState(['', '']);

  // 6. Enregistrement
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [sessionTasks, setSessionTasks] = useState(() => {
    if (initialTasks && initialTasks.length > 0) {
      return initialTasks.map((t, i) => ({
        id: `task-${i}`,
        text: t,
        done: false,
        active: i === 0
      }));
    }
    return [
      { id: '1', text: 'Communion & Accueil', done: true, active: false },
      { id: '2', text: 'Lecture collective du passage', done: false, active: true },
      { id: '3', text: 'Méditation & Partage', done: false, active: false },
      { id: '4', text: 'Questions / Réponses', done: false, active: false },
      { id: '5', text: 'Prière finale', done: false, active: false }
    ];
  });

  const activeTask = useMemo(() => sessionTasks.find(t => t.active) || sessionTasks[0], [sessionTasks]);

  const channelRef = useRef<any>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenShareStreamRef = useRef<MediaStream | null>(null);
  const joinedAtRef = useRef('');
  const lastBibleSyncRef = useRef<{ reference: string | null; content: string | null }>({
    reference: null,
    content: null,
  });
  const suppressBibleSyncBroadcastRef = useRef(false);
  const leaveCallRef = useRef<((options?: { close?: boolean; endSession?: boolean; notifyEnded?: boolean }) => Promise<void>) | null>(null);
  const autoJoinAttemptedRef = useRef(false);
  
  // === REFS POUR RECONNEXION (Fonctionnalité 2) ===
  const reconnectAttemptsRef = useRef<Map<string, number>>(new Map());
  const reconnectTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // === REFS POUR QUALITÉ RÉSEAU (Fonctionnalité 3) ===
  const networkStatsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // === REFS POUR CHRONOMÈTRE (Fonctionnalité 1) ===
  const callDurationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const resolvedCallId = callId || queryCallId || null;
  const isCallOwner = !!resolvedCallId && !!deviceId && callOwnerId === deviceId;

  const participants = useMemo<CallParticipant[]>(() => {
    const local = {
      peerId: 'local',
      displayName: t('community.groups.callYou'),
      audioEnabled: localAudioEnabled,
      videoEnabled: localScreenSharing ? true : localVideoEnabled,
      stream: localScreenSharing ? screenShareStream ?? localStream : localStream,
      isLocal: true,
      handRaised: isHandRaised,
    };
    const remotes = remotePeers.map(p => ({ ...p, isLocal: false }));
    return [local, ...remotes];
  }, [isHandRaised, localAudioEnabled, localScreenSharing, localStream, localVideoEnabled, remotePeers, screenShareStream, t]);

  const activeParticipant = participants.find(p => p.peerId === activePeerId) || participants[0] || null;
  const stageParticipant = screenSharePeerId ? participants.find(p => p.peerId === screenSharePeerId) || activeParticipant : activeParticipant;
  const isStageSharing = !!screenSharePeerId && stageParticipant?.peerId === screenSharePeerId;
  const speakingRequests = useMemo(
    () =>
      participants.filter(
        (participant) =>
          participant.peerId !== 'local' &&
          (!!participant.handRaised || authorizedSpeakers.has(participant.peerId))
      ),
    [authorizedSpeakers, participants]
  );

  const appendChatMessage = useCallback((message: ChatMessage) => {
    setChatMessages((prev) => {
      if (prev.some((entry) => entry.id === message.id)) return prev;
      return [...prev, message].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }, []);

  const sendBroadcast = useCallback(async <TPayload,>(event: string, payload: TPayload) => {
    if (!channelRef.current) return;
    await channelRef.current.send({ type: 'broadcast', event, payload });
  }, []);

  const refreshLocalPreviewStreams = useCallback(() => {
    setLocalStream(localStreamRef.current ? new MediaStream(localStreamRef.current.getTracks()) : null);
    setScreenShareStream(
      screenShareStreamRef.current ? new MediaStream(screenShareStreamRef.current.getTracks()) : null
    );
  }, []);

  const getCameraVideoTrack = useCallback(() => {
    return localStreamRef.current?.getVideoTracks()[0] ?? null;
  }, []);

  const getScreenVideoTrack = useCallback(() => {
    return screenShareStreamRef.current?.getVideoTracks()[0] ?? null;
  }, []);

  const getOutgoingVideoTrack = useCallback(() => {
    return getScreenVideoTrack() || (localVideoEnabled ? getCameraVideoTrack() : null);
  }, [getCameraVideoTrack, getScreenVideoTrack, localVideoEnabled]);

  const trackRoomPresence = useCallback(
    async (overrides?: Partial<PresenceStatePayload>) => {
      const channel = channelRef.current;
      if (!channel || !joinedAtRef.current) return;

      try {
        await channel.track({
          peerId: deviceId,
          displayName: displayName || t('identity.guest'),
          audioEnabled: overrides?.audioEnabled ?? localAudioEnabled,
          videoEnabled: overrides?.videoEnabled ?? (localScreenSharing ? true : localVideoEnabled),
          joinedAt: overrides?.joinedAt ?? joinedAtRef.current,
          handRaised: overrides?.handRaised ?? isHandRaised,
        });
      } catch {
        // Ignore ephemeral presence errors to keep the room usable.
      }
    },
    [deviceId, displayName, isHandRaised, localAudioEnabled, localScreenSharing, localVideoEnabled, t]
  );

  const syncDatabasePresence = useCallback(
    async (overrides?: { audioEnabled?: boolean; videoEnabled?: boolean }) => {
      if (!groupId || !deviceId) return;

      await upsertGroupCallPresence({
        groupId,
        deviceId,
        displayName: displayName || t('identity.guest'),
        audioEnabled: overrides?.audioEnabled ?? localAudioEnabled,
        videoEnabled: overrides?.videoEnabled ?? (localScreenSharing ? true : localVideoEnabled),
        joinedAt: joinedAtRef.current || new Date().toISOString(),
        sharedBibleRef,
        sharedBibleContent,
      });
    },
    [
      deviceId,
      displayName,
      groupId,
      localAudioEnabled,
      localScreenSharing,
      localVideoEnabled,
      sharedBibleContent,
      sharedBibleRef,
      t,
    ]
  );

  const replaceOutgoingVideoTrack = useCallback(
    async (nextTrack: MediaStreamTrack | null) => {
      const tasks: Promise<unknown>[] = [];

      for (const pc of peerConnectionsRef.current.values()) {
        const sender = pc.getSenders().find((candidate) => candidate.track?.kind === 'video');
        if (sender) {
          tasks.push(sender.replaceTrack(nextTrack));
          continue;
        }

        const sourceStream = screenShareStreamRef.current || localStreamRef.current;
        if (nextTrack && sourceStream) {
          pc.addTrack(nextTrack, sourceStream);
        }
      }

      if (tasks.length) {
        await Promise.allSettled(tasks);
      }
    },
    []
  );

  const ensureCameraTrack = useCallback(async () => {
    const existingTrack = getCameraVideoTrack();
    if (existingTrack) return existingTrack;

    const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
    const [nextTrack] = cameraStream.getVideoTracks();
    if (!nextTrack) return null;

    if (!localStreamRef.current) {
      localStreamRef.current = new MediaStream();
    }

    localStreamRef.current.addTrack(nextTrack);
    refreshLocalPreviewStreams();
    return nextTrack;
  }, [getCameraVideoTrack, refreshLocalPreviewStreams]);

  const createPeerConnection = useCallback(
    (targetPeerId: string) => {
      const existing = peerConnectionsRef.current.get(targetPeerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnectionsRef.current.set(targetPeerId, pc);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          void sendBroadcast<SignalPayload>('signal', {
            from: deviceId,
            to: targetPeerId,
            type: 'ice-candidate',
            signal: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        setRemotePeers((prev) =>
          prev.map((peer) =>
            peer.peerId === targetPeerId ? { ...peer, stream: event.streams[0] || null } : peer
          )
        );
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        
        if (state === 'failed' || state === 'disconnected') {
          // === FONCTIONNALITÉ 2: RECONNEXION AUTOMATIQUE ===
          const attempts = reconnectAttemptsRef.current.get(targetPeerId) || 0;
          
          if (attempts < 5) {
            const backoff = Math.min(1000 * Math.pow(2, attempts), 30000);
            reconnectAttemptsRef.current.set(targetPeerId, attempts + 1);
            
            logger.log(`[Reconnexion] Tentative ${attempts + 1}/5 pour ${targetPeerId} dans ${backoff}ms`);
            
            const timer = setTimeout(() => {
              peerConnectionsRef.current.delete(targetPeerId);
              pc.close();
              void createOffer(targetPeerId);
            }, backoff);
            
            reconnectTimersRef.current.set(targetPeerId, timer);
          } else {
            logger.warn(`[Reconnexion] Échec après 5 tentatives pour ${targetPeerId}`);
            peerConnectionsRef.current.delete(targetPeerId);
            setRemotePeers((prev) => prev.filter((p) => p.peerId !== targetPeerId));
          }
        } else if (state === 'closed') {
          peerConnectionsRef.current.delete(targetPeerId);
        } else if (state === 'connected') {
          // Reset counter on successful connection
          reconnectAttemptsRef.current.delete(targetPeerId);
          const timer = reconnectTimersRef.current.get(targetPeerId);
          if (timer) {
            clearTimeout(timer);
            reconnectTimersRef.current.delete(targetPeerId);
          }
        }
      };

      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current as MediaStream);
        });
      }

      const outgoingVideoTrack = getOutgoingVideoTrack();
      const sourceStream = getScreenVideoTrack() ? screenShareStreamRef.current : localStreamRef.current;
      if (outgoingVideoTrack && sourceStream) {
        pc.addTrack(outgoingVideoTrack, sourceStream);
      }

      return pc;
    },
    [deviceId, getOutgoingVideoTrack, getScreenVideoTrack, sendBroadcast]
  );

  const createOffer = useCallback(
    async (targetPeerId: string) => {
      if (!targetPeerId || targetPeerId === deviceId || peerConnectionsRef.current.has(targetPeerId)) {
        return;
      }

      const pc = createPeerConnection(targetPeerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendBroadcast<SignalPayload>('signal', {
        from: deviceId,
        to: targetPeerId,
        type: 'offer',
        signal: offer,
      });
    },
    [createPeerConnection, deviceId, sendBroadcast]
  );

  const handleOffer = useCallback(
    async (from: string, offer: RTCSessionDescriptionInit) => {
      const pc = createPeerConnection(from);
      if (pc.signalingState !== 'stable') {
        try {
          await pc.setLocalDescription({ type: 'rollback' });
        } catch {
          // Ignore rollback failures and let setRemoteDescription surface any real issue.
        }
      }
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendBroadcast<SignalPayload>('signal', {
        from: deviceId,
        to: from,
        type: 'answer',
        signal: answer,
      });
    },
    [createPeerConnection, deviceId, sendBroadcast]
  );

  const handleAnswer = useCallback(async (from: string, answer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionsRef.current.get(from);
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }, []);

  const handleIceCandidate = useCallback(async (from: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionsRef.current.get(from);
    if (!pc) return;
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }, []);

  const syncRemotePeersFromPresence = useCallback(
    (channel: any) => {
      const state = (channel?.presenceState?.() || {}) as Record<string, PresenceStatePayload[]>;
      const latestPeers: RemotePeer[] = [];

      Object.values(state).forEach((entries) => {
        if (!Array.isArray(entries) || !entries.length) return;
        const latest = entries[entries.length - 1];
        const peerId = String(latest?.peerId || '');
        if (!peerId || peerId === deviceId) return;

        latestPeers.push({
          peerId,
          displayName: String(latest?.displayName || 'Invite'),
          audioEnabled: latest?.audioEnabled !== false,
          videoEnabled: !!latest?.videoEnabled,
          handRaised: !!latest?.handRaised,
          stream: null,
        });
      });

      const nextPeerIds = new Set(latestPeers.map((peer) => peer.peerId));
      for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
        if (!nextPeerIds.has(peerId)) {
          pc.close();
          peerConnectionsRef.current.delete(peerId);
        }
      }

      setRemotePeers((prev) => {
        const byPeerId = new Map(prev.map((peer) => [peer.peerId, peer]));
        return latestPeers.map((peer) => ({
          ...peer,
          stream: byPeerId.get(peer.peerId)?.stream || null,
        }));
      });

      latestPeers.forEach((peer) => {
        if (deviceId.localeCompare(peer.peerId) > 0 && !peerConnectionsRef.current.has(peer.peerId)) {
          void createOffer(peer.peerId);
        }
      });

      if (screenSharePeerId && screenSharePeerId !== 'local' && !nextPeerIds.has(screenSharePeerId)) {
        setScreenSharePeerId(null);
      }
    },
    [createOffer, deviceId, screenSharePeerId]
  );

  const leaveCall = useCallback(
    async (options?: { close?: boolean; endSession?: boolean; notifyEnded?: boolean }) => {
      const shouldClose = options?.close ?? true;
      const shouldEndSession = options?.endSession ?? isCallOwner;
      const shouldNotifyEnded = options?.notifyEnded ?? shouldEndSession;
      const channel = channelRef.current;

      // === FONCTIONNALITÉ 6: ARRÊT ENREGISTREMENT ===
      if (isRecording && mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }

      // === FONCTIONNALITÉ 7: RÉSUMÉ POST-APPEL ===
      if (shouldEndSession && groupId) {
        try {
          const summary = {
            groupId,
            callId: resolvedCallId,
            startedAt: joinedAtRef.current || new Date().toISOString(),
            endedAt: new Date().toISOString(),
            durationSec: callDurationSec,
            participants: participants.map(p => p.displayName),
            participantCount: participants.length,
            tasksCompleted: sessionTasks.filter(t => t.done).length,
            tasksTotal: sessionTasks.length,
            sharedVerses: sharedBibleRef ? [sharedBibleRef] : [],
            theme: sessionTasks[0]?.text || null,
            chatMessageCount: chatMessages.length,
          };

          // Stocker dans Supabase
          await supabase.from('community_call_summaries').insert(summary);
          
          logger.log('[Résumé] Appel terminé:', summary);
        } catch (err) {
          console.error('[Résumé] Échec génération résumé:', err);
        }
      }

      // Nettoyer les timers de reconnexion
      reconnectTimersRef.current.forEach((timer) => clearTimeout(timer));
      reconnectTimersRef.current.clear();
      reconnectAttemptsRef.current.clear();

      if (shouldNotifyEnded && joined && resolvedCallId) {
        try {
          await channel?.send({
            type: 'broadcast',
            event: 'ui_sync',
            payload: {
              type: 'call.ended',
              peerId: deviceId,
              callId: resolvedCallId,
            } satisfies UiSyncPayload,
          });
        } catch {
          // Ignore notify failures during teardown.
        }
      }

      channelRef.current = null;
      joinedAtRef.current = '';
      setJoined(false);

      if (channel) {
        try {
          await channel.untrack();
        } catch {
          // Ignore untrack failures.
        }
        try {
          await channel.unsubscribe();
        } catch {
          // Ignore unsubscribe failures.
        }
      }

      if (joined && groupId && deviceId) {
        await logGroupCallEvent({
          groupId,
          deviceId,
          displayName: displayName || t('identity.guest'),
          eventType: 'leave',
        });
      }

      if (groupId && deviceId) {
        await clearGroupCallPresence(groupId, deviceId);
      }

      if (shouldEndSession && resolvedCallId && deviceId) {
        await endGroupCallSession(resolvedCallId, deviceId);
      }

      if (screenShareStreamRef.current) {
        screenShareStreamRef.current.getTracks().forEach((track) => track.stop());
        screenShareStreamRef.current = null;
      }
      setScreenShareStream(null);
      setLocalScreenSharing(false);
      setScreenSharePeerId(null);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      setLocalStream(null);

      for (const pc of peerConnectionsRef.current.values()) {
        pc.close();
      }
      peerConnectionsRef.current.clear();
      setRemotePeers([]);
      setAuthorizedSpeakers(new Set());
      setActivePeerId('local');
      setIsHandRaised(false);
      releaseAudioFocus({ id: `group-call:${groupId}`, kind: 'call' });

      if (shouldClose) {
        onClose?.();
      }
    },
    [
      deviceId,
      displayName,
      groupId,
      isCallOwner,
      joined,
      onClose,
      resolvedCallId,
      t,
    ]
  );

  const handleLeaveRoom = useCallback(() => {
    void leaveCall({
      close: true,
      endSession: isCallOwner,
      notifyEnded: isCallOwner,
    });
  }, [isCallOwner, leaveCall]);

  const onToggleAudio = useCallback(() => {
    const nextEnabled = !localAudioEnabled;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    setLocalAudioEnabled(nextEnabled);

    if (!joined) return;
    void trackRoomPresence({ audioEnabled: nextEnabled });
    void syncDatabasePresence({ audioEnabled: nextEnabled });
    void logGroupCallEvent({
      groupId,
      deviceId,
      displayName: displayName || t('identity.guest'),
      eventType: nextEnabled ? 'unmute' : 'mute',
    });
  }, [
    deviceId,
    displayName,
    groupId,
    joined,
    localAudioEnabled,
    syncDatabasePresence,
    t,
    trackRoomPresence,
  ]);

  const onToggleVideo = useCallback(async () => {
    try {
      const nextEnabled = !localVideoEnabled;

      if (nextEnabled) {
        const cameraTrack = await ensureCameraTrack();
        if (cameraTrack) {
          cameraTrack.enabled = true;
          if (!localScreenSharing) {
            await replaceOutgoingVideoTrack(cameraTrack);
          }
        }
      } else {
        const cameraTrack = getCameraVideoTrack();
        if (cameraTrack) {
          cameraTrack.enabled = false;
        }
        if (!localScreenSharing) {
          await replaceOutgoingVideoTrack(null);
        }
      }

      setLocalVideoEnabled(nextEnabled);
      refreshLocalPreviewStreams();

      if (!joined) return;
      const effectiveVideo = localScreenSharing ? true : nextEnabled;
      await trackRoomPresence({ videoEnabled: effectiveVideo });
      await syncDatabasePresence({ videoEnabled: effectiveVideo });
      await logGroupCallEvent({
        groupId,
        deviceId,
        displayName: displayName || t('identity.guest'),
        eventType: nextEnabled ? 'video_on' : 'video_off',
      });
    } catch {
      setError(t('community.groups.callPermissionError'));
    }
  }, [
    deviceId,
    displayName,
    ensureCameraTrack,
    getCameraVideoTrack,
    groupId,
    joined,
    localScreenSharing,
    localVideoEnabled,
    refreshLocalPreviewStreams,
    replaceOutgoingVideoTrack,
    syncDatabasePresence,
    t,
    trackRoomPresence,
  ]);

  const stopScreenShare = useCallback(async () => {
    if (!localScreenSharing) return;

    if (screenShareStreamRef.current) {
      screenShareStreamRef.current.getTracks().forEach((track) => track.stop());
      screenShareStreamRef.current = null;
    }
    setScreenShareStream(null);
    setLocalScreenSharing(false);
    setScreenSharePeerId((prev) => (prev === 'local' ? null : prev));

    await replaceOutgoingVideoTrack(localVideoEnabled ? getCameraVideoTrack() : null);
    refreshLocalPreviewStreams();

    if (!joined) return;
    await trackRoomPresence({ videoEnabled: localVideoEnabled });
    await syncDatabasePresence({ videoEnabled: localVideoEnabled });
    await sendBroadcast<UiSyncPayload>('ui_sync', {
      type: 'screen-share',
      peerId: deviceId,
      active: false,
    });
  }, [
    deviceId,
    getCameraVideoTrack,
    joined,
    localScreenSharing,
    localVideoEnabled,
    refreshLocalPreviewStreams,
    replaceOutgoingVideoTrack,
    sendBroadcast,
    syncDatabasePresence,
    trackRoomPresence,
  ]);

  const onToggleShare = useCallback(async () => {
    if (localScreenSharing) {
      await stopScreenShare();
      return;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError(t('community.groups.callPermissionError'));
      return;
    }

    try {
      const nextScreenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const [screenTrack] = nextScreenStream.getVideoTracks();
      if (!screenTrack) return;

      screenTrack.onended = () => {
        void stopScreenShare();
      };

      screenShareStreamRef.current = nextScreenStream;
      setScreenShareStream(nextScreenStream);
      setLocalScreenSharing(true);
      setScreenSharePeerId('local');
      await replaceOutgoingVideoTrack(screenTrack);
      refreshLocalPreviewStreams();

      if (!joined) return;
      await trackRoomPresence({ videoEnabled: true });
      await syncDatabasePresence({ videoEnabled: true });
      await sendBroadcast<UiSyncPayload>('ui_sync', {
        type: 'screen-share',
        peerId: deviceId,
        active: true,
      });
    } catch {
      setError(t('community.groups.callPermissionError'));
    }
  }, [
    deviceId,
    joined,
    localScreenSharing,
    refreshLocalPreviewStreams,
    replaceOutgoingVideoTrack,
    sendBroadcast,
    stopScreenShare,
    syncDatabasePresence,
    t,
    trackRoomPresence,
  ]);

  const onToggleHand = useCallback(() => {
    setIsHandRaised((prev) => !prev);
  }, []);

  const authorizeParticipant = useCallback(
    (peerId: string) => {
      if (!isCallOwner) return;
      setAuthorizedSpeakers((prev) => {
        const next = new Set(prev);
        if (next.has(peerId)) next.delete(peerId);
        else next.add(peerId);
        if (joined) {
          void sendBroadcast<UiSyncPayload>('ui_sync', {
            type: 'speaker.authorizations',
            peerIds: Array.from(next),
          });
        }
        return next;
      });
    },
    [isCallOwner, joined, sendBroadcast]
  );

  const onSendChat = useCallback(() => {
    const text = chatDraft.trim();
    if (!text) return;

    const msg: ChatMessage = {
      id: makeId('msg'),
      peerId: deviceId,
      displayName: displayName || t('identity.guest'),
      text,
      createdAt: new Date().toISOString(),
      mine: true,
    };

    appendChatMessage(msg);
    setChatDraft('');
    if (joined) {
      void sendBroadcast<RoomChatPayload>('chat.message', { message: msg });
    }
  }, [appendChatMessage, chatDraft, deviceId, displayName, joined, sendBroadcast, t]);

  // === FONCTIONNALITÉ 5: SONDAGES ===
  const onCreatePoll = useCallback(() => {
    const question = pollDraftQuestion.trim();
    const options = pollDraftOptions.filter(o => o.trim());
    
    if (!question || options.length < 2) return;

    const poll = {
      id: makeId('poll'),
      question,
      options,
      votes: new Map<number, string[]>(),
      closed: false,
    };

    setActivePoll(poll);
    setShowPollCreator(false);
    setPollDraftQuestion('');
    setPollDraftOptions(['', '']);

    // Broadcast le sondage
    void sendBroadcast('poll.created', { poll });
  }, [pollDraftQuestion, pollDraftOptions, sendBroadcast]);

  const onVotePoll = useCallback((optionIndex: number) => {
    if (!activePoll || activePoll.closed) return;

    setActivePoll((prev) => {
      if (!prev) return null;
      const newVotes = new Map(prev.votes);
      const existingVoters = newVotes.get(optionIndex) || [];
      
      // Retirer l'ancien vote si existe
      newVotes.forEach((voters, idx) => {
        const filtered = voters.filter(v => v !== deviceId);
        if (filtered.length > 0) newVotes.set(idx, filtered);
      });
      
      newVotes.set(optionIndex, [...existingVoters, deviceId]);
      return { ...prev, votes: newVotes };
    });

    void sendBroadcast('poll.voted', { pollId: activePoll.id, optionIndex, voterId: deviceId });
  }, [activePoll, deviceId, sendBroadcast]);

  const onClosePoll = useCallback(() => {
    if (!activePoll) return;
    setActivePoll((prev) => prev ? { ...prev, closed: true } : null);
    void sendBroadcast('poll.closed', { pollId: activePoll.id });
  }, [activePoll, sendBroadcast]);

  // === FONCTIONNALITÉ 6: ENREGISTREMENT ===
  const onStartRecording = useCallback(async () => {
    try {
      // Enregistrer le stream audio local + remote
      const combinedStream = new MediaStream();
      
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(track => {
          combinedStream.addTrack(track);
        });
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      recordedChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `charishub-call-${new Date().toISOString().slice(0, 10)}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        recordedChunksRef.current = [];
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      void sendBroadcast('recording.started', { peerId: deviceId });
    } catch (err) {
      console.error('[Enregistrement] Échec:', err);
      setError('Impossible de démarrer l\'enregistrement');
    }
  }, [deviceId, sendBroadcast]);

  const onStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      void sendBroadcast('recording.stopped', { peerId: deviceId });
    }
  }, [deviceId, isRecording, sendBroadcast]);

  const joinCall = useCallback(async () => {
    if (busy || joined || !supabase) return;

    setBusy(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: localVideoEnabled,
      });

      stream.getAudioTracks().forEach((track) => {
        track.enabled = localAudioEnabled;
      });
      stream.getVideoTracks().forEach((track) => {
        track.enabled = localVideoEnabled;
      });

      localStreamRef.current = stream;
      refreshLocalPreviewStreams();
      setJoined(true);
      joinedAtRef.current = new Date().toISOString();

      const channel = supabase.channel(`call_room:${groupId || 'default'}`, {
        config: { presence: { key: deviceId || 'local' } },
      });
      channelRef.current = channel;

      channel
        .on('presence', { event: 'sync' }, () => syncRemotePeersFromPresence(channel))
        .on('presence', { event: 'join' }, () => syncRemotePeersFromPresence(channel))
        .on('presence', { event: 'leave' }, () => syncRemotePeersFromPresence(channel))
        .on('broadcast', { event: 'signal' }, async ({ payload }: { payload: SignalPayload }) => {
          if (!payload || payload.to !== deviceId) return;

          if (payload.type === 'offer') await handleOffer(payload.from, payload.signal);
          else if (payload.type === 'answer') await handleAnswer(payload.from, payload.signal);
          else if (payload.type === 'ice-candidate') await handleIceCandidate(payload.from, payload.signal);
        })
        .on('broadcast', { event: 'chat.message' }, ({ payload }: { payload: RoomChatPayload }) => {
          const incomingMessage = payload?.message;
          if (!incomingMessage || incomingMessage.peerId === deviceId) return;
          appendChatMessage({ ...incomingMessage, mine: false });
        })
        .on('broadcast', { event: 'ui_sync' }, ({ payload }: { payload: UiSyncPayload }) => {
          if (!payload) return;

          if (payload.type === 'hand' && payload.peerId !== deviceId) {
            setRemotePeers((prev) =>
              prev.map((peer) =>
                peer.peerId === payload.peerId ? { ...peer, handRaised: payload.active } : peer
              )
            );
            return;
          }

          if (payload.type === 'screen-share') {
            setScreenSharePeerId((prev) => {
              if (payload.active) return payload.peerId;
              return prev === payload.peerId ? null : prev;
            });
            return;
          }

          if (payload.type === 'bible.sync') {
            suppressBibleSyncBroadcastRef.current = true;
            setSharedBibleRef(payload.reference);
            setSharedBibleContent(payload.content);
            if (payload.metadata) {
              setSharedBibleMetadata(payload.metadata);
            }
            return;
          }

          if (payload.type === 'speaker.authorizations') {
            setAuthorizedSpeakers(new Set(payload.peerIds));
            return;
          }

          if (payload.type === 'call.ended' && payload.peerId !== deviceId) {
            setError("L'appel a été terminé par l'organisateur.");
            void leaveCall({ close: true, endSession: false, notifyEnded: false });
          }
        })
        // === SONDAGES ===
        .on('broadcast', { event: 'poll.created' }, ({ payload }: { payload: any }) => {
          if (payload?.poll) {
            setActivePoll({
              ...payload.poll,
              votes: new Map(payload.poll.votes || []),
            });
          }
        })
        .on('broadcast', { event: 'poll.voted' }, ({ payload }: { payload: any }) => {
          if (!payload || payload.voterId === deviceId) return;
          setActivePoll((prev) => {
            if (!prev || prev.id !== payload.pollId) return prev;
            const newVotes = new Map(prev.votes);
            const existing = newVotes.get(payload.optionIndex) || [];
            newVotes.set(payload.optionIndex, [...existing, payload.voterId]);
            return { ...prev, votes: newVotes };
          });
        })
        .on('broadcast', { event: 'poll.closed' }, () => {
          setActivePoll((prev) => prev ? { ...prev, closed: true } : null);
        })
        // === ENREGISTREMENT ===
        .on('broadcast', { event: 'recording.started' }, ({ payload }: { payload: any }) => {
          if (payload?.peerId !== deviceId) {
            logger.log('[Enregistrement] Participant', payload.peerId, 'a démarré');
          }
        })
        .subscribe(async (status: string) => {
          if (status !== 'SUBSCRIBED') return;
          if (channelRef.current !== channel) return;

          await trackRoomPresence({
            joinedAt: joinedAtRef.current,
            audioEnabled: localAudioEnabled,
            videoEnabled: localScreenSharing ? true : localVideoEnabled,
          });

          await syncDatabasePresence({
            audioEnabled: localAudioEnabled,
            videoEnabled: localScreenSharing ? true : localVideoEnabled,
          });

          await logGroupCallEvent({
            groupId,
            deviceId,
            displayName: displayName || t('identity.guest'),
            eventType: 'join',
          });
          await logGroupCallEvent({
            groupId,
            deviceId,
            displayName: displayName || t('identity.guest'),
            eventType: localVideoEnabled ? 'mode_video' : 'mode_audio',
          });

          if (resolvedCallId) {
            await activateGroupCallSession(resolvedCallId, deviceId);
            if (!isCallOwner) {
              await respondToGroupCallInvitation(resolvedCallId, deviceId, 'accept');
            }
          }
        });
    } catch {
      setError(t('community.groups.callPermissionError'));
    } finally {
      setBusy(false);
    }
  }, [
    activateGroupCallSession,
    appendChatMessage,
    busy,
    deviceId,
    displayName,
    groupId,
    handleAnswer,
    handleIceCandidate,
    handleOffer,
    isCallOwner,
    joined,
    localAudioEnabled,
    localScreenSharing,
    localVideoEnabled,
    refreshLocalPreviewStreams,
    resolvedCallId,
    respondToGroupCallInvitation,
    supabase,
    syncDatabasePresence,
    syncRemotePeersFromPresence,
    t,
    trackRoomPresence,
  ]);

  useEffect(() => {
    if (!joined) return;
    void sendBroadcast<UiSyncPayload>('ui_sync', {
      type: 'hand',
      peerId: deviceId,
      active: isHandRaised,
    });
    void trackRoomPresence({ handRaised: isHandRaised });
  }, [deviceId, isHandRaised, joined, sendBroadcast, trackRoomPresence]);

  useEffect(() => {
    if (!joined) return;

    const timer = window.setInterval(() => {
      void trackRoomPresence();
      void syncDatabasePresence();
    }, 15000);

    void trackRoomPresence();
    void syncDatabasePresence();

    return () => window.clearInterval(timer);
  }, [joined, syncDatabasePresence, trackRoomPresence]);

  // === FONCTIONNALITÉ 1: CHRONOMÈTRE D'APPEL ===
  useEffect(() => {
    if (!joined) return;
    
    callDurationIntervalRef.current = window.setInterval(() => {
      setCallDurationSec((prev) => prev + 1);
    }, 1000) as unknown as NodeJS.Timeout;

    return () => {
      if (callDurationIntervalRef.current) {
        clearInterval(callDurationIntervalRef.current);
      }
    };
  }, [joined]);

  // === FONCTIONNALITÉ 3: QUALITÉ RÉSEAU ===
  useEffect(() => {
    if (!joined) return;

    const checkNetworkQuality = async () => {
      const qualityMap = new Map<string, NetworkQuality>();
      
      for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
        try {
          const stats = await pc.getStats();
          let packetsLost = 0;
          let packetsReceived = 0;
          
          stats.forEach((report) => {
            if (report.type === 'inbound-rtp' && report.kind === 'audio') {
              packetsLost += report.packetsLost || 0;
              packetsReceived += report.packetsReceived || 0;
            }
          });

          const total = packetsLost + packetsReceived;
          const lossRate = total > 0 ? packetsLost / total : 0;

          if (lossRate < 0.01) qualityMap.set(peerId, 'excellent');
          else if (lossRate < 0.03) qualityMap.set(peerId, 'good');
          else if (lossRate < 0.1) qualityMap.set(peerId, 'fair');
          else qualityMap.set(peerId, 'weak');
        } catch {
          qualityMap.set(peerId, 'offline');
        }
      }

      setPeerNetworkQuality(qualityMap);
    };

    networkStatsIntervalRef.current = window.setInterval(checkNetworkQuality, 3000) as unknown as NodeJS.Timeout;
    
    // Qualité réseau locale
    const checkLocalQuality = () => {
      const nav = navigator as any;
      if (nav.connection) {
        const conn = nav.connection;
        const effectiveType = conn.effectiveType || '4g';
        if (effectiveType === '4g') setNetworkQuality('excellent');
        else if (effectiveType === '3g') setNetworkQuality('good');
        else if (effectiveType === '2g') setNetworkQuality('fair');
        else setNetworkQuality('weak');
      }
    };
    
    checkLocalQuality();

    return () => {
      if (networkStatsIntervalRef.current) {
        clearInterval(networkStatsIntervalRef.current);
      }
    };
  }, [joined]);

  useEffect(() => {
    if (!joined) return;
    if (suppressBibleSyncBroadcastRef.current) {
      suppressBibleSyncBroadcastRef.current = false;
      lastBibleSyncRef.current = {
        reference: sharedBibleRef,
        content: sharedBibleContent,
      };
      return;
    }
    if (
      lastBibleSyncRef.current.reference === sharedBibleRef &&
      lastBibleSyncRef.current.content === sharedBibleContent
    ) {
      return;
    }

    lastBibleSyncRef.current = {
      reference: sharedBibleRef,
      content: sharedBibleContent,
    };

    const timer = window.setTimeout(() => {
      void sendBroadcast<UiSyncPayload>('ui_sync', {
        type: 'bible.sync',
        peerId: deviceId,
        reference: sharedBibleRef,
        content: sharedBibleContent,
        metadata: sharedBibleMetadata,
      });
      void syncDatabasePresence();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [deviceId, joined, sendBroadcast, sharedBibleContent, sharedBibleRef, sharedBibleMetadata, syncDatabasePresence]);

  useEffect(() => {
    if (!autoJoinRequested || joined || busy || autoJoinAttemptedRef.current) return;
    autoJoinAttemptedRef.current = true;
    void joinCall();
  }, [autoJoinRequested, busy, joinCall, joined]);

  useEffect(() => {
    leaveCallRef.current = leaveCall;
  }, [leaveCall]);

  useEffect(() => {
    document.body.classList.add('group-call-active');
    return () => {
      document.body.classList.remove('group-call-active');
      void leaveCallRef.current?.({ close: false, endSession: false, notifyEnded: false });
    };
  }, []);

  return (
    <section className="relative flex h-screen w-screen overflow-hidden bg-[#1a1c24] transition-all duration-700">
      
      <div className="relative z-10 flex flex-1 flex-col p-4 md:p-6 lg:p-10 min-h-0">
        
        {/* Floating Header */}
        <motion.header 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mx-auto flex w-full max-w-6xl items-center justify-between rounded-[24px] md:rounded-[40px] border border-white/10 bg-white/[0.03] px-4 py-3 md:px-8 md:py-5 backdrop-blur-3xl ring-1 ring-white/5"
        >
          <div className="flex items-center gap-2 md:gap-6">
            <button onClick={handleLeaveRoom} className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-all">
              <ChevronLeft size={20} className="md:w-[24px]" />
            </button>
            <div className="min-w-0">
              <h2 className="text-sm md:text-xl font-bold tracking-tight text-white/95 uppercase truncate max-w-[120px] md:max-w-none">{activeTask?.text}</h2>
              <p className="text-[9px] md:text-[11px] font-medium text-white/40 truncate">Session de Groupe • {displayName || "Disciple"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-6">
            {/* === FONCTIONNALITÉ 1: CHRONOMÈTRE === */}
            <div className="hidden xs:flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 md:px-4 md:py-2 ring-1 ring-white/10">
              <div className={`h-1.5 w-1.5 md:h-2 md:w-2 rounded-full ${joined ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-[10px] md:text-sm font-mono font-bold text-white/80">
                {Math.floor(callDurationSec / 3600).toString().padStart(2, '0')}:
                {Math.floor((callDurationSec % 3600) / 60).toString().padStart(2, '0')}:
                {(callDurationSec % 60).toString().padStart(2, '0')}
              </span>
            </div>

            {/* === FONCTIONNALITÉ 6: INDICATEUR ENREGISTREMENT === */}
            {isRecording && (
              <div className="flex items-center gap-2 rounded-full bg-red-500/20 px-3 py-1.5 md:px-4 md:py-2 ring-1 ring-red-500/40">
                <div className="h-1.5 w-1.5 md:h-2 md:w-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] md:text-xs font-bold text-red-400">REC</span>
              </div>
            )}

            <div className="hidden sm:flex items-center gap-3 rounded-full bg-white/5 px-5 py-2 ring-1 ring-white/10">
               <Link2 size={16} className="text-white/30 " />
               <span className="text-[12px] font-mono font-medium text-white/60 tracking-wider font-bold">MODE-ÉTUDE</span>
            </div>
            
            <div className="flex -space-x-2 md:-space-x-3">
               {participants.slice(0, 3).map((p, i) => (
                 <div key={p.peerId} className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full border-2 border-[#1a1c24] bg-slate-700 text-[8px] md:text-[10px] font-black text-white shadow-xl" style={{ zIndex: 10 - i }}>
                   {initials(p.displayName)}
                 </div>
               ))}
               {participants.length > 3 && (
                 <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full border-2 border-[#1a1c24] bg-[#D4FF33] text-[8px] md:text-[10px] font-black text-black shadow-xl" style={{ zIndex: 0 }}>
                   +{participants.length - 3}
                 </div>
               )}
            </div>
          </div>
        </motion.header>

        {error ? (
          <div className="mx-auto mt-4 flex w-full max-w-6xl items-center justify-between gap-3 rounded-3xl border border-rose-400/30 bg-rose-500/10 px-5 py-3 text-sm text-rose-100 backdrop-blur-xl">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/80"
            >
              Fermer
            </button>
          </div>
        ) : null}

        {/* Main Area */}
        <div className="mt-4 md:mt-8 flex flex-1 flex-col md:flex-row gap-4 md:gap-8 min-h-0 overflow-hidden">
          
          {/* Stage */}
          <div className="flex flex-1 md:flex-[2.8] flex-col gap-4 md:gap-8 min-w-0 relative">
             <div className="flex-1 flex min-h-0 relative bg-black/20 rounded-[28px] md:rounded-[32px] overflow-hidden border border-white/10 shadow-2xl">
               {viewMode === 'bible' ? (
                  <div className="relative flex flex-1 flex-col min-h-0">
                     {/* Floating Video for Speaker (PIP Mode) */}
                     <StageVideo 
                       participant={stageParticipant}
                       speaking={speakingPeerId === stageParticipant?.peerId}
                       screenSharing={!!screenSharePeerId}
                       shareViewMode={shareViewMode}
                       localAudioEnabled={localAudioEnabled}
                       localVideoEnabled={localVideoEnabled}
                       localScreenSharing={localScreenSharing}
                       handRaised={isHandRaised}
                       onToggleAudio={onToggleAudio}
                       onToggleVideo={onToggleVideo}
                       onToggleShare={onToggleShare}
                       onToggleHand={onToggleHand}
                       onLeave={() => leaveCall?.({ close: true })}
                       isLocalHost={isCallOwner}
                       isRecording={isRecording}
                       onStartRecording={onStartRecording}
                       onStopRecording={onStopRecording}
                       isPip={true}
                     />
                     <div className="flex-1 min-h-0 flex flex-col relative w-full h-full">
                        <BibleReader 
                          embedded={true} 
                          onSyncBible={(r, c, m) => { 
                            setSharedBibleRef(r); 
                            setSharedBibleContent(c);
                            if (m) setSharedBibleMetadata(m);
                            void sendBroadcast<UiSyncPayload>('ui-sync', {
                              type: 'bible.sync',
                              peerId: deviceId,
                              reference: r,
                              content: c,
                              metadata: m,
                            });
                          }} 
                        />
                     </div>
                  </div>
               ) : (
                 <StageVideo 
                   participant={stageParticipant}
                   speaking={speakingPeerId === stageParticipant?.peerId}
                   screenSharing={!!screenSharePeerId}
                   shareViewMode={shareViewMode}
                   localAudioEnabled={localAudioEnabled}
                   localVideoEnabled={localVideoEnabled}
                   localScreenSharing={localScreenSharing}
                   handRaised={isHandRaised}
                   onToggleAudio={onToggleAudio}
                   onToggleVideo={onToggleVideo}
                   onToggleShare={onToggleShare}
                   onToggleHand={onToggleHand}
                   onLeave={() => leaveCall?.({ close: true })}
                   isLocalHost={isCallOwner}
                   isRecording={isRecording}
                   onStartRecording={onStartRecording}
                   onStopRecording={onStopRecording}
                 />
               )}
               {viewMode !== 'bible' && sharedBibleRef && sharedBibleContent ? (
                 <VerseOverlay
                   reference={sharedBibleRef}
                   content={sharedBibleContent}
                   onClose={() => {
                     setSharedBibleRef(null);
                     setSharedBibleContent(null);
                     setSharedBibleMetadata(undefined);
                     void sendBroadcast<UiSyncPayload>('ui-sync', {
                       type: 'bible.sync',
                       peerId: deviceId,
                       reference: null,
                       content: null,
                     });
                   }}
                   onOpenInterlinear={sharedBibleMetadata ? () => setShowInterlinear(true) : undefined}
                   isOwner={isCallOwner}
                 />
               ) : null}
             </div>

             {/* Participants Rail */}
             {viewMode !== 'bible' && (
               <div className="flex h-[120px] md:h-[180px] gap-3 md:gap-4 overflow-x-auto no-scrollbar pb-2 min-h-0">
                  {participants.filter(p => p.peerId !== stageParticipant?.peerId).map(p => (
                    <ParticipantThumb
                      key={p.peerId}
                      participant={p}
                      active={activePeerId === p.peerId}
                      speaking={speakingPeerId === p.peerId}
                      networkQuality={peerNetworkQuality.get(p.peerId)}
                      onClick={() => setActivePeerId(p.peerId)}
                    />
                  ))}
               </div>
             )}
          </div>

          {/* Sidebar (Hidden on mobile) */}
          <aside className="hidden md:flex w-[340px] flex-col overflow-hidden rounded-[40px] border border-white/10 bg-[#141829]/40 backdrop-blur-3xl ring-1 ring-white/5 shadow-2xl">
            <div className="p-8 pb-4">
              {/* Sidebar Tabs Switcher */}
              <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/[0.03] border border-white/5 mb-6">
                <button 
                  onClick={() => setSidebarTab('programme')}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'programme' ? 'bg-[#D4FF33] text-black shadow-lg shadow-[#D4FF33]/20' : 'text-white/30 hover:text-white/50'}`}
                >
                    Programme
                </button>
                <button 
                  onClick={() => setSidebarTab('chat')}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'chat' ? 'bg-[#D4FF33] text-black shadow-lg shadow-[#D4FF33]/20' : 'text-white/30 hover:text-white/50'}`}
                >
                    Discussion
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col px-8 gap-6">
               {/* Main Tab Content */}
               <div className="flex-1 flex flex-col overflow-hidden">
                {sidebarTab === 'programme' ? (
                   <div className="flex-1 flex flex-col overflow-hidden">
                       {/* === FONCTIONNALITÉ 5: SONDAGES === */}
                       {activePoll && (
                         <div className="mb-3 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                           <div className="flex items-center justify-between mb-2">
                             <span className="text-[9px] font-black uppercase tracking-widest text-purple-400">Sondage en cours</span>
                             {!activePoll.closed && (
                               <button onClick={onClosePoll} className="text-[8px] font-bold text-purple-300 hover:text-purple-200">Fermer</button>
                             )}
                           </div>
                           <p className="text-xs font-bold text-white/90 mb-2">{activePoll.question}</p>
                           <div className="space-y-1.5">
                             {activePoll.options.map((option, idx) => {
                               const votes = activePoll.votes.get(idx) || [];
                               const totalVotes = Array.from(activePoll.votes.values()).reduce((sum, v) => sum + v.length, 0);
                               const percentage = totalVotes > 0 ? Math.round((votes.length / totalVotes) * 100) : 0;
                               const hasVoted = votes.includes(deviceId);
                               
                               return (
                                 <button
                                   key={idx}
                                   onClick={() => !activePoll.closed && onVotePoll(idx)}
                                   disabled={activePoll.closed}
                                   className={`relative w-full text-left rounded-lg px-3 py-2 transition-all ${
                                     hasVoted ? 'bg-purple-500/30 border border-purple-500/40' : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                   } ${activePoll.closed ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                 >
                                   <div className="flex items-center justify-between">
                                     <span className="text-[10px] font-semibold text-white/80 truncate">{option}</span>
                                     <span className="text-[9px] font-bold text-white/50">{percentage}%</span>
                                   </div>
                                   <div className="absolute inset-0 rounded-lg overflow-hidden">
                                     <div className="h-full bg-purple-500/20 transition-all" style={{ width: `${percentage}%` }} />
                                   </div>
                                 </button>
                               );
                             })}
                           </div>
                           {activePoll.closed && (
                             <p className="text-[8px] font-bold text-purple-300 mt-2 text-center">Sondage terminé • {Array.from(activePoll.votes.values()).reduce((sum, v) => sum + v.length, 0)} votes</p>
                           )}
                         </div>
                       )}

                       {/* Bouton créer sondage */}
                       {!activePoll && (
                         <div className="mb-3">
                           {!showPollCreator ? (
                             <button
                               onClick={() => setShowPollCreator(true)}
                               className="w-full py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-[10px] font-bold text-purple-400 hover:bg-purple-500/20 transition-all"
                             >
                               + Créer un sondage
                             </button>
                           ) : (
                             <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-2">
                               <input
                                 value={pollDraftQuestion}
                                 onChange={(e) => setPollDraftQuestion(e.target.value)}
                                 placeholder="Question..."
                                 className="w-full h-8 rounded-lg bg-white/10 px-3 text-[10px] text-white placeholder:text-white/30 outline-none"
                               />
                               {pollDraftOptions.map((opt, idx) => (
                                 <input
                                   key={idx}
                                   value={opt}
                                   onChange={(e) => {
                                     const newOpts = [...pollDraftOptions];
                                     newOpts[idx] = e.target.value;
                                     setPollDraftOptions(newOpts);
                                   }}
                                   placeholder={`Option ${idx + 1}`}
                                   className="w-full h-7 rounded-lg bg-white/5 px-3 text-[10px] text-white placeholder:text-white/30 outline-none"
                                 />
                               ))}
                               <div className="flex gap-2">
                                 <button
                                   onClick={() => setPollDraftOptions([...pollDraftOptions, ''])}
                                   className="flex-1 h-7 rounded-lg bg-white/5 text-[9px] font-bold text-white/50 hover:bg-white/10"
                                 >
                                   + Option
                                 </button>
                                 <button
                                   onClick={onCreatePoll}
                                   disabled={!pollDraftQuestion.trim() || pollDraftOptions.filter(o => o.trim()).length < 2}
                                   className="flex-1 h-7 rounded-lg bg-purple-500 text-[9px] font-bold text-white disabled:opacity-30"
                                 >
                                   Lancer
                                 </button>
                                 <button
                                   onClick={() => { setShowPollCreator(false); setPollDraftQuestion(''); setPollDraftOptions(['', '']); }}
                                   className="h-7 w-7 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 grid place-items-center"
                                 >
                                   ×
                                 </button>
                               </div>
                             </div>
                           )}
                         </div>
                       )}

                       <div className="mb-4 flex items-center justify-between">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Programme du jour</h4>
                          <span className="text-[9px] font-extrabold text-[#D4FF33]">{sessionTasks.filter(t => t.done).length}/{sessionTasks.length} FINI</span>
                       </div>
                       <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                          {sessionTasks.map((task, index) => (
                            <div 
                              key={task.id} 
                              className={`group flex items-start gap-4 p-3 rounded-2xl transition-all cursor-pointer ${task.active ? 'bg-[#D4FF33]/10 ring-1 ring-[#D4FF33]/20 shadow-lg' : 'hover:bg-white/5'}`}
                              onClick={() => {
                                setSessionTasks(prev => prev.map((t, idx) => ({ 
                                   ...t, 
                                   active: t.id === task.id,
                                   done: idx < index ? true : (t.id === task.id ? t.done : t.done)
                                })));
                              }}
                            >
                               <button className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${task.done ? 'bg-[#D4FF33] border-[#D4FF33]' : 'border-white/20'}`}>
                                  {task.done && <div className="h-2 w-2 rounded-full bg-black" />}
                               </button>
                               <div className="min-w-0">
                                  <span className={`text-[12px] font-black uppercase tracking-wider block mb-0.5 transition-colors truncate ${task.active ? 'text-[#D4FF33]' : (task.done ? 'text-white/20 line-through' : 'text-white/60')}`}>
                                     {task.text}
                                  </span>
                                  {task.active && <span className="text-[9px] font-bold text-white/40 uppercase">Étape actuelle</span>}
                               </div>
                            </div>
                          ))}
                       </div>
                   </div>
                ) : (
                    <div className="flex-1 flex flex-col overflow-hidden">
                       <div className="mb-4">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Chat Direct</h4>
                       </div>
                       <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar mb-4 pr-1">
                          {chatMessages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-20 text-center px-6">
                               <MessageSquareText size={40} className="mb-3" />
                               <p className="text-[10px] font-black uppercase tracking-widest">Soyez le premier à commenter</p>
                            </div>
                          ) : (
                            chatMessages.map(m => (
                              <div key={m.id} className="space-y-1">
                                 <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-[#D4FF33]">{m.displayName}</span>
                                    <span className="text-[8px] font-bold text-white/20">{m.createdAt.slice(11, 16)}</span>
                                 </div>
                                 <p className="text-xs text-white/70 leading-relaxed bg-white/5 p-3 rounded-2xl border border-white/5">
                                   {m.text}
                                 </p>
                              </div>
                            ))
                          )}
                       </div>
                       <div className="relative pb-2">
                          <input 
                             value={chatDraft}
                             onChange={e => setChatDraft(e.target.value)}
                             onKeyDown={e => e.key === 'Enter' && onSendChat()}
                             type="text" 
                             placeholder="Message..." 
                             className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 pr-12 text-xs text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#D4FF33]/50"
                          />
                          <button 
                            onClick={onSendChat}
                            className="absolute right-2 top-2 h-9 w-9 rounded-xl bg-[#D4FF33] text-black grid place-items-center hover:scale-105 active:scale-95 transition-all shadow-lg"
                          >
                             <Send size={16} />
                          </button>
                       </div>
                    </div>
                )}
               </div>

               {/* Speaking Requests (Always visible footer for host control) */}
               <div className="h-[210px] mb-8 flex flex-col overflow-hidden rounded-[32px] border border-white/5 bg-white/[0.01] p-6">
                  <div className="mb-4 flex items-center justify-between">
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Demandes de parole</h4>
                     <span className="rounded-full bg-[#D4FF33]/10 px-2 py-0.5 text-[9px] font-black text-[#D4FF33]">
                        {speakingRequests.filter((participant) => participant.handRaised && !authorizedSpeakers.has(participant.peerId)).length} EN ATTENTE
                     </span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2.5 custom-scrollbar pr-1">
                     {speakingRequests.map(p => {
                        const isAuthorized = authorizedSpeakers.has(p.peerId);
                        return (
                          <div key={p.peerId} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5 transition-all">
                             <div className="flex items-center gap-3 min-w-0">
                                <div className={`h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold ${isAuthorized ? 'ring-2 ring-[#D4FF33] bg-[#D4FF33]/10' : ''}`}>
                                   {initials(p.displayName || 'Guest')}
                                </div>
                                <div className="min-w-0">
                                  <span className="block truncate text-[11px] font-bold text-white">{p.displayName || "Participant"}</span>
                                  <span className="text-[8px] font-black uppercase tracking-widest text-white/30">
                                    {isAuthorized ? 'Micro autorisé' : p.handRaised ? 'Main levée' : 'En écoute'}
                                  </span>
                                </div>
                             </div>
                             <button 
                               onClick={() => authorizeParticipant(p.peerId)}
                               disabled={!isCallOwner}
                               className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase transition-all ${isAuthorized ? 'bg-rose-500/20 text-rose-500 hover:bg-rose-500/30' : 'bg-[#D4FF33] text-black hover:scale-105'} ${!isCallOwner ? 'cursor-not-allowed opacity-50 hover:scale-100' : ''}`}
                             >
                                {isAuthorized ? 'Couper' : 'Autoriser'}
                             </button>
                          </div>
                        );
                     })}
                     {speakingRequests.length === 0 && (
                       <div className="h-full flex flex-col items-center justify-center text-center p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/10">Aucune demande</p>
                          <p className="mt-2 text-[10px] font-medium text-white/25">
                            Les participants apparaissent ici quand ils lèvent la main.
                          </p>
                       </div>
                     )}
                  </div>
               </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile Floating Access Bar */}
      <div className="fixed bottom-6 right-6 z-[80] flex md:hidden items-center gap-3">
        <button 
          onClick={() => setViewMode(prev => prev === 'bible' ? 'grid' : 'bible')}
          className={`h-12 w-12 items-center justify-center rounded-full flex shadow-2xl backdrop-blur-xl transition-all active:scale-95 ${viewMode === 'bible' ? 'bg-[#D4FF33] text-black' : 'bg-white/10 text-white/60 border border-white/10'}`}
        >
          <BookOpen size={20} />
        </button>
        <button 
          onClick={() => { setSidebarTab('chat'); setIsDrawerOpen(true); }}
          className="h-12 w-12 items-center justify-center rounded-full flex shadow-2xl backdrop-blur-xl bg-white/10 text-white/60 border border-white/10 transition-all active:scale-95"
        >
          <MessageSquareText size={20} />
        </button>
        <button 
          onClick={() => { setSidebarTab('programme'); setIsDrawerOpen(true); }}
          className="h-12 w-12 items-center justify-center rounded-full flex shadow-2xl backdrop-blur-xl bg-white/10 text-white/60 border border-white/10 transition-all active:scale-95"
        >
          <Users size={20} />
        </button>
      </div>

      {/* Control Switcher (Bible Mode - Desktop ONLY) */}
      <button 
        onClick={() => setViewMode(prev => prev === 'bible' ? 'grid' : 'bible')}
        className={`hidden md:flex fixed left-10 bottom-10 z-[100] h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95 ${viewMode === 'bible' ? 'bg-[#D4FF33] text-black' : 'bg-white/5 text-white/60 ring-1 ring-white/10 backdrop-blur-xl'}`}
      >
        <BookOpen size={24} />
      </button>

      {/* Mobile Drawer (Drawer style) */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setIsDrawerOpen(false)}
               className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm md:hidden"
            />
            <motion.div 
               initial={{ y: "100%" }}
               animate={{ y: 0 }}
               exit={{ y: "100%" }}
               transition={{ type: "spring", damping: 30, stiffness: 300 }}
               className="fixed inset-x-0 bottom-0 z-[110] flex h-[80vh] flex-col rounded-t-[40px] border-t border-white/10 bg-[#141829] shadow-2xl md:hidden"
            >
               {/* Drag Handle */}
               <div className="flex justify-center p-4">
                  <div className="h-1 w-12 rounded-full bg-white/10" />
               </div>

               <div className="p-6 pt-2">
                  {/* Tabs Switcher in Drawer */}
                  <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/[0.03] border border-white/5">
                    <button 
                      onClick={() => setSidebarTab('programme')}
                      className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'programme' ? 'bg-[#D4FF33] text-black shadow-lg shadow-[#D4FF33]/20' : 'text-white/30'}`}
                    >
                        Programme
                    </button>
                    <button 
                      onClick={() => setSidebarTab('chat')}
                      className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'chat' ? 'bg-[#D4FF33] text-black shadow-lg shadow-[#D4FF33]/20' : 'text-white/30'}`}
                    >
                        Discussion
                    </button>
                  </div>
               </div>

               <div className="flex-1 overflow-hidden px-8 pb-8">
                  {sidebarTab === 'programme' ? (
                     <div className="h-full flex flex-col">
                        <div className="mb-4 flex items-center justify-between">
                           <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Programme</h4>
                           <span className="text-[9px] font-extrabold text-[#D4FF33]">{sessionTasks.filter(t => t.done).length}/{sessionTasks.length} FINI</span>
                        </div>
                        <div className="space-y-3 overflow-y-auto custom-scrollbar">
                           {sessionTasks.map((task, index) => (
                             <div 
                               key={task.id} 
                               className={`flex items-start gap-4 p-3 rounded-2xl ${task.active ? 'bg-[#D4FF33]/10 border border-[#D4FF33]/20' : 'bg-white/5'}`}
                               onClick={() => {
                                 setSessionTasks(prev => prev.map((t, idx) => ({ 
                                    ...t, 
                                    active: t.id === task.id,
                                    done: idx < index ? true : (t.id === task.id ? t.done : t.done)
                                 })));
                               }}
                             >
                                <div className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${task.done ? 'bg-[#D4FF33] border-[#D4FF33]' : 'border-white/20'}`}>
                                   {task.done && <div className="h-2 w-2 rounded-full bg-black" />}
                                </div>
                                <span className={`text-[12px] font-black uppercase tracking-wider ${task.active ? 'text-[#D4FF33]' : (task.done ? 'text-white/20 line-through' : 'text-white/60')}`}>
                                   {task.text}
                                </span>
                             </div>
                           ))}
                        </div>
                     </div>
                  ) : (
                     <div className="h-full flex flex-col">
                        <div className="flex-1 overflow-y-auto space-y-4 mb-4 custom-scrollbar">
                           {chatMessages.length === 0 ? (
                             <div className="h-full flex flex-col items-center justify-center opacity-20">
                                <MessageSquareText size={32} className="mb-2" />
                                <p className="text-[9px] font-black uppercase tracking-widest">Conversation vide</p>
                             </div>
                           ) : (
                             chatMessages.map(m => (
                               <div key={m.id} className="space-y-1">
                                  <div className="flex items-center justify-between">
                                     <span className="text-[9px] font-black uppercase tracking-widest text-[#D4FF33]">{m.displayName}</span>
                                     <span className="text-[8px] font-bold text-white/20">{m.createdAt.slice(11, 16)}</span>
                                  </div>
                                  <p className="text-xs text-white/70 leading-relaxed bg-white/5 p-3 rounded-2xl border border-white/5">
                                    {m.text}
                                  </p>
                               </div>
                             ))
                           )}
                        </div>
                        <div className="relative">
                           <input 
                              value={chatDraft}
                              onChange={e => setChatDraft(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && onSendChat()}
                              type="text" 
                              placeholder="Écrire..." 
                              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 pr-12 text-xs text-white outline-none"
                           />
                           <button 
                             onClick={onSendChat}
                             className="absolute right-2 top-1.5 h-8 w-8 rounded-xl bg-[#D4FF33] text-black grid place-items-center"
                           >
                              <Send size={14} />
                           </button>
                        </div>
                     </div>
                  )}
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {!joined && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-[#0a0c14]/95 backdrop-blur-2xl p-6">
           <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm rounded-[32px] md:rounded-[40px] border border-white/10 bg-white/5 p-8 md:p-12 text-center shadow-2xl ring-1 ring-white/10 overflow-y-auto max-h-[90vh]">
              <div className="mx-auto mb-6 md:mb-10 flex h-20 w-20 md:h-24 md:w-24 items-center justify-center rounded-[24px] md:rounded-[32px] bg-[#D4FF33] text-black shadow-[0_0_30px_rgba(212,255,51,0.3)]"><Mic size={32} className="md:w-[44px]" /></div>
              <h1 className="mb-4 text-2xl md:text-3xl font-black text-white">Prêt à entrer ?</h1>
              <p className="mb-8 md:mb-12 text-sm leading-relaxed text-white/30">Rejoignez vos frères et sœurs pour ce temps d'étude communautaire.</p>
              <div className="flex flex-col gap-4">
                 <button onClick={joinCall} disabled={busy} className="flex h-14 md:h-16 items-center justify-center rounded-2xl md:rounded-3xl bg-[#D4FF33] text-sm font-black uppercase tracking-widest text-black shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50">{busy ? "CONNEXION..." : "Rejoindre maintenant"}</button>
                 {error ? (
                   <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-left text-xs font-medium text-rose-100">
                     {error}
                   </div>
                 ) : null}
                 <div className="flex items-center gap-2 mt-4 rounded-2xl bg-white/5 p-1 ring-1 ring-white/10">
                    <button onClick={() => setLocalVideoEnabled(true)} className={`flex-1 rounded-xl py-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${localVideoEnabled ? 'bg-white/10 text-white shadow-lg' : 'text-white/20'}`}>VIDEO</button>
                    <button onClick={() => setLocalVideoEnabled(false)} className={`flex-1 rounded-xl py-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${!localVideoEnabled ? 'bg-white/10 text-white shadow-lg' : 'text-white/20'}`}>AUDIO SEUL</button>
                 </div>
              </div>
           </motion.div>
        </div>
      )}

      {/* Étude approfondie - accès individuel */}
      <InterlinearViewer
        isOpen={showInterlinear}
        onClose={() => setShowInterlinear(false)}
        bookId={sharedBibleMetadata?.bookId || 'MAT'}
        chapter={sharedBibleMetadata?.chapter || 1}
        verse={sharedBibleMetadata?.verse || 1}
        onStrongSelect={(strong) => {
          setCurrentStrongNumber(strong);
          setShowStrongViewer(true);
        }}
      />
      <BibleStrongViewer
        isOpen={showStrongViewer}
        onClose={() => setShowStrongViewer(false)}
        strongNumber={currentStrongNumber || undefined}
      />
    </section>
  );
}
