'use client';

import logger from '@/lib/logger';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useCommunityIdentity } from '../lib/useCommunityIdentity';
import { fetchGroups, respondToGroupCallInvitation } from './communityApi';
import IncomingGroupCallModal from './IncomingGroupCallModal';
import { releaseAudioFocus } from '../lib/audioFocus';
import { sendNotification } from './notifications';

type IncomingCallPayload = {
    callId: string;
    groupId: string;
    startedBy: string;
    startedByUserName: string;
    groupName?: string;
    startedAt?: string;
};

export default function GlobalCallManager() {
    const router = useRouter();
    const { identity } = useCommunityIdentity();
    const deviceId = identity?.deviceId;
    const userId = identity?.userId;
    const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);

    const ringtoneAudioRef = useRef<HTMLAudioElement | AudioContext | null>(null);
    const ringingIntervalRef = useRef<number | null>(null);
    const recentInviteRef = useRef<Record<string, number>>({});

    // ── STOP RINGING ──
    const stopRinging = useCallback(() => {
        if (ringingIntervalRef.current) {
            clearInterval(ringingIntervalRef.current);
            ringingIntervalRef.current = null;
        }
        if (ringtoneAudioRef.current) {
            const audio = ringtoneAudioRef.current as any;
            if (typeof audio.pause === 'function') {
                audio.pause();
                audio.currentTime = 0;
            } else if (typeof audio.close === 'function') {
                audio.close().catch(() => {});
            }
            ringtoneAudioRef.current = null;
        }
    }, []);

    const playRingtonePattern = useCallback((ctx: AudioContext) => {
        const playTone = () => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.setValueAtTime(480, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
            gain.gain.setValueAtTime(0.15, ctx.currentTime + 0.3);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
        };
        playTone();
        ringingIntervalRef.current = window.setInterval(playTone, 1500);
    }, []);

    // ── START RINGING ──
    const startRingingWithWebAudio = useCallback(() => {
        if (ringtoneAudioRef.current) return;

        try {
            const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextCtor) return;
            
            const ctx = new AudioContextCtor();
            
            // Vérifier si le contexte est suspended (bloqué par le navigateur)
            if (ctx.state === 'suspended') {
                logger.warn('[GlobalCallManager] Web Audio suspendu. Tentative de reprise...');
                ctx.resume().catch(() => {});
            }

            playRingtonePattern(ctx);
            ringtoneAudioRef.current = ctx as any;

            // Auto-stop après 30s
            setTimeout(stopRinging, 30000);
        } catch (e) {
            console.error('[GlobalCallManager] Erreur Web Audio fallback:', e);
        }
    }, [stopRinging, playRingtonePattern]);

    // ── GLOABL UNLOCK ──
    // Resumer l'AudioContext au premier clic utilisateur (nécessaire pour les navigateurs)
    useEffect(() => {
        const resumeAudio = () => {
            // Créer un contexte temporaire juste pour le "réveiller"
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            if (ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }
            logger.log('[GlobalCallManager] AudioContext unlocked by user interaction');
            window.removeEventListener('click', resumeAudio);
            window.removeEventListener('touchstart', resumeAudio);
            window.removeEventListener('keydown', resumeAudio);
        };
        window.addEventListener('click', resumeAudio);
        window.addEventListener('touchstart', resumeAudio);
        window.addEventListener('keydown', resumeAudio);
        return () => {
            window.removeEventListener('click', resumeAudio);
            window.removeEventListener('touchstart', resumeAudio);
            window.removeEventListener('keydown', resumeAudio);
        };
    }, []);

    const startRinging = useCallback(() => {
        if (ringtoneAudioRef.current) return;

        try {
            // Essayer d'abord avec un fichier audio (plus fiable)
            const audio = new Audio('/sounds/ringtone.wav');
            audio.loop = true;
            audio.volume = 0.8;

            audio.onerror = () => {
                logger.warn('[GlobalCallManager] ringtone.wav non trouvé, fallback Web Audio');
                // Fallback Web Audio API
                try {
                    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
                    if (!Ctor) return;
                    const ctx = new Ctor();
                    ringtoneAudioRef.current = ctx;

                    const playTone = () => {
                        if (!ringtoneAudioRef.current) return;
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(440, ctx.currentTime);
                        osc.frequency.setValueAtTime(480, ctx.currentTime + 0.15);
                        gain.gain.setValueAtTime(0, ctx.currentTime);
                        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
                        gain.gain.setValueAtTime(0.15, ctx.currentTime + 0.3);
                        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
                        osc.start(ctx.currentTime);
                        osc.stop(ctx.currentTime + 0.5);
                    };
                    playTone();
                    ringingIntervalRef.current = window.setInterval(playTone, 1500);
                    setTimeout(stopRinging, 30000);
                } catch (e2) {
                    logger.error('[GlobalCallManager] Web Audio fallback failed:', e2);
                }
            };

            const playPromise = audio.play();
            if (playPromise) {
                playPromise.catch(() => {
                    logger.warn('[GlobalCallManager] Autoplay blocked, waiting for interaction');
                    const resume = () => {
                        audio.play().catch(() => {});
                        window.removeEventListener('click', resume);
                        window.removeEventListener('touchstart', resume);
                    };
                    window.addEventListener('click', resume, { once: true });
                    window.addEventListener('touchstart', resume, { once: true });
                });
            }
            ringtoneAudioRef.current = audio;
            setTimeout(() => {
                if (ringtoneAudioRef.current === audio) stopRinging();
            }, 30000);
        } catch (e) {
            logger.error('[GlobalCallManager] Erreur sonnerie:', e);
        }
    }, [stopRinging]);

    // ── REACT TO incomingCall STATE ──
    useEffect(() => {
        if (incomingCall) {
            document.body.classList.add('group-call-incoming-active');
            releaseAudioFocus();
            startRinging();
        } else {
            document.body.classList.remove('group-call-incoming-active');
            stopRinging();
        }
        return () => {
            document.body.classList.remove('group-call-incoming-active');
            stopRinging();
        };
    }, [incomingCall, startRinging, stopRinging]);

    // ── LISTEN FOR CALL INVITES ON ALL JOINED GROUPS ──
    useEffect(() => {
        if (!deviceId || !supabase) return;
        const client = supabase;

        const channels: ReturnType<NonNullable<typeof supabase>['channel']>[] = [];
        let active = true;

        const setupListeners = async () => {
            try {
                // Cleanup previous channels
                channels.forEach(ch => client.removeChannel(ch));
                channels.length = 0;

                logger.log('[GlobalCallManager] Fetching groups for device:', deviceId, 'user:', userId);
                const groups = await fetchGroups(40, deviceId, userId);
                if (!active) return;
                logger.log('[GlobalCallManager] Groups fetched:', groups.length);

                if (groups.length === 0) {
                    logger.warn('[GlobalCallManager] No groups found.');
                    return;
                }

                // S'abonner à TOUS les groupes visibles, pas seulement les "joined"
                // Un utilisateur qui voit un groupe devrait pouvoir recevoir les appels
                const targetGroups = groups.filter(
                    (g) => g.joined || g.created_by_device_id === deviceId || 
                           (userId && g.created_by_device_id === userId)
                );

                if (targetGroups.length === 0) {
                    logger.log('[GlobalCallManager] No target groups. Listening on ALL visible groups as fallback.');
                }

                const groupsToListen = targetGroups.length > 0 ? targetGroups : groups;

                groupsToListen.forEach(group => {
                    // Utiliser un nom de canal unique pour l'écouteur (avec un suffixe)
                    // pour éviter le conflit avec le canal de l'émetteur
                    const channelNames = [`group-call:${group.id}`, `group:${group.id}`];

                    channelNames.forEach((channelName) => {
                        logger.log('[GlobalCallManager] Subscribing to:', channelName);
                        const channel = client.channel(channelName);

                        // Diagnostics
                        if (typeof window !== 'undefined') {
                            const st = (window as any).__callSystemStatus || { channels: {}, deviceId, userId };
                            st.channels[channelName] = 'subscribing';
                            st.deviceId = deviceId;
                            st.userId = userId;
                            (window as any).__callSystemStatus = st;
                        }

                        // @ts-ignore
                        channel.on('broadcast', { event: 'call.invite' }, ({ payload: raw }) => {
                            if (!raw) return;
                            const callId = String(raw.callId || group.id);
                            const startedBy = String(raw.startedBy || '');

                            if (!startedBy) return;
                            // Ignorer ses propres appels (par deviceId OU userId)
                            if (startedBy === deviceId) return;
                            if (userId && raw.callerUserId === userId) {
                                logger.log('[GlobalCallManager] Ignoring own call (by userId)');
                                return;
                            }

                            // Anti-doublon
                            const key = `${callId}:${startedBy}`;
                            const now = Date.now();
                            if (now - (recentInviteRef.current[key] || 0) < 5000) return;
                            recentInviteRef.current[key] = now;

                            logger.log('[GlobalCallManager] 📞 INCOMING CALL:', raw);

                            setIncomingCall({
                                callId,
                                groupId: group.id,
                                startedBy,
                                // Accepter TOUS les noms de champs possibles
                                startedByUserName: String(
                                    raw.callerName || raw.startedByUserName || 
                                    raw.callerDisplayName || 'Un membre'
                                ),
                                groupName: String(raw.groupName || group.name || 'Groupe'),
                                startedAt: String(raw.startedAt || new Date().toISOString()),
                            });

                            void sendNotification({
                                title: `📞 Appel: ${String(raw.groupName || group.name || 'Groupe')}`,
                                body: `${String(raw.callerName || raw.startedByUserName || 'Un membre')} vous invite`,
                                tag: `group-call-${callId}`,
                                url: `/groups?group=${encodeURIComponent(group.id)}&call=${encodeURIComponent(callId)}&autoJoin=true`,
                                icon: '/globe.svg',
                            });
                        });

                        channel.subscribe((status: string) => {
                            logger.log(`[GlobalCallManager] 📡 ${channelName}: ${status}`);
                            if (typeof window !== 'undefined') {
                                const st = (window as any).__callSystemStatus || { channels: {} };
                                st.channels[channelName] = status;
                                (window as any).__callSystemStatus = st;
                            }
                        });
                        channels.push(channel);
                    });
                });

                logger.log(`[GlobalCallManager] ✅ Listening on ${groupsToListen.length} groups`);
            } catch (e) {
                console.error('[GlobalCallManager] Setup error:', e);
            }
        };

        setupListeners();

        // Rafraîchir toutes les 2 minutes et au retour de l'onglet
        const refreshInterval = setInterval(setupListeners, 120000);
        const onFocus = () => setupListeners();
        window.addEventListener('focus', onFocus);

        return () => {
            active = false;
            clearInterval(refreshInterval);
            window.removeEventListener('focus', onFocus);
            channels.forEach(ch => client.removeChannel(ch));
            stopRinging();
        };
    }, [deviceId, userId, startRinging, stopRinging]);

    if (!incomingCall) return null;

    return (
        <IncomingGroupCallModal
            open={!!incomingCall}
            call={{
                callId: incomingCall.callId,
                groupId: incomingCall.groupId,
                fromName: incomingCall.startedByUserName,
                groupName: incomingCall.groupName || 'Appel de groupe',
                startedAt: incomingCall.startedAt,
            }}
            onJoin={async (call) => {
                stopRinging();
                const effectiveId = identity?.userId || deviceId;
                if (effectiveId) {
                    await respondToGroupCallInvitation(call.callId, effectiveId, 'accept');
                }
                router.push(`/groups?group=${encodeURIComponent(call.groupId)}&call=${encodeURIComponent(call.callId)}&autoJoin=true`);
                setIncomingCall(null);
            }}
            onDismiss={async (call) => {
                stopRinging();
                const effectiveId = identity?.userId || deviceId;
                if (effectiveId) {
                    await respondToGroupCallInvitation(call.callId, effectiveId, 'decline');
                }
                setIncomingCall(null);
            }}
            enableVibrate={true}
        />
    );
}
