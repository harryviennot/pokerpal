import { type DecisionReview } from '@/engine';

import { useGameStore } from './useGameStore';

/**
 * One stable empty array, so a subscriber between sessions is not handed a new
 * reference on every render and told the coaching changed.
 */
const NONE: readonly DecisionReview[] = [];

/**
 * The coach's grades for the hero's current hand.
 *
 * Empty while the hand is live: the store only grades a finished hand, so a
 * verdict can never leak the ranges the coach modelled mid-play. It also fills
 * in one decision at a time once the hand is over, because grading is chunked —
 * a consumer that counts them should expect the number to grow for a few ticks.
 */
export function useHandCoach(): readonly DecisionReview[] {
  return useGameStore((state) => state.game?.reviews ?? NONE);
}
