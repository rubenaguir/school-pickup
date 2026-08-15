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
  /**
   * URL of `apps/board`, for the Dashboard's "Abrir tablero" button
   * (ADR-072 point 6). No other screen in the portal resolves a link to
   * `apps/board`; without this value the button stays disabled.
   */
  readonly VITE_BOARD_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
