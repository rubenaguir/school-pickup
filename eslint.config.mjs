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

  // Código React (apps de navegador + @casillego/ui): reglas de hooks.
  // Nota: no se agrega `eslint-plugin-react` — su última versión publicada
  // (7.37.5) declara peer `eslint@^3...^9.7`, no soporta ESLint 10 (mismo
  // tipo de conflicto que TypeScript 7 en ADR-021). Se retoma cuando publique
  // soporte, o se evalúa una alternativa nativa de flat config.
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
