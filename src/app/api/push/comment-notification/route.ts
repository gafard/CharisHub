import logger from '@/lib/logger';
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { hasWebPushConfig, sendWebPush } from '@/lib/webPush';

export const runtime = 'nodejs';

type CommentNotificationBody = {
    postId: string;
    postAuthorDeviceId: string;
    postAuthorUserId?: string | null;
    commenterName: string;
    commenterDeviceId: string;
    commenterUserId?: string | null;
    commentPreview: string;
};

export async function POST(req: Request) {
    if (!supabaseServer) {
        return NextResponse.json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 503 });
    }

    if (!hasWebPushConfig()) {
        return NextResponse.json({ ok: false, error: 'VAPID config missing' }, { status: 503 });
    }

    let body: CommentNotificationBody;
    try {
        body = (await req.json()) as CommentNotificationBody;
    } catch {
        return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { postId, postAuthorDeviceId, postAuthorUserId, commenterName, commenterDeviceId, commenterUserId, commentPreview } = body;

    if (!postId || !postAuthorDeviceId || !commenterName) {
        return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Ne pas notifier si le commentateur EST l'auteur du post (par device ou par UID)
    const isSelfComment = (postAuthorDeviceId === commenterDeviceId) || 
                          (postAuthorUserId && commenterUserId && postAuthorUserId === commenterUserId);
                          
    if (isSelfComment) {
        return NextResponse.json({ ok: true, sent: 0, reason: 'self-comment' });
    }

    // Find the push subscription for the post author
    const { data: subscriptions, error } = await supabaseServer
        .from('push_subscriptions')
        .select('endpoint,p256dh,auth,device_id')
        .eq('device_id', postAuthorDeviceId);

    if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
        return NextResponse.json({ ok: true, sent: 0, reason: 'no-subscription' });
    }

    const preview = (commentPreview || '').replace(/\s+/g, ' ').trim();
    const bodyText = preview.length > 100 ? `${preview.slice(0, 99)}…` : preview || 'A commenté votre publication';

    let sent = 0;
    let failed = 0;
    const staleEndpoints: string[] = [];

    await Promise.all(
        subscriptions.map(async (sub) => {
            if (!sub.endpoint || !sub.p256dh || !sub.auth) {
                failed += 1;
                return;
            }
            try {
                await sendWebPush(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    {
                        title: `💬 ${commenterName} a commenté`,
                        body: bodyText,
                        url: '/groups',
                        tag: `comment-${postId}`,
                        icon: '/globe.svg',
                        badge: '/globe.svg',
                    }
                );
                sent += 1;
            } catch (err: any) {
                failed += 1;
                const status = Number(err?.statusCode || 0);
                if (status === 404 || status === 410) {
                    staleEndpoints.push(sub.endpoint);
                }
            }
        })
    );

    // Cleanup stale subscriptions
    let removed = 0;
    if (staleEndpoints.length) {
        const { error: removeError } = await supabaseServer
            .from('push_subscriptions')
            .delete()
            .in('endpoint', staleEndpoints);
        if (!removeError) removed = staleEndpoints.length;
    }

    return NextResponse.json({ ok: true, sent, failed, removed });
}
