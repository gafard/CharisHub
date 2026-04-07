import logger from '@/lib/logger';
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { hasWebPushConfig, sendWebPush } from '@/lib/webPush';

export const runtime = 'nodejs';

export async function GET(req: Request) {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || '';
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseServer) {
        return NextResponse.json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 503 });
    }

    if (!hasWebPushConfig()) {
        return NextResponse.json({ ok: false, error: 'VAPID config missing' }, { status: 503 });
    }

    const now = new Date();
    const in15min = new Date(now.getTime() + 15 * 60 * 1000);

    // Find groups with next_call_at between now and 15 min from now
    let groups: any[] = [];
    try {
        const { data, error } = await supabaseServer
            .from('charishub_groups')
            .select('id,name,next_call_at')
            .gt('next_call_at', now.toISOString())
            .lte('next_call_at', in15min.toISOString());

        if (error) throw error;
        groups = data ?? [];
    } catch (err: any) {
        // Table might not exist or column missing
        logger.error('[call-reminder] Error fetching groups:', err?.message);
        return NextResponse.json({ ok: true, sent: 0, groups: 0, note: 'No groups table or column' });
    }

    if (groups.length === 0) {
        return NextResponse.json({ ok: true, sent: 0, groups: 0 });
    }

    let totalSent = 0;
    let totalFailed = 0;
    const staleEndpoints: string[] = [];

    for (const group of groups) {
        // Get group members
        let members: any[] = [];
        try {
            const { data, error } = await supabaseServer
                .from('charishub_group_members')
                .select('device_id')
                .eq('group_id', group.id);
            if (error) throw error;
            members = data ?? [];
        } catch {
            continue;
        }

        const deviceIds = members
            .map((m: any) => m.device_id)
            .filter(Boolean);

        if (deviceIds.length === 0) continue;

        // Get push subscriptions for these members
        const { data: subscriptions } = await supabaseServer
            .from('push_subscriptions')
            .select('endpoint,p256dh,auth,device_id')
            .in('device_id', deviceIds);

        if (!subscriptions || subscriptions.length === 0) continue;

        const callTime = new Date(group.next_call_at);
        const minutesUntil = Math.round((callTime.getTime() - now.getTime()) / 60000);
        const timeLabel = minutesUntil <= 1 ? 'maintenant' : `dans ${minutesUntil} min`;

        await Promise.all(
            subscriptions.map(async (sub) => {
                if (!sub.endpoint || !sub.p256dh || !sub.auth) {
                    totalFailed += 1;
                    return;
                }
                try {
                    await sendWebPush(
                        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                        {
                            title: `📅 Appel ${timeLabel} — ${group.name || 'Groupe'}`,
                            body: `L'appel du groupe « ${group.name || 'votre groupe'} » commence ${timeLabel}`,
                            url: `/groups?group=${encodeURIComponent(group.id)}&autoJoin=true`,
                            tag: `call-reminder-${group.id}`,
                            icon: '/globe.svg',
                            badge: '/globe.svg',
                        }
                    );
                    totalSent += 1;
                } catch (err: any) {
                    totalFailed += 1;
                    const status = Number(err?.statusCode || 0);
                    if (status === 404 || status === 410) {
                        staleEndpoints.push(sub.endpoint);
                    }
                }
            })
        );
    }

    // Cleanup stale
    let removed = 0;
    if (staleEndpoints.length) {
        const { error: removeError } = await supabaseServer
            .from('push_subscriptions')
            .delete()
            .in('endpoint', staleEndpoints);
        if (!removeError) removed = staleEndpoints.length;
    }

    return NextResponse.json({
        ok: true,
        groups: groups.length,
        sent: totalSent,
        failed: totalFailed,
        removed,
    });
}
