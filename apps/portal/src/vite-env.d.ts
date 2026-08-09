/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Root of the API including its `/api` global prefix. Vite reads .env from
   * the app directory (apps/portal), not from the monorepo root.
   */
  readonly VITE_API_BASE_URL?: string;
  /**
   * Public Mapbox access token for the geofence map (ADR-048 point 3). Must be
   * restricted by allowed URL in the Mapbox dashboard; without it the map
   * renders an explanatory panel instead of a blank canvas.
   */
  readonly VITE_MAPBOX_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
