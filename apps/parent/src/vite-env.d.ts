/// <reference types="vite/client" />

/** Build id injected by `buildIdPlugin` (ADR-094); compared against `/version.json`. */
declare const __APP_BUILD_ID__: string;

interface ImportMetaEnv {
  /**
   * Root of the API including its `/api` global prefix. Vite reads .env from
   * the app directory (apps/parent), not from the monorepo root.
   */
  readonly VITE_API_BASE_URL?: string;
  /** Public Mapbox token for the tracking screen's map (ADR-048 point 3). */
  readonly VITE_MAPBOX_TOKEN?: string;
  /** Public VAPID key for Web Push subscription (ADR-066). */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
