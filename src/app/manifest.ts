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
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
