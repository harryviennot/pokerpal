/**
 * The named bot archetypes.
 *
 * These sit at the PRD's second layer: hand evaluation underneath, then equity
 * against the price the pot is offering. They do not model an opponent's range
 * and they do not balance their bluffs — that is the Hard and Shark work, and it
 * needs the layers above this one. What they do have is a personality, and the
 * leaks that come with it, because a player learns more from an opponent whose
 * mistake they can name than from one that is merely correct.
 *
 * Every read is noisy and every threshold is a frequency, so the same bot in the
 * same spot does not always do the same thing — but given the same seeded RNG it
 * does, which is what makes a session replayable and a measurement repeatable.
 */

import { type BotPolicy } from './bots';
import { simulateEquity } from './equity';
import { potRaiseTo, requiredEquity } from './potOdds';
import { type Rng } from './rng';
import {
  amountToCall,
  contestingPlayers,
  playerAt,
  totalPot,
  type Action,
  type HandState,
  type LegalAction,
} from './table';

/**
 * A personality, in six numbers.
 *
 * `entry` and `raiseAt` are in units of an *even share* of the pot: 1.0 is the
 * equity a hand would have if every live player were equally likely to win, so
 * the same threshold means the same thing heads-up and six-handed. Raw equity
 * would not — 30% is a monster against five opponents and a fold heads-up.
 */
export interface BotProfile {
  name: string;
  /** Strength, in even shares, before this bot puts chips in voluntarily. */
  entry: number;
  /** Equity points worse than the break-even price this bot will still call. */
  callSlack: number;
  /** Strength, in even shares, a value raise wants. */
  raiseAt: number;
  /** How often a raise is actually taken when it is available, 0 to 1. */
  aggression: number;
  /** How often a hand with nothing bets anyway, 0 to 1. */
  bluff: number;
  /** Bet and raise size, as a fraction of the pot. */
  betSize: number;
  /** Noise on every equity read, in equity points. The tilt dial. */
  noise: number;
}

/** Very tight, and only interested when it already has the best of it. */
export const ROCK: BotProfile = {
  name: 'The Rock',
  entry: 1.5,
  callSlack: 0,
  raiseAt: 2.1,
  aggression: 0.55,
  bluff: 0.01,
  betSize: 0.6,
  noise: 0.02,
};

/** Pays to see it every time, and almost never raises even when it should. */
export const CALLING_STATION: BotProfile = {
  name: 'The Calling Station',
  entry: 0.55,
  callSlack: 0.22,
  raiseAt: 2.6,
  aggression: 0.12,
  bluff: 0,
  betSize: 0.45,
  noise: 0.05,
};

/** Raises with anything, and keeps raising. Loses fast, and is loud about it. */
export const MANIAC: BotProfile = {
  name: 'The Maniac',
  entry: 0.5,
  callSlack: 0.18,
  raiseAt: 1.05,
  aggression: 0.85,
  bluff: 0.45,
  betSize: 0.9,
  noise: 0.1,
};

/** Tight, aggressive, and the closest thing here to solid fundamentals. */
export const TAG: BotProfile = {
  name: 'The TAG',
  entry: 1.25,
  callSlack: 0.02,
  raiseAt: 1.6,
  aggression: 0.75,
  bluff: 0.12,
  betSize: 0.7,
  noise: 0.03,
};

export const ARCHETYPES: readonly BotProfile[] = [ROCK, CALLING_STATION, MANIAC, TAG];

export interface BotOptions {
  /**
   * Monte Carlo samples per decision. The default is deliberately low: a bot
   * needs to know whether it is ahead, not to four decimal places, and this runs
   * once per decision for every seat of every hand of a simulation.
   */
  iterations?: number;
}

const DEFAULT_ITERATIONS = 120;

/** Builds a policy that plays the given personality. */
export function makeBot(profile: BotProfile, options: BotOptions = {}): BotPolicy {
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;

  return (state, legal, rng) => decide(state, legal, rng, profile, iterations);
}

function decide(
  state: HandState,
  legal: readonly LegalAction[],
  rng: Rng,
  profile: BotProfile,
  iterations: number,
): Action {
  const check = legal.find((action) => action.type === 'check');
  const raise = legal.find((action) => action.type === 'bet' || action.type === 'raise');
  const seat = state.toAct;

  if (seat === null) {
    return fallback(legal);
  }

  const player = playerAt(state, seat);

  if (!player.holeCards) {
    return fallback(legal);
  }

  const opponents = contestingPlayers(state).length - 1;

  if (opponents < 1) {
    return fallback(legal);
  }

  const raw = simulateEquity({
    hero: player.holeCards,
    board: state.board,
    opponents: Array.from({ length: opponents }, () => ({ kind: 'random' }) as const),
    iterations,
    rng,
  }).equity;

  const equity = clamp01(raw + (rng.next() * 2 - 1) * profile.noise);
  // In even shares of the pot, so one threshold works at any table size.
  const strength = equity * (opponents + 1);

  const pot = totalPot(state);
  const toCall = amountToCall(state, seat);

  const raising =
    raise !== undefined &&
    (strength >= profile.raiseAt
      ? rng.next() < profile.aggression
      : check !== undefined && rng.next() < profile.bluff);

  if (raising && raise !== undefined && (raise.type === 'bet' || raise.type === 'raise')) {
    const to = clamp(
      potRaiseTo(profile.betSize, pot, toCall, player.committedThisStreet),
      raise.min,
      raise.max,
    );

    return raise.type === 'bet' ? { type: 'bet', to } : { type: 'raise', to };
  }

  if (check) {
    return { type: 'check' };
  }

  // Facing a bet: the price has to be right *and* the hand has to be worth
  // entering with. A station has almost no entry bar and a rock has a high one,
  // which is exactly the leak each of them is named for.
  const priced = equity + profile.callSlack >= requiredEquity(pot, toCall);

  return priced && strength >= profile.entry ? { type: 'call' } : { type: 'fold' };
}

/** The safest legal action when there is nothing to reason about. */
function fallback(legal: readonly LegalAction[]): Action {
  if (legal.some((action) => action.type === 'check')) {
    return { type: 'check' };
  }

  return legal.some((action) => action.type === 'fold') ? { type: 'fold' } : { type: 'call' };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
