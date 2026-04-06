'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useCommunityIdentity } from '../lib/useCommunityIdentity';
import { fetchGroups } from './communityApi';
import IncomingGroupCallModal from './IncomingGroupCallModal';
import { releaseAudioFocus } from '../lib/audioFocus';
import { sendNotification } from './notifications';

type IncomingCallPayload = {
    callId: string; // Group ID
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

    // Référence pour l'oscillateur audio (sonnerie)
    const audioContextRef = useRef<AudioContext | null>(null);
    const ringingIntervalRef = useRef<number | null>(null);
    const recentInviteRef = useRef<Record<string, number>>({});

    const stopRinging = useCallback(() => {
        if (ringingIntervalRef.current) {
            clearInterval(ringingIntervalRef.current);
            ringingIntervalRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => { });
            audioContextRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (incomingCall) {
            document.body.classList.add('group-call-incoming-active');
            releaseAudioFocus();
        } else {
            document.body.classList.remove('group-call-incoming-active');
        }

        return () => {
            document.body.classList.remove('group-call-incoming-active');
        };
    }, [incomingCall]);

    const startRinging = useCallback(() => {
        if (audioContextRef.current) return;

        try {
            const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextCtor) return;
            const ctx = new AudioContextCtor();
            audioContextRef.current = ctx;

            const playTone = () => {
                if (!audioContextRef.current) return;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, ctx.currentTime); // La4
                osc.frequency.setValueAtTime(554.37, ctx.currentTime + 0.1); // Do#5

                gain.gain.setValueAtTime(0, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.1, ctx.currentTime + 0.3);
                gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);

                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.6);
            };

            playTone();
            ringingIntervalRef.current = window.setInterval(playTone, 2000);

            // Auto-stop après 30s
            setTimeout(stopRinging, 30000);
        } catch (e) {
            console.error('Audio play failed', e);
        }
    }, [stopRinging]);

    // 1. Écouter les invitations sur TOUS les groupes de l'utilisateur
    useEffect(() => {
        if (!deviceId || !supabase) return;
        const client = supabase;

        const channels: ReturnType<NonNullable<typeof supabase>['channel']>[] = [];
        let active = true;

        const setupListeners = async () => {
            try {
                console.log('[GlobalCallManager] Fetching groups for device:', deviceId);
                const groups = await fetchGroups(40, deviceId);
                if (!active) return;
                console.log('[GlobalCallManager] Groups fetched:', groups.length, groups.map(g => g.id));

                if (groups.length === 0) {
                    console.warn('[GlobalCallManager] No groups found. User will not receive calls.');
                }

                // Only subscribe to groups where the user is effectively a member.
                // Subscribing to every public group can trigger CHANNEL_ERROR for non-members.
                const joinedGroups = groups.filter(
                    (group) => group.joined || group.created_by_device_id === deviceId
                );
                if (joinedGroups.length === 0) {
                    console.log('[GlobalCallManager] No joined groups. Skipping call listeners.');
                    return;
                }

                joinedGroups.forEach(group => {
                    const channelNames = [`group-call:${group.id}`, `group:${group.id}`];

                    channelNames.forEach((channelName) => {
                        console.log('[GlobalCallManager] Subscribing to channel:', channelName);
                        const channel = client.channel(channelName);
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-ignore
                        channel.on('broadcast', { event: 'call.invite' }, ({ payload }) => {
                            const raw = (payload ?? {}) as InviteEventPayload;
                            const callId = String(raw.callId || group.id);
                            const startedBy = String(raw.startedBy || '');

                            if (!startedBy) return;
                            if (startedBy === deviceId) {
                                console.log('[GlobalCallManager] Ignoring own call');
                                return;
                            }

                            const dedupeKey = `${callId}:${startedBy}`;
                            const now = Date.now();
                            const lastSeen = recentInviteRef.current[dedupeKey] || 0;
                            if (now - lastSeen < 1800) {
                                return;
                            }
                            recentInviteRef.current[dedupeKey] = now;

                            console.log('[GlobalCallManager] 📞 EVENT RECEIVED:', raw);
                            console.log('[GlobalCallManager] 🔔 RINGER TRIGGERED for call:', callId);
                            setIncomingCall({
                                callId,
                                startedBy,
                                startedByUserName: String(raw.startedByUserName || 'Un membre'),
                                groupName: String(raw.groupName || group.name || 'Groupe'),
                                startedAt: String(raw.startedAt || new Date().toISOString()),
                            });
                            startRinging();
                            void sendNotification({
                                title: `Appel de groupe: ${String(raw.groupName || group.name || 'Communaute')}`,
                                body: `${String(raw.startedByUserName || 'Un membre')} vous invite a rejoindre l'appel`,
                                tag: `group-call-${callId}`,
                                url: `/groups?group=${encodeURIComponent(callId)}&autoJoin=true`,
                                icon: '/globe.svg',
                            });
                        });

                        channel.subscribe((status) => {
                            console.log(`[GlobalCallManager] 📡 Channel ${channelName} status:`, status);
                            if (status === 'SUBSCRIBED') {
                                console.log(`[GlobalCallManager] ✅ Ready on ${channelName}`);
                            } else if (status === 'CHANNEL_ERROR') {
                                console.warn(
                                    `[GlobalCallManager] ⚠️ Realtime unavailable for ${channelName} (permission or network)`
                                );
                            } else if (status === 'TIMED_OUT') {
                                console.warn(`[GlobalCallManager] ⚠️ Timeout subscribing to ${channelName}`);
                            }
                        });
                        channels.push(channel);
                    });
                });

                console.log(`[GlobalCallManager] Écoute des appels sur ${joinedGroups.length} groupes rejoints`);
            } catch (e) {
                console.error('[GlobalCallManager] Erreur setup:', e);
            }
        };

        setupListeners();

        return () => {
            active = false;
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
                groupId: incomingCall.callId,
                fromName: incomingCall.startedByUserName,
                groupName: incomingCall.groupName || 'Appel de groupe',
                startedAt: incomingCall.startedAt,
            }}
            onJoin={async (call) => {
                stopRinging();
                router.push(`/groups?group=${encodeURIComponent(call.groupId)}&autoJoin=true`);
                setIncomingCall(null);
            }}
            onDismiss={async () => {
                stopRinging();
                setIncomingCall(null);
            }}
            enableVibrate={true}
        />
    );
}
