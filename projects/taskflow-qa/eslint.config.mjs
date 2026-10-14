import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    // Generated output and TypeScript spec files are not linted here: the
    // dependency allow-list does not include a TypeScript ESLint parser, and
    // Playwright type-checks its own spec files when running them.
    ignores: [
      'node_modules/**',
      'test-reports/**',
      'test-evidence/**',
      'playwright-report/**',
      'test-results/**',
      '.data/**',
      'app/server/data/**',
      '**/*.ts',
    ],
  },
  js.configs.recommended,
  {
    files: ['app/server/**/*.js', 'scripts/**/*.mjs', 'tests/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  {
    files: ['app/public/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
