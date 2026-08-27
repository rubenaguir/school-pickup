import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { buildIdPlugin } from '@casillego/ui/vite-build-id';

export default defineConfig({
  plugins: [
    buildIdPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // injectManifest, not generateSW (ADR-066 pt.6): generateSW cannot host a
      // custom `push`/`notificationclick` handler, needed for the delivery-
      // confirmation push notification. `src/sw.ts` is our own service worker;
      // the plugin only injects the precache manifest into it at build time.
      strategies: 'injectManifest',
      // `sw-src/`, not `src/`: the service worker needs the "webworker" TS
      // lib, which cannot coexist with `src/tsconfig.json`'s "DOM" lib in the
      // same program (see apps/parent/tsconfig.sw.json).
      srcDir: 'sw-src',
      filename: 'sw.ts',
      // `public/manifest.webmanifest` (already linked from index.html) stays
      // the single source of truth — the plugin only builds the service
      // worker, it does not generate or inject a second manifest.
      manifest: false,
      injectManifest: {
        // App shell only (ADR-063 point 1): this is a real-time tracker, a
        // cached-but-stale ETA is worse than no connection. Every `fetch` to
        // the API must reach the network, so no runtime caching is added for
        // it — precache covers only the static build output.
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
