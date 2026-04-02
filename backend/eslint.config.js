// eslint.config.js
// ESLint 9 flat config — replaces the legacy .eslintrc.json
// ESLint v9+ requires this format; .eslintrc.* files are no longer supported.

import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    // Apply to all TypeScript source files
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        // Node.js globals
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // ESLint recommended rules (subset that don't conflict with TS)
      'no-unused-vars': 'off', // use TS version instead
      'no-undef': 'off',       // TypeScript handles this

      // TypeScript-specific rules
      // Using 'warn' (not 'error') — these pre-exist from before lint ran on CI.
      // Fixing them is tracked separately; they shouldn't block the pipeline.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Ignore build output, dependencies, and generated files
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'shared/dist/**'],
  },
];
