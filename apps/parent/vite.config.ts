import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // `public/manifest.webmanifest` (already linked from index.html) stays
      // the single source of truth — the plugin only builds the service
      // worker, it does not generate or inject a second manifest.
      manifest: false,
      workbox: {
        // App shell only (ADR-063 point 1): this is a real-time tracker, a
        // cached-but-stale ETA is worse than no connection. Every `fetch` to
        // the API must reach the network, so no `runtimeCaching` entries are
        // added for it — precache covers only the static build output.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // Default cap is 2 MiB; the tracking screen's map (mapbox-gl, ADR-048)
        // pushes the main bundle past it. Raised, not code-split, to keep the
        // app-shell precache covering the whole build in one pass (ADR-063 pt.1).
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  server: {
    port: 5174,
  },
});
