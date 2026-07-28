/**
 * Pot odds: the price a bet offers, and whether hero's equity beats it.
 *
 * All probabilities here are 0 to 1, never percentages.
 */

export type CallVerdict = 'profitable' | 'marginal' | 'unprofitable';

export interface PotOdds {
  /** Equity hero needs to break even on the call, 0 to 1. */
  requiredEquity: number;
  /** Chips returned per chip risked, e.g. 3 when calling 25 into a pot of 100. */
  oddsRatio: number;
  /** Hero's actual equity minus the required equity. Positive is a profitable call. */
  edge: number;
  verdict: CallVerdict;
  /** Chips won or lost on average per call, in the same units as `pot`. */
  expectedValue: number;
}

export class InvalidPotOddsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPotOddsError';
  }
}

/**
 * Equity needed to break even calling `toCall` into `pot`.
 *
 * `pot` is the pot before hero calls but including the opponent's bet, which is
 * how a player reads it at the table.
 */
export function requiredEquity(pot: number, toCall: number): number {
  if (!Number.isFinite(pot) || pot < 0) {
    throw new InvalidPotOddsError(`Pot must be a non-negative number, got ${pot}.`);
  }

  if (!Number.isFinite(toCall) || toCall <= 0) {
    throw new InvalidPotOddsError(`Bet to call must be a positive number, got ${toCall}.`);
  }

  return toCall / (pot + toCall);
}

/** Anything inside this band of the break-even point is too close to call clearly. */
const MARGINAL_BAND = 0.02;

/** Compares hero's equity against the price offered. */
export function analyzePotOdds(pot: number, toCall: number, heroEquity: number): PotOdds {
  const needed = requiredEquity(pot, toCall);

  if (!Number.isFinite(heroEquity) || heroEquity < 0 || heroEquity > 1) {
    throw new InvalidPotOddsError(`Equity must be between 0 and 1, got ${heroEquity}.`);
  }

  const edge = heroEquity - needed;
  const verdict: CallVerdict =
    Math.abs(edge) <= MARGINAL_BAND ? 'marginal' : edge > 0 ? 'profitable' : 'unprofitable';

  return {
    requiredEquity: needed,
    oddsRatio: pot / toCall,
    edge,
    verdict,
    // Win the pot with probability `heroEquity`, otherwise lose the call.
    expectedValue: heroEquity * pot - (1 - heroEquity) * toCall,
  };
}
