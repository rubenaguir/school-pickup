import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Config propia del portal para tests de componente React (environment jsdom),
// separada de la config raiz (environment node, solo *.test.ts) — ver el
// comentario en vitest.config.ts de la raiz y ADR-021.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    passWithNoTests: true,
  },
});
