'use client';

import { useEffect, useRef } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useCommunityIdentity } from '../lib/useCommunityIdentity';
import { supabase } from '../lib/supabase';
import { sendNotification, ensureNotificationPermission, syncPushSubscription } from './notifications';
import { useSettings } from '../contexts/SettingsContext';

export default function NotificationManager() {
    const { identity } = useCommunityIdentity();
    const { notificationsEnabled } = useSettings();
    const permissionRequested = useRef(false);
    const pushSyncDone = useRef(false);

    // ------------------------------------------------------------------
    // 1. REGISTER THE SERVICE WORKER (failsafe — next-pwa register:true
    //    isn't working reliably on production).
    // ------------------------------------------------------------------
    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

        navigator.serviceWorker.getRegistration().then(async (existing) => {
            if (existing) {
                console.log('[NotificationManager] SW already registered:', existing.scope);
                return;
            }
            try {
                const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
                console.log('[NotificationManager] SW registered successfully:', reg.scope);
            } catch (err) {
                console.error('[NotificationManager] SW registration failed:', err);
            }
        });
    }, []);

    // ------------------------------------------------------------------
    // 2. REQUEST PERMISSION + AUTO-SYNC PUSH when notifications enabled
    // ------------------------------------------------------------------
    useEffect(() => {
        if (!notificationsEnabled || permissionRequested.current) return;
        permissionRequested.current = true;

        (async () => {
            const status = await ensureNotificationPermission();
            console.log('[NotificationManager] Permission status:', status);

            if (status === 'granted' && !pushSyncDone.current) {
                pushSyncDone.current = true;
                console.log('[NotificationManager] Auto-syncing push subscription...');
                const result = await syncPushSubscription(true);
                if (result.ok) {
                    console.log('[NotificationManager] Push subscription synced ✅');
                } else {
                    console.warn('[NotificationManager] Push sync issue:', result.error || result.warning);
                }
            }
        })();
    }, [notificationsEnabled]);

    // ------------------------------------------------------------------
    // 3. SERVICE WORKER READY LOG
    // ------------------------------------------------------------------
    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                console.log('[NotificationManager] Service Worker ready:', registration.scope);
            });
        }
    }, []);

    // ------------------------------------------------------------------
    // 4. REALTIME LISTENER — local notification fallback for visible tab
    // ------------------------------------------------------------------
    useEffect(() => {
        if (!supabase || !identity?.deviceId || !notificationsEnabled) return;
        const client = supabase;

        console.log('[NotificationManager] Setting up realtime listener for community posts');

        const channel = client
            .channel('public:charishub_posts')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'charishub_posts',
                },
                async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
                    console.log('[NotificationManager] 📬 New post detected:', payload);
                    const post = payload.new as any;

                    // Don't notify for own posts
                    if (post.author_device_id === identity.deviceId) {
                        console.log('[NotificationManager] Skipping notification for own post');
                        return;
                    }

                    // Only send a local notification if the page is visible.
                    if (document.visibilityState !== 'visible') {
                        console.log('[NotificationManager] Page hidden — relying on push');
                        return;
                    }

                    // Check if push subscription is active — if so, the server
                    // broadcast already sent a push. Skip local, unless localhost.
                    try {
                        const reg = await navigator.serviceWorker?.getRegistration?.();
                        const pushSub = await reg?.pushManager?.getSubscription?.();
                        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

                        if (pushSub && !isLocal) {
                            console.log('[NotificationManager] Push subscription active — skipping local notification');
                            return;
                        }
                    } catch {
                        // Ignore — proceed with local notification
                    }

                    // Send local notification (fallback for users without push)
                    sendNotification({
                        title: `Nouveau post de ${post.author_name || 'Un membre'}`,
                        body: post.content?.substring(0, 100) || 'Voir le post',
                        tag: `post-${post.id}`,
                        url: post.group_id
                          ? `/groups?group=${encodeURIComponent(post.group_id)}`
                          : '/groups',
                        icon: '/globe.svg',
                    });
                }
            )
            .subscribe((status: string) => {
                console.log('[NotificationManager] Realtime subscription status:', status);
            });

        return () => {
            console.log('[NotificationManager] Cleaning up realtime subscription');
            client.removeChannel(channel);
        };
    }, [identity?.deviceId, notificationsEnabled]);

    return null;
}
