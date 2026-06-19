import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    port: 5174,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    exclude: ['**/node_modules/**', '**/tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/utils/**', 'src/hooks/**'],
    },
  },
  build: {
    sourcemap: true,
  },
  plugins: [
    react(),
    VitePWA({
      injectRegister: null,
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'icon.svg',
        'apple-touch-icon.png',
        'icon-192.png',
        'icon-512.png',
        'maskable-icon-192.png',
        'maskable-icon-512.png',
      ],
      manifest: {
        name: 'Yeshua - Bible Reader',
        short_name: 'Yeshua',
        description: 'Offline-friendly Bible app with multiple translations',
        id: '/',
        lang: 'en',
        dir: 'ltr',
        scope: '/',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'minimal-ui',
        display_override: ['minimal-ui', 'browser'],
        orientation: 'portrait-primary',
        categories: ['books', 'education', 'reference'],
        prefer_related_applications: false,
        start_url: '/',
        shortcuts: [
          {
            name: 'Read Scripture',
            short_name: 'Read',
            description: 'Open the reader',
            url: '/read',
            icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Search Verses',
            short_name: 'Search',
            description: 'Search across the Bible',
            url: '/search',
            icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Study Notes',
            short_name: 'Notes',
            description: 'Open saved notes',
            url: '/notes',
            icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/maskable-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/maskable-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // The generated KJV data chunk is intentionally shipped for offline use.
        // The semantic-search embeddings (~12MB .bin) are runtime-cached instead of
        // precached so they don't bloat every install.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        skipWaiting: true,
        runtimeCaching: [
          {
            // Pre-computed KJV verse embeddings for offline semantic search.
            urlPattern: /\/assets\/.*\.bin$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'semantic-embeddings-cache',
              cacheableResponse: {
                statuses: [0, 200],
              },
              expiration: {
                maxEntries: 4,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            // transformers.js query-embedding model files (downloaded once, then offline).
            // Covers the HF site, its resolve-cache API, and the xet CDN that actually
            // serves the model/onnx blobs. Cache name is versioned (-v2) so any caches
            // poisoned by a pre-fix build (HTML stored for model JSON) are abandoned.
            urlPattern: /^https:\/\/(huggingface\.co|.*\.hf\.co)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'transformers-model-cache-v2',
              cacheableResponse: {
                statuses: [0, 200],
              },
              expiration: {
                maxEntries: 32,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              rangeRequests: true,
            },
          },
          {
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\/wldeh\/bible-api\/.*\.json$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'bible-api-cache',
              cacheableResponse: {
                statuses: [200],
              },
              expiration: {
                maxEntries: 1200,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-font-stylesheets',
              expiration: {
                maxEntries: 8,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-font-webfonts',
              cacheableResponse: {
                statuses: [0, 200],
              },
              expiration: {
                maxEntries: 12,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }),
  ],
});
