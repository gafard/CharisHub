/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist, StaleWhileRevalidate, NetworkFirst, NetworkOnly, ExpirationPlugin } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

type PushPayload = {
  title?: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  data?: { url?: string };
};

const SAFE_API_PREFIXES = [
  '/api/bible/audio',
  '/api/bible/commentary',
  '/api/bible/nave',
  '/api/bible/treasury',
  '/api/bible/vtt',
  '/api/bible-verse',
  '/api/strong',
];

function isSafeCachedApi(pathname: string) {
  return SAFE_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Cache the local Bible files specifically for offline use
      matcher: ({ url }) => url.pathname.startsWith('/bibles/') || url.pathname.endsWith('/bible.json'),
      handler: new StaleWhileRevalidate({
        cacheName: 'charishub-bible-data',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 16,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          }),
        ],
      }),
    },
    {
      // Only public/read-only Bible helpers are cached. Community, auth,
      // admin, push, AI and mutation APIs must always hit the network.
      matcher: ({ request, url }) =>
        request.method === 'GET' &&
        url.origin === self.location.origin &&
        isSafeCachedApi(url.pathname),
      handler: new NetworkFirst({
        cacheName: 'charishub-safe-api',
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 24,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          }),
        ],
      }),
    },
    {
      matcher: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api/'),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ url }) => url.origin.includes('supabase.co'),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  let payload: PushPayload;
  try {
    payload = event.data.json() as PushPayload;
  } catch {
    payload = { body: event.data.text() };
  }

  const tag = payload.tag || 'charishub';
  const title = payload.title || 'CharisHub';
  const url = payload.url || payload.data?.url || '/groups';
  const notificationOptions: NotificationOptions & {
    vibrate?: number[];
    actions?: Array<{ action: string; title: string; icon?: string }>;
  } = {
    body: payload.body || 'Nouveau contenu disponible',
    icon: payload.icon || '/icon.png',
    badge: payload.badge || '/icon.png',
    tag,
    data: { url },
    vibrate: tag.includes('call') ? [500, 200, 500, 200, 1000] : [200, 100, 200],
    requireInteraction: tag.includes('call'),
    actions: tag.includes('call')
      ? [
          { action: 'join', title: 'Rejoindre' },
          { action: 'dismiss', title: 'Ignorer' },
        ]
      : [],
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const rawUrl = String((event.notification.data as { url?: string } | undefined)?.url || '/');
  const targetUrl = new URL(rawUrl, self.location.origin);

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === targetUrl.origin && clientUrl.pathname === targetUrl.pathname && 'focus' in client) {
            return (client as WindowClient).focus();
          }
        } catch {
          // Ignore malformed client URLs.
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl.href);
      }
      return undefined;
    })()
  );
});
