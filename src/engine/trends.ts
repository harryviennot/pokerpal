/**
 * Whether the coach's verdicts are getting better.
 *
 * `leaks.ts` answers "what is costing me" over one pile of decisions. This
 * module answers "am I improving", which is a different question and a more
 * dangerous one: a trend is a claim about the future, and a chart drawn from
 * too little play is the coach lying with a picture. Everything here is built
 * to refuse that claim rather than dress it up.
 *
 * Pure folds over already-bucketed counts. The buckets — sessions, days, weeks —
 * are the caller's business; this module never sees a clock.
 */

import { type Grade } from './coach';

/** Grades that count against you. Marginal is a nudge, not a mistake. */
const MISTAKES: readonly Grade[] = ['mistake', 'blunder'];

/** Whether a grade counts towards the mistake rate. */
export function isMistake(grade: Grade): boolean {
  return MISTAKES.includes(grade);
}

/** One bucket of graded play — a session, a day, whatever the caller grouped by. */
export interface TrendPoint {
  /** The caller's identifier for the bucket. */
  key: number;
  /** When the bucket happened, in epoch milliseconds. */
  at: number;
  handsPlayed: number;
  decisionsGraded: number;
  /** Decisions graded `mistake` or `blunder`. */
  mistakes: number;
  /** Chips of expected value given up across the bucket. */
  evLost: number;
  /** The hero's chips won or lost across the bucket. */
  net: number;
}

export type TrendDirection = 'improving' | 'steady' | 'worsening' | 'unknown';

export interface Trend {
  /** Oldest first, so the chart reads left to right. */
  points: readonly TrendPoint[];
  /** Mistakes per 100 decisions across every point. */
  rate: number;
  /** The same rate over the recent half, and over the half before it. */
  recentRate: number;
  earlierRate: number;
  direction: TrendDirection;
}

/**
 * Enough play to say anything at all.
 *
 * Two buckets is a coin flip and forty decisions is one bad session; the log
 * already records twice that a poker number measured over a small sample is
 * measuring variance. Below either bar the direction is `unknown` and the UI
 * says so instead of drawing a line.
 */
export const MIN_POINTS = 4;
export const MIN_DECISIONS = 40;

/**
 * How far the rate must move before the movement is called.
 *
 * A quarter of where the player started, with a floor of two mistakes per
 * hundred. Relative, because a player at 30 mistakes per 100 and one at 4 are
 * not the same distance from noise; floored, because a tiny rate must not be
 * able to halve its way to "improving" on two decisions.
 *
 * Deliberately wide. The two errors are not symmetric: telling an improving
 * player they are getting worse costs trust the coach does not get back, while
 * missing a small genuine move only means the chart says "steady" for another
 * session. When in doubt, say nothing.
 */
const RELATIVE_BAND = 0.25;
const ABSOLUTE_BAND = 2;

/** Mistakes per 100 graded decisions. Zero decisions rate as zero, not as NaN. */
export function mistakeRate(points: readonly TrendPoint[]): number {
  const graded = points.reduce((sum, point) => sum + point.decisionsGraded, 0);

  if (graded === 0) {
    return 0;
  }

  return (points.reduce((sum, point) => sum + point.mistakes, 0) / graded) * 100;
}

/**
 * Reads a run of buckets as a direction of travel.
 *
 * The measure is a *rate* — mistakes per 100 decisions — and never a count,
 * because playing more poker must not look like playing worse. The comparison
 * is the recent half against the earlier one rather than a fitted line: it needs
 * no regression to explain, it survives one wild session, and a player can check
 * it themselves.
 *
 * Points may arrive in any order; they come back oldest first.
 */
export function summarizeTrend(points: readonly TrendPoint[]): Trend {
  const ordered = [...points].sort((a, b) => a.at - b.at || a.key - b.key);
  const half = Math.floor(ordered.length / 2);
  const earlier = ordered.slice(0, half);
  const recent = ordered.slice(ordered.length - half);

  const rate = mistakeRate(ordered);
  const recentRate = mistakeRate(recent);
  const earlierRate = mistakeRate(earlier);

  return { points: ordered, rate, recentRate, earlierRate, direction: direction(ordered) };
}

function direction(ordered: readonly TrendPoint[]): TrendDirection {
  const graded = ordered.reduce((sum, point) => sum + point.decisionsGraded, 0);

  if (ordered.length < MIN_POINTS || graded < MIN_DECISIONS) {
    return 'unknown';
  }

  const half = Math.floor(ordered.length / 2);
  const earlier = mistakeRate(ordered.slice(0, half));
  const recent = mistakeRate(ordered.slice(ordered.length - half));
  const move = recent - earlier;
  const band = Math.max(ABSOLUTE_BAND, earlier * RELATIVE_BAND);

  if (Math.abs(move) < band) {
    return 'steady';
  }

  return move < 0 ? 'improving' : 'worsening';
}
