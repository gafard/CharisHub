'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  CameraOff,
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
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import BibleReader from './BibleReader';
import { getWebRtcIceServers } from '../lib/webrtc';
import { useI18n } from '../contexts/I18nContext';
import VerseOverlay from './bible/VerseOverlay';
import {
  clearGroupCallPresence,
  logGroupCallEvent,
  upsertGroupCallPresence,
  type CommunityGroupCallEventType,
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
};

type ChatMessage = {
  id: string;
  peerId: string;
  displayName: string;
  text: string;
  createdAt: string;
  mine: boolean;
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
  onClick,
}: {
  participant: CallParticipant;
  active: boolean;
  speaking: boolean;
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
  onToggleAudio,
  onToggleVideo,
  onToggleShare,
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
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleShare: () => void;
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
        <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-[40px] bg-black/50 p-2 backdrop-blur-3xl ring-1 ring-white/10">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleAudio(); }}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${
              localAudioEnabled ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-[#D4FF33] text-black shadow-[0_0_15px_rgba(212,255,51,0.3)]'
            }`}
          >
            {localAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleVideo(); }}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${
              localVideoEnabled ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-[#D4FF33] text-black shadow-[0_0_15px_rgba(212,255,51,0.3)]'
            }`}
          >
            {localVideoEnabled ? <Camera size={20} /> : <CameraOff size={20} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleShare(); }}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${
              localScreenSharing ? 'bg-[#D4FF33] text-black shadow-[0_0_15px_rgba(212,255,51,0.3)]' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <ScreenShare size={20} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onLeave(); }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500 text-white shadow-xl hover:bg-rose-600 active:scale-95 transition-all"
          >
            <Phone size={20} className="rotate-[135deg]" />
          </button>
        </div>
      )}

      {/* Floating Meta Labels */}
      <div className="absolute left-6 top-6 flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-2 backdrop-blur-xl ring-1 ring-white/5">
          {participant?.isLocal && (
             <div className="h-6 w-6 overflow-hidden rounded-full border border-white/20 bg-white/10">
               <div className="flex h-full w-full items-center justify-center text-[8px] font-black">{initials(name)}</div>
             </div>
          )}
          <span className="text-xs font-bold text-white/90">{name}</span>
        </div>
        {speaking && (
           <div className="flex items-center gap-2 rounded-full bg-[#D4FF33] px-3 py-1 text-[9px] font-black uppercase tracking-wider text-black">
             <Mic size={10} /> EN PAROLE
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
  onClose,
  initialTasks = [],
}: {
  groupId: string;
  deviceId: string;
  displayName: string;
  onClose?: () => void;
  initialTasks?: string[];
}) {
  const { t } = useI18n();
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(false);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(true);
  const [localScreenSharing, setLocalScreenSharing] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'programme' | 'chat'>('programme');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [chatTab, setChatTab] = useState<ChatTab>('chat');
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
  const videoSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const joinedAtRef = useRef('');

  const participantCount = remotePeers.length + (joined ? 1 : 0);

  const participants = useMemo<CallParticipant[]>(() => {
    const local = {
      peerId: 'local',
      displayName: t('community.groups.callYou'),
      audioEnabled: localAudioEnabled,
      videoEnabled: localScreenSharing ? true : localVideoEnabled,
      stream: localStream,
      isLocal: true,
    };
    const remotes = remotePeers.map(p => ({ ...p, isLocal: false }));
    return [local, ...remotes];
  }, [localAudioEnabled, localScreenSharing, localStream, localVideoEnabled, remotePeers, t]);

  const activeParticipant = participants.find(p => p.peerId === activePeerId) || participants[0] || null;
  const stageParticipant = screenSharePeerId ? participants.find(p => p.peerId === screenSharePeerId) || activeParticipant : activeParticipant;

  const sendBroadcast = useCallback(async (event: string, payload: any) => {
    if (channelRef.current) await channelRef.current.send({ type: 'broadcast', event, payload });
  }, []);

  const leaveCall = useCallback(async () => {
    joinedAtRef.current = '';
    setJoined(false);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    for (const pc of peerConnectionsRef.current.values()) pc.close();
    peerConnectionsRef.current.clear();
    videoSendersRef.current.clear();
    setRemotePeers([]);
    if (groupId && deviceId) await clearGroupCallPresence(groupId, deviceId);
  }, [deviceId, groupId]);

  const onToggleAudio = useCallback(() => {
    setLocalAudioEnabled(p => !p);
  }, [localAudioEnabled]);

  const onToggleVideo = useCallback(() => {
    setLocalVideoEnabled(p => !p);
  }, [localVideoEnabled]);

  const onToggleShare = useCallback(() => {
    setScreenSharePeerId(prev => (prev === 'local' ? null : 'local'));
  }, []);

  const onToggleHand = useCallback(() => {
    setIsHandRaised(prev => !prev);
  }, []);

  const authorizeParticipant = useCallback((peerId: string) => {
    setAuthorizedSpeakers(prev => {
        const next = new Set(prev);
        if (next.has(peerId)) next.delete(peerId);
        else next.add(peerId);
        return next;
    });
  }, []);

  const onSendChat = () => {
    if (!chatDraft.trim()) return;
    const msg: ChatMessage = {
      id: makeId('msg'),
      peerId: 'local',
      displayName: displayName || t('identity.guest'),
      text: chatDraft,
      createdAt: new Date().toISOString(),
      mine: true,
    };
    setChatMessages(prev => [...prev, msg]);
    setChatDraft('');
  };

  const joinCall = async () => {
    setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true }, 
        video: localVideoEnabled 
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setJoined(true);
      joinedAtRef.current = new Date().toISOString();

      // Create signaling channel
      const channel = supabase.channel(`call_room:${groupId || 'default'}`, {
        config: { presence: { key: deviceId || 'local' } }
      });
      channelRef.current = channel;

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const pList: any[] = [];
          Object.values(state).forEach((pres: any) => {
            pres.forEach((p: any) => {
              if (p.peerId !== deviceId) pList.push(p);
            });
          });
          // Update remote peers list from presence
          setRemotePeers(prev => {
             const next = [...prev];
             pList.forEach(p => {
                if (!next.find(rp => rp.peerId === p.peerId)) {
                   next.push({ ...p, stream: null });
                   // Initiate connection for new peers
                   createOffer(p.peerId);
                }
             });
             return next;
          });
        })
        .on('broadcast', { event: 'signal' }, async ({ payload }: { payload: any }) => {
          const { from, type, signal } = payload;
          if (payload.to !== deviceId) return;

          if (type === 'offer') await handleOffer(from, signal);
          else if (type === 'answer') await handleAnswer(from, signal);
          else if (type === 'ice-candidate') await handleIceCandidate(from, signal);
        })
        .on('broadcast', { event: 'ui_sync' }, ({ payload }: { payload: any }) => {
           // Sync hand state or host authorizations
           if (payload.type === 'hand' && payload.peerId !== deviceId) {
              setRemotePeers(prev => prev.map(p => p.peerId === payload.peerId ? { ...p, handRaised: payload.active } : p));
           }
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              peerId: deviceId,
              displayName: displayName || t('identity.guest'),
              audioEnabled: localAudioEnabled,
              videoEnabled: localVideoEnabled,
              joinedAt: joinedAtRef.current
            });
            if (groupId && deviceId) {
                await upsertGroupCallPresence({
                  groupId,
                  deviceId,
                  displayName: displayName || t('identity.guest'),
                  audioEnabled: localAudioEnabled,
                  videoEnabled: localVideoEnabled
                });
                await logGroupCallEvent({ groupId, deviceId, displayName: displayName || t('identity.guest'), eventType: 'join' });
            }
          }
        });

    } catch (e) {
      setError(t('community.groups.callPermissionError'));
    } finally {
      setBusy(false);
    }
  };

  const createOffer = async (targetPeerId: string) => {
    if (peerConnectionsRef.current.has(targetPeerId)) return;
    const pc = createPeerConnection(targetPeerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendBroadcast('signal', { from: deviceId, to: targetPeerId, type: 'offer', signal: offer });
  };

  const handleOffer = async (from: string, offer: RTCSessionDescriptionInit) => {
    const pc = createPeerConnection(from);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendBroadcast('signal', { from: deviceId, to: from, type: 'answer', signal: answer });
  };

  const handleAnswer = async (from: string, answer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionsRef.current.get(from);
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
  };

  const handleIceCandidate = async (from: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionsRef.current.get(from);
    if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
  };

  const createPeerConnection = (targetPeerId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnectionsRef.current.set(targetPeerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendBroadcast('signal', { from: deviceId, to: targetPeerId, type: 'ice-candidate', signal: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      setRemotePeers(prev => prev.map(p => p.peerId === targetPeerId ? { ...p, stream: event.streams[0] } : p));
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
    }

    return pc;
  };

  useEffect(() => {
     if (joined && isHandRaised) {
        sendBroadcast('ui_sync', { type: 'hand', peerId: deviceId, active: true });
     } else if (joined) {
        sendBroadcast('ui_sync', { type: 'hand', peerId: deviceId, active: false });
     }
  }, [isHandRaised, joined, deviceId]);

  useEffect(() => {
     document.body.classList.add('group-call-active');
     return () => { 
        document.body.classList.remove('group-call-active'); 
        if (channelRef.current) channelRef.current.unsubscribe();
        leaveCall(); 
     };
  }, [leaveCall]);

  return (
    <section className="relative flex h-screen w-screen overflow-hidden bg-[#1a1c24] transition-all duration-700">
      
      <div className="relative z-10 flex flex-1 flex-col p-6 lg:p-10">
        
        {/* Floating Header */}
        <motion.header 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mx-auto flex w-full max-w-6xl items-center justify-between rounded-[40px] border border-white/10 bg-white/[0.03] px-8 py-5 backdrop-blur-3xl ring-1 ring-white/5"
        >
          <div className="flex items-center gap-6">
            <button onClick={onClose} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-all">
              <ChevronLeft size={24} />
            </button>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white/95 uppercase">{activeTask?.text}</h2>
              <p className="text-[11px] font-medium text-white/40">Session de Groupe • {displayName || "Disciple"}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 rounded-full bg-white/5 px-5 py-2 ring-1 ring-white/10">
               <Link2 size={16} className="text-white/30 " />
               <span className="text-[12px] font-mono font-medium text-white/60 tracking-wider font-bold">MODE-ÉTUDE</span>
            </div>
            <div className="flex -space-x-3">
               {participants.map((p, i) => (
                 <div key={p.peerId} className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#1a1c24] bg-slate-700 text-[10px] font-black text-white shadow-xl" style={{ zIndex: 10 - i }}>
                   {initials(p.displayName)}
                 </div>
               ))}
            </div>
          </div>
        </motion.header>

        {/* Main Area */}
        <div className="mt-8 flex flex-1 gap-8 min-h-0 overflow-hidden">
          
          {/* Stage */}
          <div className="flex flex-[2.8] flex-col gap-8 min-w-0 relative">
             <div className="flex-1 flex min-h-0 relative bg-black/20 rounded-[32px] overflow-hidden border border-white/10 shadow-2xl">
               {viewMode === 'bible' ? (
                  <div className="relative flex flex-1 flex-col min-h-0">
                     {/* Floating Video for Speaker (PIP Mode) */}
                     <StageVideo 
                       participant={stageParticipant}
                       speaking={speakingPeerId === stageParticipant?.peerId}
                       screenSharing={localScreenSharing}
                       shareViewMode={shareViewMode}
                       localAudioEnabled={localAudioEnabled}
                       localVideoEnabled={localVideoEnabled}
                       localScreenSharing={localScreenSharing}
                       onToggleAudio={onToggleAudio}
                       onToggleVideo={onToggleVideo}
                       onToggleShare={onToggleShare}
                       onLeave={leaveCall}
                       isLocalHost={true}
                       isPip={true}
                     />
                     <div className="flex-1 min-h-0 flex flex-col relative w-full h-full">
                        <BibleReader embedded={true} onSyncBible={(r, c) => { setSharedBibleRef(r); setSharedBibleContent(c); }} />
                     </div>
                  </div>
               ) : (
                 <StageVideo 
                   participant={stageParticipant}
                   speaking={speakingPeerId === stageParticipant?.peerId}
                   screenSharing={localScreenSharing}
                   shareViewMode={shareViewMode}
                   localAudioEnabled={localAudioEnabled}
                   localVideoEnabled={localVideoEnabled}
                   localScreenSharing={localScreenSharing}
                   onToggleAudio={onToggleAudio}
                   onToggleVideo={onToggleVideo}
                   onToggleShare={onToggleShare}
                   onLeave={leaveCall}
                   isLocalHost={true}
                 />
               )}
             </div>

             {/* Participants Rail */}
             {viewMode !== 'bible' && (
               <div className="flex h-[180px] gap-4 overflow-x-auto no-scrollbar pb-2 min-h-0">
                  {participants.filter(p => p.peerId !== stageParticipant?.peerId).map(p => (
                    <ParticipantThumb 
                      key={p.peerId}
                      participant={p}
                      active={activePeerId === p.peerId}
                      speaking={speakingPeerId === p.peerId}
                      onClick={() => setActivePeerId(p.peerId)}
                    />
                  ))}
               </div>
             )}
          </div>

          {/* Sidebar */}
          <aside className="flex w-[340px] flex-col overflow-hidden rounded-[40px] border border-white/10 bg-[#141829]/40 backdrop-blur-3xl ring-1 ring-white/5 shadow-2xl">
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
                        {participants.filter(p => !authorizedSpeakers.has(p.peerId) && p.peerId !== 'local').length} EN ATTENTE
                     </span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2.5 custom-scrollbar pr-1">
                     {participants.filter(p => p.peerId !== 'local').map(p => {
                        const isAuthorized = authorizedSpeakers.has(p.peerId);
                        return (
                          <div key={p.peerId} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5 transition-all">
                             <div className="flex items-center gap-3 min-w-0">
                                <div className={`h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold ${isAuthorized ? 'ring-2 ring-[#D4FF33] bg-[#D4FF33]/10' : ''}`}>
                                   {initials(p.displayName || 'Guest')}
                                </div>
                                <span className="text-[11px] font-bold text-white truncate">{p.displayName || "Participant"}</span>
                             </div>
                             <button 
                               onClick={() => authorizeParticipant(p.peerId)}
                               className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase transition-all ${isAuthorized ? 'bg-rose-500/20 text-rose-500 hover:bg-rose-500/30' : 'bg-[#D4FF33] text-black hover:scale-105'}`}
                             >
                                {isAuthorized ? 'Couper' : 'Autoriser'}
                             </button>
                          </div>
                        );
                     })}
                     {participants.filter(p => p.peerId !== 'local').length === 0 && (
                       <div className="h-full flex flex-col items-center justify-center text-center p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/10">Aucune demande</p>
                       </div>
                     )}
                  </div>
               </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Control Switcher (Bible Mode) */}
      <button 
        onClick={() => setViewMode(prev => prev === 'bible' ? 'grid' : 'bible')}
        className={`fixed left-10 bottom-10 z-[100] h-14 w-14 items-center justify-center rounded-full flex shadow-2xl transition-all hover:scale-110 active:scale-95 ${viewMode === 'bible' ? 'bg-[#D4FF33] text-black' : 'bg-white/5 text-white/60 ring-1 ring-white/10 backdrop-blur-xl'}`}
      >
        <BookOpen size={24} />
      </button>

      {!joined && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-[#0a0c14]/95 backdrop-blur-2xl">
           <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm rounded-[40px] border border-white/10 bg-white/5 p-12 text-center shadow-2xl ring-1 ring-white/10">
              <div className="mx-auto mb-10 flex h-24 w-24 items-center justify-center rounded-[32px] bg-[#D4FF33] text-black shadow-[0_0_30px_rgba(212,255,51,0.3)]"><Mic size={44} /></div>
              <h1 className="mb-4 text-3xl font-black text-white">Prêt à entrer ?</h1>
              <p className="mb-12 text-sm leading-relaxed text-white/30">Rejoignez vos frères et sœurs pour ce temps d'étude communautaire.</p>
              <div className="flex flex-col gap-4">
                 <button onClick={joinCall} disabled={busy} className="flex h-16 items-center justify-center rounded-3xl bg-[#D4FF33] text-sm font-black uppercase tracking-widest text-black shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50">{busy ? "CONNEXION..." : "Rejoindre maintenant"}</button>
                 <div className="flex items-center gap-2 mt-4 rounded-2xl bg-white/5 p-1 ring-1 ring-white/10">
                    <button onClick={() => setLocalVideoEnabled(true)} className={`flex-1 rounded-xl py-3 text-[10px] font-black uppercase tracking-widest transition-all ${localVideoEnabled ? 'bg-white/10 text-white shadow-lg' : 'text-white/20'}`}>VIDEO ACTIVÉE</button>
                    <button onClick={() => setLocalVideoEnabled(false)} className={`flex-1 rounded-xl py-3 text-[10px] font-black uppercase tracking-widest transition-all ${!localVideoEnabled ? 'bg-white/10 text-white shadow-lg' : 'text-white/20'}`}>AUDIO SEUL</button>
                 </div>
              </div>
           </motion.div>
        </div>
      )}

    </section>
  );
}
