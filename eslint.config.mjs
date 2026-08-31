// Flat config (ESLint 10 + typescript-eslint 8). Ver docs/decisiones.md ADR-021.
// El linting type-aware (que necesita informacion de tipos, p.ej.
// no-floating-promises) se limita a los fuentes reales (apps/*/src, packages/*/src);
// el resto de archivos TS (configs) usa reglas sin tipos para evitar errores de
// "archivo fuera del proyecto".
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactPlugin from '@eslint-react/eslint-plugin';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      '**/*.tsbuildinfo',
      'packages/shared/scripts/**',
    ],
  },

  // Base JS recommendations for every file.
  js.configs.recommended,

  // Type-aware linting: only source files that live inside a tsconfig `include`.
  {
    files: ['apps/*/src/**/*.{ts,tsx}', 'packages/*/src/**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Footguns de async en NestJS: promesas sin await / mal usadas.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },

  // Service worker de apps/parent (ADR-066 pt.6): fuera de apps/parent/src,
  // así que no colisiona con el bloque type-aware de arriba (que usa la lib
  // DOM de tsconfig.json) — necesita su propio tsconfig con lib "webworker",
  // que no puede convivir con "DOM" en el mismo programa TS.
  {
    files: ['apps/parent/sw-src/**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: ['apps/parent/tsconfig.sw.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.serviceworker },
    },
  },

  // Backend / Node source: globals de Node.
  {
    files: ['apps/api/**/*.ts', 'apps/worker/**/*.ts', 'packages/shared/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Frontend source: globals de navegador.
  {
    files: [
      'apps/portal/src/**/*.{ts,tsx}',
      'apps/parent/src/**/*.{ts,tsx}',
      'apps/board/src/**/*.{ts,tsx}',
      'packages/ui/src/**/*.{ts,tsx}',
    ],
    languageOptions: { globals: { ...globals.browser } },
  },

  // Código React (apps de navegador + @casillego/ui): reglas de hooks +
  // reglas JSX (ADR-102). `eslint-plugin-react` sigue sin declarar soporte
  // para ESLint 10 (última versión publicada, 7.37.5, hace más de un año) —
  // se usa `@eslint-react/eslint-plugin` en su lugar, alternativa nativa de
  // flat config que sí soporta ESLint 10.
  {
    files: [
      'apps/portal/src/**/*.{ts,tsx}',
      'apps/parent/src/**/*.{ts,tsx}',
      'apps/board/src/**/*.{ts,tsx}',
      'packages/ui/src/**/*.{ts,tsx}',
    ],
    plugins: { 'react-hooks': reactHooksPlugin },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...reactHooksPlugin.configs.recommended.rules,
    },
  },

  {
    files: [
      'apps/portal/src/**/*.{ts,tsx}',
      'apps/parent/src/**/*.{ts,tsx}',
      'apps/board/src/**/*.{ts,tsx}',
      'packages/ui/src/**/*.{ts,tsx}',
    ],
    ...reactPlugin.configs.recommended,
  },

  // Scripts de mantenimiento fuera de `src` (p.ej. apps/api/scripts): no
  // entran en el `include` de ningun tsconfig, asi que se lintean sin reglas
  // de tipos — igual que los archivos de config de abajo. Sin este bloque el
  // parser por defecto intentaria leerlos como JS y fallaria en la primera
  // anotacion de tipo.
  {
    files: ['apps/*/scripts/**/*.{ts,mts,cts}', 'packages/*/scripts/**/*.{ts,mts,cts}'],
    extends: [...tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.node } },
  },

  // Archivos de config TS (vite.config.ts, etc.): reglas sin tipos.
  {
    files: ['**/*.config.{ts,mts,cts}'],
    extends: [...tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.node } },
  },

  // Config en JS/mjs: sin reglas de tipos.
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: { ...globals.node } },
  },

  // Debe ir al final: apaga reglas de estilo que colisionan con Prettier.
  prettier,
);
