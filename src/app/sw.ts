/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist, StaleWhileRevalidate, NetworkFirst, ExpirationPlugin } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    ...defaultCache,
    {
      // Cache the local Bible files specifically for offline use
      matcher: ({ url }) => url.pathname.startsWith('/bibles/') || url.pathname.endsWith('/bible.json'),
      handler: new StaleWhileRevalidate({
        cacheName: 'charishub-bible-data',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 10,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          }),
        ],
      }),
    },
    {
      // Supabase & APIs
      matcher: ({ url }) => 
        url.origin.includes('supabase.co') || 
        url.pathname.startsWith('/api/'),
      handler: new NetworkFirst({
        cacheName: 'charishub-api',
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          }),
        ],
      }),
    }
  ],
});

serwist.addEventListeners();
