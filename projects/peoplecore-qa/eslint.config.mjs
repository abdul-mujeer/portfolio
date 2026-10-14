import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'app/public/**',
      '.data/**',
      'app/server/data/**',
      'test-reports/**',
      'test-results/**',
      'playwright-report/**',
      'test-evidence/**',
      // Playwright specs and the Playwright config are TypeScript; the portfolio
      // dependency set does not include typescript-eslint, so they are excluded
      // from linting (documented deviation in the README).
      'tests/**/*.spec.ts',
      'playwright.config.ts',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
];
