/// <reference types="vite/client" />

/** Build id injected by `buildIdPlugin` (ADR-094); compared against `/version.json`. */
declare const __APP_BUILD_ID__: string;

interface ImportMetaEnv {
  /**
   * Root of the API including its `/api` global prefix. Vite reads .env from
   * the app directory (apps/board), not from the monorepo root.
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
