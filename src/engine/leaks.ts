/**
 * Aggregating the coach's verdicts.
 *
 * `coach.ts` grades one decision; this module answers the questions a player
 * asks after several — what habit is costing me, which decision hurt most, how
 * did the session go. Pure folds over `DecisionReview[]`, so the tracker UI and
 * the future cross-session dashboard read the same arithmetic.
 */

import { type DecisionReview, type Leak } from './coach';

export interface LeakTally {
  leak: Leak;
  /** Decisions that were evidence of this habit. */
  count: number;
  /** Chips of expected value given up to it. */
  evLoss: number;
}

/** One finished hand's contribution to a session, as the store records it. */
export interface SessionCoachRecord {
  /** The hero's chips won or lost on the hand. */
  net: number;
  reviews: readonly DecisionReview[];
}

export interface SessionSummary {
  handsPlayed: number;
  /** The hero's chips won or lost across the session. */
  net: number;
  /** The best single hand, or 0 when none was won. */
  biggestWin: number;
  /** The worst single hand as a negative number, or 0 when none was lost. */
  biggestLoss: number;
  decisionsGraded: number;
  /** The costliest leak — the one thing to work on. Null when nothing leaked. */
  focus: Leak | null;
}

/**
 * Groups leaked decisions by habit, costliest habit first.
 *
 * Sorted by chips given up rather than by count: three cheap positional slips
 * matter less than one habitual bad call, and the order should say so.
 */
export function tallyLeaks(reviews: readonly DecisionReview[]): LeakTally[] {
  const byLeak = new Map<Leak, LeakTally>();

  for (const review of reviews) {
    if (review.leak === null) {
      continue;
    }

    const tally = byLeak.get(review.leak) ?? { leak: review.leak, count: 0, evLoss: 0 };

    byLeak.set(review.leak, {
      leak: review.leak,
      count: tally.count + 1,
      evLoss: tally.evLoss + review.evLoss,
    });
  }

  return [...byLeak.values()].sort((a, b) => b.evLoss - a.evLoss);
}

/** The costliest habits — the PRD's "your top 3 leaks". */
export function topLeaks(reviews: readonly DecisionReview[], limit = 3): LeakTally[] {
  return tallyLeaks(reviews).slice(0, limit);
}

/** The decision that gave up the most, which is the one worth showing first. */
export function costliestDecision(reviews: readonly DecisionReview[]): DecisionReview | null {
  return reviews.reduce<DecisionReview | null>(
    (worst, review) => (worst === null || review.evLoss > worst.evLoss ? review : worst),
    null,
  );
}

/**
 * The correct decision made for the biggest pot.
 *
 * "Best" cannot mean lowest EV loss — every correct decision ties at nothing
 * given up — so it means the correct one with the most at stake, which is the
 * one that took the most nerve to get right.
 */
export function bestDecision(reviews: readonly DecisionReview[]): DecisionReview | null {
  return reviews.reduce<DecisionReview | null>(
    (best, review) =>
      review.grade === 'correct' && (best === null || review.facts.pot > best.facts.pot)
        ? review
        : best,
    null,
  );
}

/** Folds a session's records into the numbers its summary shows. */
export function summarizeSession(records: readonly SessionCoachRecord[]): SessionSummary {
  const summary = records.reduce(
    (sum, record) => ({
      net: sum.net + record.net,
      biggestWin: Math.max(sum.biggestWin, record.net),
      biggestLoss: Math.min(sum.biggestLoss, record.net),
      decisionsGraded: sum.decisionsGraded + record.reviews.length,
    }),
    { net: 0, biggestWin: 0, biggestLoss: 0, decisionsGraded: 0 },
  );

  return {
    handsPlayed: records.length,
    ...summary,
    focus:
      topLeaks(
        records.flatMap((record) => record.reviews),
        1,
      )[0]?.leak ?? null,
  };
}
