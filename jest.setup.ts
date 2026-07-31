import { installMemoryHandHistoryRepo } from '@/services/handHistory';
import { installMemorySettingsRepo } from '@/services/settings';

// React 19 only flushes updates inside act() when this flag is set. Without it
// the renderer leaks state between tests as timer-driven updates land outside
// any act scope — which the chunked equity simulation produces constantly.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Every test gets a fresh in-memory hand-history repository, so no test ever
// touches expo-sqlite (unavailable under Jest) or another test's writes.
beforeEach(() => {
  installMemoryHandHistoryRepo();
  installMemorySettingsRepo();
});

// Reanimated's JS-only test implementation: animations resolve synchronously
// under the fake timers the screen tests already run.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('react-native-reanimated').setUpTests();

// Every animation on the table degrades to an instant state change when the
// system asks for reduced motion. Tests always run that path: it keeps fake
// timers honest and continuously proves the fallback exists.
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual<Record<string, unknown>>('react-native-reanimated');

  // Spread alone loses the module's non-enumerable `__esModule` flag and
  // `default` export; without them the babel interop hands components the
  // whole module instead of the `Animated` namespace, and `Animated.View`
  // comes out undefined.
  return { __esModule: true, ...actual, default: actual.default, useReducedMotion: () => true };
});

// The camera is a native module with no Jest implementation. The mock keeps
// the LivePlay tree mountable with no permission granted — exactly the path
// the screen falls back from, so tests exercise the real fallback rather than
// a pretend camera. The screen reader itself needs no mock: it is pure TS, and
// its Skia template renderer returns null under Jest by design.
jest.mock('react-native-vision-camera', () => ({
  Camera: () => null,
  useCameraPermission: () => ({
    hasPermission: false,
    requestPermission: jest.fn().mockResolvedValue(false),
  }),
  useFrameOutput: () => ({}),
}));

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
