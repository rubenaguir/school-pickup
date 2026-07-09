import { defineConfig } from 'vitest/config';

// Config raiz para tests de dominio (funciones puras de packages/shared, servicios
// de api). Los frontends pueden anadir su propio vitest.config.ts con environment
// jsdom cuando tengan componentes que probar. Ver docs/decisiones.md ADR-021.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['apps/**/*.{test,spec}.ts', 'packages/**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    passWithNoTests: true,
  },
});
