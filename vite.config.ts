import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Client-side env vars must be prefixed VITE_ and read via import.meta.env
// (e.g. VITE_UI_REFRESH). Never put secrets in them: anything VITE_* ends up
// in the public bundle.
export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // The web app manifest is hand-maintained in public/manifest.json.
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 } },
          },
          {
            // Placeholder avatars for candidates without a photo.
            urlPattern: /^https:\/\/ui-avatars\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'avatar-images', expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
