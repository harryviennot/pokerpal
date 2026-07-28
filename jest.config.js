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
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@/assets/(.*)$': '<rootDir>/assets/$1',
      },
    },
  ],
};
