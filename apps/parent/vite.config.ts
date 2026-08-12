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
      },
    }),
  ],
  server: {
    port: 5174,
  },
});
