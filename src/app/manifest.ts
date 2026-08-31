import type { MetadataRoute } from 'next'

/**
 * Makes the site installable to the home screen. No service worker — a manifest
 * is all installability requires, and offline logging is not a v1 problem.
 *
 * Reach, honestly: Android Chrome installs a real icon and long-press shows the
 * "Add food" shortcut. iOS Safari installs and launches standalone but ignores
 * `shortcuts` entirely — those users get icon, then one tap to the photo button.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kcalup',
    short_name: 'Kcalup',
    description: 'Photo to calories in seconds.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f5f0',
    theme_color: '#f7f5f0',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Add food',
        short_name: 'Add food',
        url: '/?action=photo',
        icons: [{ src: '/icon-192.png', sizes: '192x192' }],
      },
    ],
  }
}
