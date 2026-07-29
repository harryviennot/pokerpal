import { installMemoryHandHistoryRepo } from '@/services/handHistory';

// React 19 only flushes updates inside act() when this flag is set. Without it
// the renderer leaks state between tests as timer-driven updates land outside
// any act scope — which the chunked equity simulation produces constantly.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Every test gets a fresh in-memory hand-history repository, so no test ever
// touches expo-sqlite (unavailable under Jest) or another test's writes.
beforeEach(() => {
  installMemoryHandHistoryRepo();
});

// `Screen` asks for the safe area insets, which throws without a provider above
// it. The library ships this mock for exactly that; wrapping every screen test
// in a provider would be the same insets with more ceremony.
jest.mock(
  'react-native-safe-area-context',
  () =>
    // `jest.mock` is hoisted above the imports, so its factory has to require.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native-safe-area-context/jest/mock').default,
);
