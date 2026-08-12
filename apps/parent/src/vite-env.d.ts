/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Root of the API including its `/api` global prefix. Vite reads .env from
   * the app directory (apps/parent), not from the monorepo root.
   */
  readonly VITE_API_BASE_URL?: string;
  /** Public Mapbox token for the tracking screen's map (ADR-048 point 3). */
  readonly VITE_MAPBOX_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
