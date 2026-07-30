/**
 * Grading a finished hand without dropping a frame.
 *
 * `reviewHand` grades a whole hand in one call, which at 1 500 Monte Carlo
 * samples per decision is long enough to stall the table for a visible moment
 * just as the pot is being pushed. This spreads the same work over one decision
 * per event-loop tick, the way `useEquity` spreads the calculator's sampling.
 *
 * **The order and the Rng are load-bearing.** `reviewDecision` draws from the
 * generator it is handed, so a verdict depends on how many decisions were graded
 * before it. Walking `decisionPoints` front to back on ONE generator seeded with
 * the hand's own seed is the only way to reach the verdicts `reviewHand` reaches;
 * a fresh generator per tick would be a different coach. `grading.test.ts`
 * asserts the equality, and `src/engine/coach.test.ts` asserts the contract from
 * the engine's side.
 */

import {
  createRng,
  decisionPoints,
  reviewDecision,
  type DecisionReview,
  type HandState,
  type SeatIndex,
  type TableConfig,
} from '@/engine';

/**
 * Samples per graded decision.
 *
 * Grading happens once per hand while the result is on screen, so it can afford
 * to be accurate — but only because it is chunked; the same figure in one call
 * is what would stall.
 */
export const GRADE_ITERATIONS = 1_500;

export interface HandGrader {
  /**
   * Grades the next decision. False once there is nothing left, which is the
   * caller's signal to stop scheduling ticks.
   */
  step(): boolean;
  reviews(): readonly DecisionReview[];
  done(): boolean;
}

/**
 * A grader for one finished hand, to be stepped a decision at a time.
 *
 * Grade only completed hands: the coach models the ranges every other seat could
 * hold, and a verdict shown mid-hand would tell the player what the table has.
 */
export function createHandGrader(
  hand: HandState,
  seats: readonly { id: string; stack: number }[],
  heroSeat: SeatIndex,
): HandGrader {
  const points = decisionPoints(tableConfigOf(hand, seats), hand.events, heroSeat);
  // One generator for the whole walk, created here rather than per step.
  const options = { rng: createRng(hand.seed), iterations: GRADE_ITERATIONS };
  const reviews: DecisionReview[] = [];
  let cursor = 0;

  return {
    step() {
      const point = points[cursor];

      if (!point) {
        return false;
      }

      cursor++;

      const review = reviewDecision(point.state, point.action, options);

      // A point the coach declines to grade still costs no samples, so skipping
      // it here cannot shift the verdicts that follow.
      if (review) {
        reviews.push(review);
      }

      return true;
    },

    reviews: () => reviews,

    done: () => cursor >= points.length,
  };
}

/** The table a hand was dealt at, which is what re-dealing it needs. */
export function tableConfigOf(
  hand: HandState,
  seats: readonly { id: string; stack: number }[],
): TableConfig {
  return {
    seats,
    button: hand.button,
    blinds: hand.blinds,
    handNumber: hand.handNumber,
    seed: hand.seed,
  };
}
