/**
 * The coach, in sentences.
 *
 * The engine produces a grade, a number and a terse factual line — "Called 40%
 * of pot with 18% equity and no draw, needing 25%." That is exact and, to a
 * player who has never been taught the words, unreadable. This module turns the
 * same facts into either register: the poker one, for someone learning the
 * vocabulary they will hear at a table, and the plain one, for someone who just
 * wants to know what they did wrong.
 *
 * **Every figure here comes from `DecisionFacts`, `evLoss`, `action` or `best`.**
 * Nothing is estimated, softened or rounded into a different claim, and the two
 * registers must always state the same numbers — a player switching between them
 * is checking that the words mean what they think, and a figure that moved would
 * teach them the opposite of the truth.
 *
 * Pure and framework-free, so the whole matrix of grades, habits and actions is
 * covered by a colocated test rather than by rendering screens.
 */

import {
  type Action,
  type DecisionFacts,
  type DecisionReview,
  type Recommendation,
} from '@/engine';
import { formatChips, formatPercentWhole } from '@/utils/format';

import { type CoachLanguage } from './coachCopy';

export interface Explanation {
  /** What you did, in a sentence. */
  what: string;
  /** Why it was graded that way. One or two sentences, each stands alone. */
  why: readonly string[];
  /** What it cost, or null when it cost nothing worth naming. */
  cost: string | null;
  /** What to do instead next time, or null when there is nothing to change. */
  instead: string | null;
}

export interface ExplainOptions {
  language: CoachLanguage;
  /**
   * The blind the hand was played at, so a cost can be quoted in the unit the
   * grade is measured in. Omit when the caller spans several blind levels — one
   * big-blind figure across a session whose stakes climbed would be wrong.
   */
  bigBlind?: number;
}

/**
 * Below this, a cost is not worth naming.
 *
 * The same reasoning as the engine's bottom grade band: equity is sampled and
 * ranges are estimated, so telling a player a decision cost them a third of a
 * chip is false precision that reads as a telling-off.
 */
const MIN_NAMEABLE_COST = 1;

/** The verdict on a decision already made, said in the chosen register. */
export function explainReview(review: DecisionReview, options: ExplainOptions): Explanation {
  const { facts, action, best, evLoss } = review;
  const plain = options.language === 'plain';

  return {
    what: plain ? plainWhat(action, facts) : review.reason,
    why: plain ? plainWhy(facts) : pokerWhy(facts),
    cost: describeCost(evLoss, options),
    instead: sameShape(action, best) ? null : describeInstead(best, plain),
  };
}

/** The move the coach would make now, before the decision is taken. */
export function explainRecommendation(
  recommendation: Recommendation,
  options: ExplainOptions,
): { headline: string; why: readonly string[] } {
  const plain = options.language === 'plain';

  return {
    headline: actionHeadline(recommendation.best, plain),
    why: plain ? plainWhy(recommendation.facts) : pokerWhy(recommendation.facts),
  };
}

/** `Raise to 65`, or `Fold`. The one line the guide leads with. */
export function actionHeadline(action: Action, plain: boolean): string {
  switch (action.type) {
    case 'fold':
      return plain ? 'Give this one up' : 'Fold';
    case 'check':
      return plain ? 'Stay in for free' : 'Check';
    case 'call':
      return plain ? 'Match their bet' : 'Call';
    case 'bet':
      return `${plain ? 'Bet' : 'Bet'} ${formatChips(action.to)}`;
    case 'raise':
      return `${plain ? 'Raise to' : 'Raise to'} ${formatChips(action.to)}`;
  }
}

/** What the player did, without a poker word in it. */
function plainWhat(action: Action, facts: DecisionFacts): string {
  const pot = formatChips(facts.pot);

  switch (action.type) {
    case 'fold':
      return facts.toCall > 0
        ? `You gave up rather than pay ${formatChips(facts.toCall)} into a pot of ${pot}.`
        : 'You gave up the hand with nothing to pay.';
    case 'check':
      return `You stayed in for free, with ${pot} in the middle.`;
    case 'call':
      return `You paid ${formatChips(facts.toCall)} to stay in, for a pot of ${pot}.`;
    case 'bet':
      return `You put chips in first, with ${pot} in the middle.`;
    case 'raise':
      return `You put in more than they did, with ${pot} in the middle.`;
  }
}

/**
 * The reasoning, in ordinary English.
 *
 * Odds are given twice — as the percentage the engine measured and as a
 * "1 time in N" — because the second is the form a beginner can hold in their
 * head at the table and the first is the one that has to stay checkable.
 */
function plainWhy(facts: DecisionFacts): readonly string[] {
  const chances = `Your cards win about ${oneInPhrase(facts.equity)} here (${formatPercentWhole(facts.equity)}), against what their betting says they could have.`;
  const why = [chances];

  if (facts.toCall > 0) {
    why.push(
      `To break even on that price you needed to win ${oneInPhrase(facts.requiredEquity)} (${formatPercentWhole(facts.requiredEquity)}).`,
    );
  }

  if (facts.outs > 0) {
    why.push(
      `There ${facts.outs === 1 ? 'is 1 card' : `are ${facts.outs} cards`} left that would give you the hand you are chasing.`,
    );
  }

  if (facts.playersBehind > 0) {
    why.push(
      `${facts.playersBehind === 1 ? '1 player' : `${facts.playersBehind} players`} had not spoken yet, so you were committing chips before you knew what they would do.`,
    );
  }

  return why;
}

/** The same reasoning in the vocabulary a table uses. */
function pokerWhy(facts: DecisionFacts): readonly string[] {
  const why = [`${formatPercentWhole(facts.equity)} equity against their modelled range.`];

  if (facts.toCall > 0) {
    why.push(
      `Pot odds of ${formatChips(facts.toCall)} into ${formatChips(facts.pot)} need ${formatPercentWhole(facts.requiredEquity)}.`,
    );
  }

  why.push(facts.outs > 0 ? `${facts.outs} outs to improve.` : 'No draw to fall back on.');

  if (facts.playersBehind > 0) {
    why.push(`${facts.playersBehind} still to act behind you.`);
  }

  return why;
}

/** What the decision gave up, or null when it gave up nothing worth naming. */
function describeCost(evLoss: number, options: ExplainOptions): string | null {
  if (evLoss < MIN_NAMEABLE_COST) {
    return null;
  }

  const plain = options.language === 'plain';
  const bigBlind = options.bigBlind;

  if (bigBlind !== undefined && bigBlind > 0) {
    const blinds = (evLoss / bigBlind).toFixed(1);

    return plain ? `That cost you about ${blinds} big blinds.` : `−${blinds} bb of expected value.`;
  }

  return plain
    ? `That cost you about ${formatChips(evLoss)} chips on average.`
    : `−${formatChips(evLoss)} chips of expected value.`;
}

/** The line the coach would have taken, as advice rather than a verdict. */
function describeInstead(best: Action, plain: boolean): string {
  return plain
    ? `Next time: ${actionHeadline(best, true).toLowerCase()}.`
    : `Best line: ${actionHeadline(best, false).toLowerCase()}.`;
}

/**
 * Whether two actions are the same move.
 *
 * Sizes are ignored on purpose. The coach's EV model has no opinion about
 * sizing, so telling a player to raise to 64 when they raised to 60 would be
 * advice the grade behind it cannot actually support.
 */
function sameShape(taken: Action, best: Action): boolean {
  const aggressive = (action: Action): boolean => action.type === 'bet' || action.type === 'raise';

  return taken.type === best.type || (aggressive(taken) && aggressive(best));
}

/**
 * A probability as `1 time in N`, the form you can count on your fingers.
 *
 * Clamped at 20 rather than reporting `1 time in 340`: past a certain point the
 * only thing a player needs to take away is "basically never", and a precise
 * denominator makes it sound like a considered chance.
 */
function oneInPhrase(probability: number): string {
  if (probability <= 0) {
    return 'never';
  }

  if (probability >= 0.995) {
    return 'every time';
  }

  const denominator = Math.round(1 / probability);

  if (denominator >= 20) {
    return 'less than 1 time in 20';
  }

  return denominator <= 1 ? 'almost every time' : `1 time in ${denominator}`;
}
