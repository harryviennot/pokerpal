/**
 * Two projects on purpose.
 *
 * The `engine` project runs the pure-TypeScript poker domain in a plain node
 * environment with no React Native transform or setup, so `npm run test:engine`
 * stays fast enough to keep running while editing `src/engine`. The `app`
 * project carries the full jest-expo preset for component tests.
 *
 * @type {import('jest').Config}
 */
const expoPreset = require('jest-expo/ios/jest-preset');

// Setting `setupFiles` or `transformIgnorePatterns` here REPLACES the
// jest-expo preset's values, so both are extended from the preset instead of
// copied: Skia ships untranspiled ESM and registers its own web-based mock.
const transformIgnorePatterns = expoPreset.transformIgnorePatterns.map((pattern) =>
  pattern.replace('|standard-navigation))', '|standard-navigation|@shopify/react-native-skia))'),
);

module.exports = {
  projects: [
    {
      displayName: 'engine',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/engine/**/*.test.ts', '<rootDir>/src/utils/**/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': ['babel-jest', { presets: [['babel-preset-expo', { platform: 'ios' }]] }],
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
    },
    {
      displayName: 'app',
      preset: 'jest-expo/ios',
      // Everything outside the engine's own fast project: components, hooks and
      // feature stores, whether or not the file contains JSX.
      testMatch: [
        '<rootDir>/src/**/*.test.ts',
        '<rootDir>/src/**/*.test.tsx',
        '<rootDir>/app/**/*.test.tsx',
      ],
      testPathIgnorePatterns: ['<rootDir>/src/engine/', '<rootDir>/src/utils/'],
      setupFiles: [...expoPreset.setupFiles, '@shopify/react-native-skia/jestSetup.js'],
      transformIgnorePatterns,
      resolver: '<rootDir>/jest.resolver.js',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@/assets/(.*)$': '<rootDir>/assets/$1',
      },
    },
  ],
};
