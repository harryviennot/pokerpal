/**
 * The words the practice surfaces put on the engine's poker terms.
 *
 * Copy only — every number next to these labels comes out of the engine and
 * may not be rounded into a different claim on the way to the screen.
 *
 * Most of it exists twice. A beginner reading "Blunder, −5.0 bb" learns nothing
 * they can act on, but deleting the poker words would leave them unable to
 * follow a conversation at a real table — so both registers ship and the player
 * chooses. The two must always describe the same decision with the same figures;
 * the mapping between them is the thing being taught.
 */

import { type Grade, type Leak, type Street } from '@/engine';

/**
 * Which words the coach uses.
 *
 * `poker` is the vocabulary you will hear at a table. `plain` is the same
 * verdict said in ordinary English. Neither is a translation of the other in the
 * loose sense — they are the same facts, worded for two different readers.
 */
export type CoachLanguage = 'plain' | 'poker';

export const STREET_LABELS: Record<Street, string> = {
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
};

/** The streets, for a reader who has not met the words yet. */
export const STREET_LABELS_PLAIN: Record<Street, string> = {
  preflop: 'Before the flop',
  flop: 'First three cards',
  turn: 'Fourth card',
  river: 'Last card',
  showdown: 'Showdown',
};

export function streetLabels(language: CoachLanguage): Record<Street, string> {
  return language === 'plain' ? STREET_LABELS_PLAIN : STREET_LABELS;
}

const GRADE_LABELS_POKER: Record<Grade, string> = {
  correct: 'Correct',
  marginal: 'Marginal',
  mistake: 'Mistake',
  blunder: 'Blunder',
};

/**
 * The same four bands without the jargon.
 *
 * `mistake` keeps its name: it is already the plain word, and inventing a
 * different one for the sake of symmetry would make the two registers harder to
 * map onto each other, not easier.
 */
const GRADE_LABELS_PLAIN: Record<Grade, string> = {
  correct: 'Well played',
  marginal: 'Close call',
  mistake: 'Mistake',
  blunder: 'Costly mistake',
};

export function gradeLabels(language: CoachLanguage): Record<Grade, string> {
  return language === 'plain' ? GRADE_LABELS_PLAIN : GRADE_LABELS_POKER;
}

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

/** The same five habits named the way a player would describe them to a friend. */
export const LEAK_LABELS_PLAIN: Record<Leak, string> = {
  preflopLooseness: 'Playing too many hands',
  chasingWithoutOdds: 'Paying too much to chase',
  missedValue: 'Not betting your good hands',
  overBluffing: 'Bluffing too often',
  positional: 'Acting too early in the order',
};

export function leakLabels(language: CoachLanguage): Record<Leak, string> {
  return language === 'plain' ? LEAK_LABELS_PLAIN : LEAK_LABELS;
}

/** One concrete thing to do about each habit — the session's focus point. */
export const LEAK_FOCUS: Record<Leak, string> = {
  preflopLooseness: 'Fold more before the flop. A hand worth playing rates to be best right now.',
  chasingWithoutOdds: 'Before calling with a draw, compare the price to your equity.',
  missedValue: 'Bet your strong hands. Checking them leaves chips on the table.',
  overBluffing: 'Bluff less. Bet when the math says your hand rates to be ahead.',
  positional: 'Play tighter with players still to act behind you.',
};

export const LEAK_FOCUS_PLAIN: Record<Leak, string> = {
  preflopLooseness:
    'Throw more starting hands away. If it is not likely the best hand right now, it is not worth chips.',
  chasingWithoutOdds:
    'Before you pay to chase a card, check the price against how often you actually get there.',
  missedValue: 'Bet when you are ahead. Checking a good hand leaves money on the table.',
  overBluffing: 'Bluff less often. Put chips in when your hand is likely the best one.',
  positional: 'Be more careful when players after you have not spoken yet.',
};

export function leakFocus(language: CoachLanguage): Record<Leak, string> {
  return language === 'plain' ? LEAK_FOCUS_PLAIN : LEAK_FOCUS;
}
