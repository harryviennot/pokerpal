import { useMemo } from 'react';

import { createRng, reviewHand, type DecisionReview, type HandState } from '@/engine';

/** Samples per decision. Review runs once per hand, off the hot path. */
const ITERATIONS = 1_500;

/**
 * Grades the hero's decisions in a hand that has finished.
 *
 * Returns nothing while the hand is live: a grade shown mid-hand would leak the
 * ranges the coach modelled and tell the player what the table is holding. The
 * PRD's per-decision "training wheels" mode is a deliberate setting, not the
 * default, and it needs its own thinking about what it may show.
 *
 * The seed is the hand's own, so re-opening a review never changes its verdict.
 */
export function useHandCoach(
  hand: HandState,
  heroSeat: number,
  seats: readonly { id: string; stack: number }[],
): readonly DecisionReview[] {
  return useMemo(() => {
    if (!hand.complete) {
      return [];
    }

    return reviewHand(
      {
        seats,
        button: hand.button,
        blinds: hand.blinds,
        handNumber: hand.handNumber,
        seed: hand.seed,
      },
      hand.events,
      heroSeat,
      { rng: createRng(hand.seed), iterations: ITERATIONS },
    );
  }, [hand, heroSeat, seats]);
}

/** The decision that cost the most, which is the one worth showing first. */
export function worstDecision(reviews: readonly DecisionReview[]): DecisionReview | null {
  return reviews.reduce<DecisionReview | null>(
    (worst, review) => (worst === null || review.evLoss > worst.evLoss ? review : worst),
    null,
  );
}
