import { type DecisionReview } from '@/engine';

import { usePracticeStore } from './usePracticeStore';

/**
 * The coach's grades for the hero's current hand.
 *
 * Empty while the hand is live — the store only grades a finished hand, so a
 * verdict can never leak the ranges the coach modelled mid-play.
 */
export function useHandCoach(): readonly DecisionReview[] {
  return usePracticeStore((state) => state.reviews);
}
