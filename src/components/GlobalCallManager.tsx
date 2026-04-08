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
    startedBy: string; // Device ID
    startedByUserName: string;
    groupName?: string;
    startedAt?: string;
};

type InviteEventPayload = {
    callId?: string;
    startedBy?: string;
    startedByUserName?: string;
    groupName?: string;
    startedAt?: string;
};

export default function GlobalCallManager() {
    const router = useRouter();
    const { identity } = useCommunityIdentity();
    const deviceId = identity?.deviceId;
    const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);

    // Référence pour l'audio de sonnerie (fichier audio standard)
    const ringtoneAudioRef = useRef<HTMLAudioElement | null>(null);
    const ringingIntervalRef = useRef<number | null>(null);
    const recentInviteRef = useRef<Record<string, number>>({});

    const stopRinging = useCallback(() => {
        if (ringingIntervalRef.current) {
            clearInterval(ringingIntervalRef.current);
            ringingIntervalRef.current = null;
        }
        if (ringtoneAudioRef.current) {
            // Vérifier si c'est un HTMLAudioElement ou un AudioContext
            const audio = ringtoneAudioRef.current as any;
            if (audio.pause) {
                // C'est un HTMLAudioElement
                audio.pause();
                audio.currentTime = 0;
            } else if (audio.close) {
                // C'est un AudioContext (fallback Web Audio)
                audio.close().catch(() => {});
            }
            ringtoneAudioRef.current = null;
        }
    }, []);

    // Jouer un motif de sonnerie téléphonique classique (Web Audio fallback)
    const playRingtonePattern = useCallback((ctx: AudioContext) => {
        const playTone = () => {
            if (!ringtoneAudioRef.current) return;
            
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            // Motif de sonnerie téléphonique : 440Hz + 480Hz
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.setValueAtTime(480, ctx.currentTime + 0.1);

            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
            gain.gain.setValueAtTime(0.15, ctx.currentTime + 0.25);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);

            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
        };

        playTone();
        ringingIntervalRef.current = window.setInterval(playTone, 1500);
    }, []);

    // Fallback : sonnerie avec Web Audio API (nécessite interaction utilisateur)
    const startRingingWithWebAudio = useCallback(() => {
        if (ringtoneAudioRef.current) return;

        try {
            const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextCtor) return;
            
            const ctx = new AudioContextCtor();
            
            // Vérifier si le contexte est suspended (bloqué par le navigateur)
            if (ctx.state === 'suspended') {
                console.warn('[GlobalCallManager] Web Audio suspendu. En attente d\'interaction utilisateur...');
                
                const resumeAndRing = () => {
                    ctx.resume().then(() => {
                        playRingtonePattern(ctx);
                        ringtoneAudioRef.current = ctx as any;
                    }).catch(() => {});
                    
                    window.removeEventListener('click', resumeAndRing);
                    window.removeEventListener('touchstart', resumeAndRing);
                };
                
                window.addEventListener('click', resumeAndRing, { once: true });
                window.addEventListener('touchstart', resumeAndRing, { once: true });
                return;
            }

            playRingtonePattern(ctx);
            ringtoneAudioRef.current = ctx as any;

            // Auto-stop après 30s
            setTimeout(stopRinging, 30000);
        } catch (e) {
            console.error('[GlobalCallManager] Erreur Web Audio fallback:', e);
        }
    }, [stopRinging, playRingtonePattern]);

    // Démarrer la sonnerie avec un fichier audio standard
    const startRinging = useCallback(() => {
        if (ringtoneAudioRef.current) return; // Déjà en train de sonner

        try {
            // Utiliser un fichier audio standard (plus fiable que Web Audio API)
            const audio = new Audio('/sounds/ringtone.wav');
            audio.loop = true;
            audio.volume = 0.7;
            
            // Gérer les erreurs de lecture
            audio.onerror = () => {
                console.warn('[GlobalCallManager] ringtone.wav non trouvé, utilisation du fallback Web Audio');
                // Fallback : utiliser Web Audio API si le fichier n'existe pas
                startRingingWithWebAudio();
            };

            // Essayer de jouer le son
            const playPromise = audio.play();
            
            if (playPromise !== undefined) {
                playPromise.catch((error) => {
                    // Si l'autoplay est bloqué, on réessaiera au prochain clic utilisateur
                    console.warn('[GlobalCallManager] Sonnerie bloquée (autoplay policy). Interaction utilisateur requise.');
                    
                    // Ajouter un listener one-shot pour jouer au prochain clic
                    const playOnInteraction = () => {
                        if (ringtoneAudioRef.current && incomingCall) {
                            ringtoneAudioRef.current.play().catch(() => {});
                        }
                        window.removeEventListener('click', playOnInteraction);
                        window.removeEventListener('touchstart', playOnInteraction);
                    };
                    
                    window.addEventListener('click', playOnInteraction, { once: true });
                    window.addEventListener('touchstart', playOnInteraction, { once: true });
                });
            }

            ringtoneAudioRef.current = audio;

            // Auto-stop après 30s pour ne pas sonner indéfiniment
            setTimeout(() => {
                if (ringtoneAudioRef.current === audio) {
                    stopRinging();
                }
            }, 30000);
        } catch (e) {
            console.error('[GlobalCallManager] Erreur sonnerie:', e);
        }
    }, [stopRinging, incomingCall, startRingingWithWebAudio]);

    useEffect(() => {
        if (incomingCall) {
            document.body.classList.add('group-call-incoming-active');
            releaseAudioFocus();
            // Start ringing immediately if context was already resumed
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

    // 1. Écouter les invitations sur TOUS les groupes de l'utilisateur
    useEffect(() => {
        if (!deviceId || !supabase) return;
        const client = supabase;

        const channels: ReturnType<NonNullable<typeof supabase>['channel']>[] = [];
        let active = true;

        const setupListeners = async () => {
            try {
                // Cleanup previous channels to avoid duplicate listeners
                channels.forEach(ch => client.removeChannel(ch));
                channels.length = 0;

                const userId = identity?.userId || null;
                logger.log('[GlobalCallManager] Fetching groups for device:', deviceId, 'user:', userId);
                const groups = await fetchGroups(40, deviceId, userId);
                if (!active) return;
                logger.log('[GlobalCallManager] Groups fetched:', groups.length, groups.map(g => g.id));

                if (groups.length === 0) {
                    logger.warn('[GlobalCallManager] No groups found. User will not receive calls.');
                }

                // Only subscribe to groups where the user is effectively a member.
                const joinedGroups = groups.filter(
                    (group) => group.joined || group.created_by_device_id === deviceId
                );
                if (joinedGroups.length === 0) {
                    logger.log('[GlobalCallManager] No joined groups. Skipping call listeners.');
                    return;
                }

                joinedGroups.forEach(group => {
                    const channelNames = [`group-call:${group.id}`, `group:${group.id}`];

                    channelNames.forEach((channelName) => {
                        logger.log('[GlobalCallManager] Subscribing to channel:', channelName);
                        const channel = client.channel(channelName);
                        
                        // Update global status for diagnostics
                        if (typeof window !== 'undefined') {
                            const statusObj = (window as any).__callSystemStatus || { channels: {} };
                            statusObj.channels[channelName] = 'subscribing';
                            (window as any).__callSystemStatus = statusObj;
                        }
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-ignore
                        channel.on('broadcast', { event: 'call.invite' }, ({ payload }) => {
                            const raw = (payload ?? {}) as InviteEventPayload;
                            const callId = String(raw.callId || group.id);
                            const startedBy = String(raw.startedBy || '');

                            if (!startedBy) return;
                            if (startedBy === deviceId) {
                                logger.log('[GlobalCallManager] Ignoring own call');
                                return;
                            }

                            const dedupeKey = `${callId}:${startedBy}`;
                            const now = Date.now();
                            const lastSeen = recentInviteRef.current[dedupeKey] || 0;
                            if (now - lastSeen < 1800) {
                                return;
                            }
                            recentInviteRef.current[dedupeKey] = now;

                            logger.log('[GlobalCallManager] 📞 EVENT RECEIVED:', raw);
                            logger.log('[GlobalCallManager] 🔔 RINGER TRIGGERED for call:', callId);
                            setIncomingCall((prev) => {
                                if (prev?.callId === callId) return prev;
                                return {
                                    callId,
                                    groupId: group.id,
                                    startedBy,
                                    startedByUserName: String(raw.startedByUserName || 'Un membre'),
                                    groupName: String(raw.groupName || group.name || 'Groupe'),
                                    startedAt: String(raw.startedAt || new Date().toISOString()),
                                };
                            });
                            // La sonnerie est déclenchée par l'useEffect réagissant à incomingCall
                            
                            void sendNotification({
                                title: `Appel de groupe: ${String(raw.groupName || group.name || 'Communaute')}`,
                                body: `${String(raw.startedByUserName || 'Un membre')} vous invite a rejoindre l'appel`,
                                tag: `group-call-${callId}`,
                                url: `/groups?group=${encodeURIComponent(group.id)}&call=${encodeURIComponent(callId)}&autoJoin=true`,
                                icon: '/globe.svg',
                            });
                        });

                        channel.subscribe((status: string) => {
                            logger.log(`[GlobalCallManager] 📡 Channel ${channelName} status:`, status);
                            
                            // Update global status for diagnostics
                            if (typeof window !== 'undefined') {
                                const statusObj = (window as any).__callSystemStatus || { channels: {} };
                                statusObj.channels[channelName] = status;
                                (window as any).__callSystemStatus = statusObj;
                            }

                            if (status === 'SUBSCRIBED') {
                                logger.log(`[GlobalCallManager] ✅ Ready on ${channelName}`);
                            } else if (status === 'CHANNEL_ERROR') {
                                logger.warn(
                                    `[GlobalCallManager] ⚠️ Realtime unavailable for ${channelName} (permission or network)`
                                );
                            } else if (status === 'TIMED_OUT') {
                                logger.warn(`[GlobalCallManager] ⚠️ Timeout subscribing to ${channelName}`);
                            }
                        });
                        channels.push(channel);
                    });
                });

                logger.log(`[GlobalCallManager] Écoute des appels sur ${joinedGroups.length} groupes rejoints`);
            } catch (e) {
                console.error('[GlobalCallManager] Erreur setup:', e);
            }
        };

        setupListeners();

        // Refresh periodically (every 2 minutes) or when tab regains focus
        const refreshInterval = setInterval(setupListeners, 120000);
        window.addEventListener('focus', setupListeners);

        return () => {
            active = false;
            clearInterval(refreshInterval);
            window.removeEventListener('focus', setupListeners);
            channels.forEach(ch => {
                client.removeChannel(ch);
            });
            stopRinging();
        };
    }, [deviceId, startRinging, stopRinging]);

    // 3. Actions UI handled by IncomingGroupCallModal

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
