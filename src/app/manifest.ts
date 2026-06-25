import type { MetadataRoute } from 'next'

// PWA: instalable en Android ("Agregar a inicio") y base para soporte offline.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ReportaVNZLA — Venezuela Te Encuentra',
    short_name: 'ReportaVNZLA',
    description:
      'Plataforma humanitaria para reportar y buscar personas tras el terremoto de Venezuela 2026.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#dc2626',
    lang: 'es',
    categories: ['social', 'utilities'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
