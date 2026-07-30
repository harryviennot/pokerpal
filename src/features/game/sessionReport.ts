/**
 * The arithmetic behind a finished session's report.
 *
 * `summarizeSession` and `topLeaks` already answer what a pile of graded
 * decisions adds up to; what the engine cannot answer is *which hand* a decision
 * came from, because a `DecisionReview` does not carry a hand number. The
 * summary needs that to offer a replay, so this module walks the store's
 * per-hand records and hands the coach's own verdicts back with their hand
 * attached. Pure, so every case is checked without rendering anything.
 */

import { bestDecision, costliestDecision, type DecisionReview, type Grade } from '@/engine';

import { type HandCoachRecord } from './types';

/** A graded decision plus the hand it happened in, which the replay link needs. */
export interface SessionHighlight {
  handNumber: number;
  review: DecisionReview;
}

export interface SessionHighlights {
  /** The correct decision made for the biggest pot, or null when there was none. */
  best: SessionHighlight | null;
  /** The decision that gave up the most, or null when nothing really cost anything. */
  worst: SessionHighlight | null;
}

/** What the two highlights are called, wherever they are shown. */
export const HIGHLIGHT_LABELS = {
  best: 'Best decision',
  worst: 'Costliest decision',
} as const;

/** Best to worst, so a breakdown always reads in the same direction. */
export const GRADE_ORDER: readonly Grade[] = ['correct', 'marginal', 'mistake', 'blunder'];

/**
 * The floor for calling a decision the costliest one, in chips.
 *
 * A session of clean play has a "worst" decision too, and it is noise: naming
 * the one that gave up a third of a chip teaches nothing and reads as a
 * telling-off. Below this, and for anything the coach still graded correct,
 * there is no costliest decision to show.
 */
export const MIN_COSTLY_CHIPS = 1;

/** The session's best and costliest decisions, each with the hand it came from. */
export function highlightsOf(history: readonly HandCoachRecord[]): SessionHighlights {
  const all = history.flatMap((record) => record.reviews);

  return {
    best: locate(history, bestDecision(all)),
    worst: locate(history, costliestDecision(all.filter(isCostly))),
  };
}

/** How many decisions earned each verdict across the session. */
export function tallyGrades(history: readonly HandCoachRecord[]): Record<Grade, number> {
  const counts: Record<Grade, number> = { correct: 0, marginal: 0, mistake: 0, blunder: 0 };

  for (const record of history) {
    for (const review of record.reviews) {
      counts[review.grade] += 1;
    }
  }

  return counts;
}

/** How long the session ran, as a person would say it: `43 min`, `1 h 12 min`. */
export function describeDuration(ms: number): string {
  const minutes = Math.round(Math.max(0, ms) / 60_000);

  if (minutes < 1) {
    return 'under a minute';
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const remainder = minutes % 60;
  const hours = Math.floor(minutes / 60);

  return remainder === 0 ? `${hours} h` : `${hours} h ${remainder} min`;
}

/** Whether a decision cost enough, and graded badly enough, to be worth naming. */
function isCostly(review: DecisionReview): boolean {
  return review.grade !== 'correct' && review.evLoss >= MIN_COSTLY_CHIPS;
}

/**
 * The hand a verdict belongs to.
 *
 * Identity, not equality: the engine's pickers return one of the reviews they
 * were handed, so the owning hand is the one whose array *contains* that object.
 * Two decisions can match in every field and belong to different hands, which is
 * exactly what a search by value would get wrong.
 */
function locate(
  history: readonly HandCoachRecord[],
  review: DecisionReview | null,
): SessionHighlight | null {
  if (review === null) {
    return null;
  }

  const owner = history.find((record) => record.reviews.includes(review));

  return owner ? { handNumber: owner.handNumber, review } : null;
}
