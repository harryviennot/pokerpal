// ESLint flat config. Run with `npm run lint` (ESLint + Prettier check).
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

/**
 * Modules that must never reach `src/engine`. The engine is pure TypeScript:
 * no React, no Expo, no I/O, deterministic under a seeded RNG. Enforcing the
 * boundary here means it cannot rot through review oversight.
 */
const IMPURE_MODULE_PATTERNS = [
  'react',
  'react/*',
  'react-*',
  'expo',
  'expo-*',
  '@expo/*',
  '@react-native*',
  '@/services',
  '@/services/*',
  '@/features',
  '@/features/*',
  '@/components',
  '@/components/*',
  '@/hooks',
  '@/hooks/*',
  '@/theme',
  '@/theme/*',
];

module.exports = [
  ...expoConfig,
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'ios/**', 'android/**', 'expo-env.d.ts'],
  },
  {
    // CommonJS tooling configs at the repo root.
    files: ['*.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { __dirname: 'readonly', module: 'writable', require: 'readonly' },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        // Type-aware linting, required by no-floating-promises.
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      // `const Foo = {...}; type Foo = ...` is the idiomatic stand-in for a TS
      // enum, and tsc already rejects genuine redeclarations.
      '@typescript-eslint/no-redeclare': 'off',
      'no-redeclare': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'import/order': [
        'error',
        {
          groups: [['builtin', 'external'], 'internal', ['parent', 'sibling', 'index']],
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Layer 1: the engine stays pure.
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: IMPURE_MODULE_PATTERNS,
              message:
                'src/engine must stay pure: no React, Expo, or I/O imports. Invert the dependency instead.',
            },
          ],
        },
      ],
      // Replays and tests depend on determinism.
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the injected Rng from @/engine/rng so results stay reproducible.',
        },
      ],
    },
  },
  {
    // Layer 5: route files compose a feature screen and nothing else.
    files: ['app/**/*.tsx'],
    rules: {
      'import/no-default-export': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  prettierConfig,
];
