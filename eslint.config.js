import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import secret from './tools/eslint-plugin-secret/index.js';

/** Modules Node donnant accès aux I/O : interdits dans le moteur (§8 : « aucun I/O »). */
const NODE_IO_PATTERNS = ['node:*', 'fs', 'fs/*', 'path', 'http', 'https', 'net', 'child_process'];

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'playwright-report/**',
      'test-results/**',
      'data/**',
    ],
  },

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    plugins: { secret },
    rules: {
      // Les logs console sont un vecteur de fuite (§4) : on passe par le logger du serveur.
      'no-console': 'error',
      // Lecture d'un Secret<T> interdite hors liste blanche (voir plus bas).
      'secret/no-expose': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  // Fichiers JS (configs, plugin local) : pas d'analyse typée.
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // Liste blanche de `secret/no-expose`. Toute extension = décision tracée dans DECISIONS.md.
  {
    files: [
      'packages/engine/src/internal/**/*.ts',
      'apps/server/src/persistence/**/*.ts',
      '**/test/**/*.ts',
      'tests/security/**/*.ts',
    ],
    rules: { 'secret/no-expose': 'off' },
  },

  // Moteur : logique pure, aucun I/O.
  {
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: NODE_IO_PATTERNS, message: 'Le moteur ne fait aucun I/O.' },
            { group: ['@sq/server', '@sq/bot', '@sq/web'], message: 'Dépendance interdite.' },
          ],
        },
      ],
    },
  },

  // Coach : logique pure (classification, explications, PGN), aucun I/O, aucun secret.
  {
    files: ['packages/coach/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: NODE_IO_PATTERNS, message: 'Le coach ne fait aucun I/O.' },
            {
              group: ['@sq/shared/secret', '@sq/engine', '@sq/server', '@sq/bot', '@sq/web'],
              message: 'Dépendance interdite.',
            },
          ],
        },
      ],
    },
  },

  // Bot : ne manipule jamais de Secret (il ne connaît que son observation).
  {
    files: ['packages/bot/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@sq/shared/secret', '@sq/server', '@sq/web'],
              message: "Le bot n'a accès qu'à son observation (§5).",
            },
          ],
        },
      ],
    },
  },

  // Web : pas de secret, pas de moteur de règles. Le client n'affiche que la vue du serveur.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    extends: [reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@sq/shared/secret',
                '@sq/engine',
                '@sq/bot',
                '@sq/coach',
                '@sq/server',
                'chess.js',
              ],
              message: "Le client n'a ni secret ni moteur : il affiche la vue reçue du serveur.",
            },
          ],
        },
      ],
    },
  },

  // Exploration de variantes (revue, échiquier d'analyse) : chess.js autorisé dans ce seul
  // fichier, chargé à la demande, jamais par l'écran de partie (DECISIONS, étape 12).
  {
    files: ['apps/web/src/analysis/tree.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@sq/shared/secret', '@sq/engine', '@sq/bot', '@sq/coach', '@sq/server'],
              message: "Le client n'a ni secret ni moteur : il affiche la vue reçue du serveur.",
            },
          ],
        },
      ],
    },
  },
);
