import { defineConfig } from 'vitest/config';

// Tests de integracion contra servicios externos reales (hoy solo Postgres).
// Separados de la config raiz a proposito: `npm run check` debe poder correr en
// una maquina sin base de datos. Se corren con `npm run test:integration`.
//
// Las variables de conexion salen del .env de la raiz, igual que api y worker.
try {
  process.loadEnvFile('.env');
} catch {
  // Sin .env (CI inyecta las variables directamente) — se ignora.
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['apps/**/*.integration.spec.ts', 'packages/**/*.integration.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    // Una sola transaccion compartida por archivo: los tests no deben correr en
    // paralelo contra la misma base.
    fileParallelism: false,
    passWithNoTests: true,
  },
});
