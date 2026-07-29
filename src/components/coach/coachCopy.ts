/**
 * The words the practice surfaces put on the engine's poker terms.
 *
 * Copy only — every number next to these labels comes out of the engine and
 * may not be rounded into a different claim on the way to the screen.
 */

import { type Grade, type Leak, type Street } from '@/engine';

export const STREET_LABELS: Record<Street, string> = {
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
};

export const GRADE_LABELS: Record<Grade, string> = {
  correct: 'Correct',
  marginal: 'Marginal',
  mistake: 'Mistake',
  blunder: 'Blunder',
};

export type GradeTone = 'success' | 'warning' | 'danger';

export const GRADE_TONES: Record<Grade, GradeTone> = {
  correct: 'success',
  marginal: 'warning',
  mistake: 'danger',
  blunder: 'danger',
};

export const LEAK_LABELS: Record<Leak, string> = {
  preflopLooseness: 'Playing too many hands',
  chasingWithoutOdds: 'Chasing without the odds',
  missedValue: 'Missed value bets',
  overBluffing: 'Over-bluffing',
  positional: 'Positional errors',
};

/** One concrete thing to do about each habit — the session's focus point. */
export const LEAK_FOCUS: Record<Leak, string> = {
  preflopLooseness: 'Fold more before the flop. A hand worth playing rates to be best right now.',
  chasingWithoutOdds: 'Before calling with a draw, compare the price to your equity.',
  missedValue: 'Bet your strong hands. Checking them leaves chips on the table.',
  overBluffing: 'Bluff less. Bet when the math says your hand rates to be ahead.',
  positional: 'Play tighter with players still to act behind you.',
};
