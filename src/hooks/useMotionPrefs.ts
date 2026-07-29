import { useReducedMotion } from 'react-native-reanimated';

/**
 * Whether motion should degrade to instant state changes.
 *
 * One indirection over reanimated so every animation asks the same question —
 * and so an in-app "reduce motion" setting has a single place to land later.
 */
export function useMotionPrefs(): { reduceMotion: boolean } {
  return { reduceMotion: useReducedMotion() };
}
