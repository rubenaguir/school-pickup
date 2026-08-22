import { defineConfig } from 'vitest/config';

// Config raiz para tests de dominio (funciones puras de packages/shared, servicios
// de api). Los frontends anaden su propio vitest.config.ts con environment jsdom
// cuando tienen componentes que probar (ver apps/portal/vitest.config.ts) — esos
// corren aparte, invocados por el "test" de la raiz via `--workspaces`, no por
// esta config. Ver docs/decisiones.md ADR-021.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['apps/**/*.{test,spec}.ts', 'packages/**/*.{test,spec}.ts'],
    // Los *.integration.spec.ts exigen un Postgres real; viven en su propia
    // config (vitest.integration.config.ts, `npm run test:integration`) para que
    // la compuerta `npm run check` no dependa de una base de datos.
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/*.integration.spec.ts'],
    passWithNoTests: true,
  },
});
