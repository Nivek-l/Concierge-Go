import type { MetadataRoute } from 'next'

import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from '@/lib/constants'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — ${APP_TAGLINE}`,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#F7F9FC',
    theme_color: '#007BFF',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
