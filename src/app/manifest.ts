import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CharisHub',
    short_name: 'CharisHub',
    lang: 'fr',
    description: 'Connectés par la grâce — Vision Miroir',
    start_url: '/',
    scope: '/',
    id: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0B1F3A',
    theme_color: '#D4AF37',
    categories: ['education', 'productivity', 'lifestyle'],
    prefer_related_applications: false,
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
        label: 'Miroir de Grâce - Communauté',
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
        short_name: 'Bible',
        url: '/bible',
        icons: [{ src: '/icon.png', sizes: '192x192' }],
      },
      {
        name: 'Tableau de bord',
        short_name: 'Dashboard',
        url: '/dashboard',
        icons: [{ src: '/icon.png', sizes: '192x192' }],
      },
      {
        name: 'Communauté',
        short_name: 'Groupes',
        url: '/groups',
        icons: [{ src: '/icon.png', sizes: '192x192' }],
      },
      {
        name: 'Plans de lecture',
        short_name: 'Plans',
        url: '/bible/plans',
        icons: [{ src: '/icon.png', sizes: '192x192' }],
      },
    ],
  };
}
