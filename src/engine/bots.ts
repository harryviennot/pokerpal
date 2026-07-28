/**
 * Bot policies.
 *
 * A policy is a pure function from the table to a decision: the state it is
 * given, the actions the rules allow, and a seeded RNG for anything it wants to
 * mix. It never reaches for the deck, never inspects a hand it cannot see, and
 * never mutates what it is handed — so a session replays exactly from its seed
 * whether a human or a bot was in the seat.
 *
 * This file holds only the two baselines the PRD measures against: always-call
 * and always-fold. They are deliberately terrible. Their job is to be the floor
 * a real archetype has to beat over a long seeded run, and to stand in for an
 * opponent until those archetypes exist.
 */

import { legalActions } from './betting';
import { applyAction } from './hand';
import { type Rng } from './rng';
import {
  InvalidTableError,
  type Action,
  type HandState,
  type LegalAction,
  type SeatIndex,
} from './table';

/**
 * Chooses one of `legal`. Callers pass the result straight to `applyAction`, so
 * a policy that returns anything else is a bug the engine will throw on.
 */
export type BotPolicy = (state: HandState, legal: readonly LegalAction[], rng: Rng) => Action;

/**
 * The calling station taken to its limit: pays any price, never raises.
 *
 * The PRD's lower baseline — a Medium bot that cannot take chips off this over
 * a thousand hands is not a Medium bot.
 */
export const alwaysCall: BotPolicy = (_state, legal) => {
  const call = legal.find((action) => action.type === 'call');

  return call ? { type: 'call' } : { type: 'check' };
};

/** Folds to any bet and checks when it is free. The cheapest possible opponent. */
export const alwaysFold: BotPolicy = (_state, legal) => {
  const fold = legal.find((action) => action.type === 'fold');

  return fold ? { type: 'fold' } : { type: 'check' };
};

/**
 * Combines one policy per seat into a single policy that dispatches on whoever
 * is on the clock, so a table of different personalities is still just a
 * `BotPolicy` to everything downstream.
 *
 * @throws {InvalidTableError} when the seat on the clock has no policy.
 */
export function bySeat(policies: readonly BotPolicy[]): BotPolicy {
  return (state, legal, rng) => {
    const policy = state.toAct === null ? undefined : policies[state.toAct];

    if (!policy) {
      throw new InvalidTableError(`No policy for seat ${state.toAct}.`);
    }

    return policy(state, legal, rng);
  };
}

/**
 * Runs `policy` for whoever is on the clock until the hand needs a decision from
 * `seat`, or ends.
 *
 * The loop is bounded rather than trusting the hand to terminate: a policy that
 * returned an illegal action would otherwise spin here rather than throwing.
 */
export function playUntilSeat(
  state: HandState,
  seat: SeatIndex,
  policy: BotPolicy,
  rng: Rng,
): HandState {
  let current = state;

  for (let step = 0; step < MAX_STEPS; step++) {
    if (current.complete || current.toAct === null || current.toAct === seat) {
      return current;
    }

    const legal = legalActions(current);

    if (legal.length === 0) {
      return current;
    }

    current = applyAction(current, policy(current, legal, rng));
  }

  return current;
}

/** Well above the longest hand the invariant harness has ever produced. */
const MAX_STEPS = 500;
