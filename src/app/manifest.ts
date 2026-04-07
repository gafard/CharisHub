import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CharisHub',
    short_name: 'CharisHub',
    lang: 'fr',
    description: 'Connectés par la grâce — Formation des Huios',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0B1F3A',
    theme_color: '#D4AF37',
    categories: ['education', 'productivity', 'lifestyle'],
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
    screenshots: [
      {
        src: '/assets/charishub_tribe_hero.png',
        sizes: '1024x1024',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Formation des Huios - Communauté',
      },
      {
        src: '/images/Logo.png',
        sizes: '1336x1536',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'CharisHub - Identité & Grâce',
      },
    ],
    shortcuts: [
      {
        name: 'Ouvrir la Bible',
        url: '/bible',
        icons: [{ src: '/icon.png', sizes: '192x192' }],
      },
      {
        name: 'Communauté',
        url: '/groups',
        icons: [{ src: '/icon.png', sizes: '192x192' }],
      },
    ],
  };
}
