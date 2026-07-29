/**
 * A real hand, played and graded through the engine, for tests to store.
 *
 * Not a hand-written fixture: the events come out of `applyAction` and the
 * verdicts out of `reviewHand`, so anything that round-trips this hand is
 * round-tripping the shapes the app actually produces — deck included.
 */

import {
  applyAction,
  createRng,
  legalActions,
  reviewHand,
  startHand,
  type Action,
  type DecisionReview,
  type HandEvent,
  type HandState,
  type SeatIndex,
  type TableConfig,
} from '@/engine';

export const HERO_SEAT: SeatIndex = 0;

export const SEATS = [
  { id: 'You', stack: 1000 },
  { id: 'Ava', stack: 1000 },
  { id: 'Ben', stack: 1000 },
] as const;

export interface PlayedHand {
  seats: readonly { id: string; stack: number }[];
  events: readonly HandEvent[];
}

function configFor(seed: number): TableConfig {
  return {
    seats: [...SEATS],
    button: 0,
    blinds: { smallBlind: 5, bigBlind: 10 },
    handNumber: 1,
    seed,
  };
}

/**
 * Plays a hand to completion with every seat checking or calling.
 *
 * Passive on purpose: nobody folds, so the hand reaches a showdown and the hero
 * makes a decision on every street. A fixture where the hero folds preflop has
 * exactly one verdict to show, which is not enough to test stepping through
 * them.
 */
export function playHand(seed = 42): PlayedHand {
  let state: HandState = startHand(configFor(seed), createRng(seed));

  for (let step = 0; step < 200 && !state.complete; step++) {
    state = applyAction(state, passiveAction(state));
  }

  return { seats: [...SEATS], events: state.events };
}

/**
 * The coach's verdicts on a played hand, sampled lightly.
 *
 * Few iterations on purpose: a test asserting that a grade is *shown* does not
 * need the equity behind it to be publishable, and the default 1 500 samples per
 * decision would dominate the suite.
 */
export function gradeHand(
  hand: PlayedHand,
  seed = 42,
  seat: SeatIndex = HERO_SEAT,
): DecisionReview[] {
  return reviewHand(configFor(seed), hand.events, seat, { iterations: 50, rng: createRng(seed) });
}

function passiveAction(state: HandState): Action {
  const legal = legalActions(state);
  const passive = legal.find((action) => action.type === 'check' || action.type === 'call');

  if (!passive) {
    throw new Error('A live hand must offer a check or a call.');
  }

  return { type: passive.type };
}
