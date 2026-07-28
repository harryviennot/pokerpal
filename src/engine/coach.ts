/**
 * Grading a decision against the math.
 *
 * Pillar C, and the reason the rest of the engine exists in the shape it does:
 * every number this file needs — equity against modelled ranges, the price the
 * pot offered, the draws that were live, the stack-to-pot ratio — is already
 * computed by a module below it. The coach adds judgement, not arithmetic.
 *
 * The unit throughout is **chips of expected value given up**, converted to big
 * blinds for the grade. That choice matters: a grade has to mean the same thing
 * at 5/10 as at 50/100, and "how many chips did that cost you" is the only
 * currency a player can act on. A fold that costs 0.1bb and a fold that costs
 * 12bb are not the same mistake even when both are technically wrong.
 *
 * The EV model is showdown-only — it asks what each line is worth if the hand
 * were checked down from here — which is honest for ranking the lines and too
 * generous about early streets. See `STREET_WEIGHT` for what is done about that
 * and what is deliberately not.
 *
 * What this file does **not** do is speak. It produces a grade, a number and a
 * terse factual reason; the LLM layer in `src/services` turns those into
 * sentences and may never invent a figure that did not come from here.
 */

import { legalActions } from './betting';
import { type Card } from './cards';
import { detectDraws } from './draws';
import { simulateEquity, type OpponentSpec } from './equity';
import { type HandEvent, type Street } from './events';
import { applyAction, dealHand } from './hand';
import { chenScore, modelOpponents } from './rangeModel';
import { type Rng } from './rng';
import {
  amountToCall,
  contestingPlayers,
  playerAt,
  totalPot,
  type Action,
  type HandState,
  type SeatIndex,
  type TableConfig,
} from './table';

export type Grade = 'correct' | 'marginal' | 'mistake' | 'blunder';

/**
 * The leak a decision is evidence of. Deliberately the PRD's own five
 * categories: they are the ones a player can recognise in themselves.
 */
export type Leak =
  'preflopLooseness' | 'chasingWithoutOdds' | 'missedValue' | 'overBluffing' | 'positional';

/** Everything the coach measured, kept alongside the verdict so it can be shown. */
export interface DecisionFacts {
  street: Street;
  /** Seats yet to act behind hero. Zero means hero closed the action. */
  playersBehind: number;
  /** Chips in the middle before hero acts, the bet being faced included. */
  pot: number;
  toCall: number;
  stack: number;
  /** Stack-to-pot ratio. `Infinity` when the pot is somehow empty. */
  spr: number;
  /** Hero's equity against the modelled ranges, 0 to 1. */
  equity: number;
  /** Equity needed to break even on the call. Zero when checking is free. */
  requiredEquity: number;
  /** Cards that complete a detected draw. Empty preflop and on the river. */
  outs: number;
}

export interface DecisionReview {
  seat: SeatIndex;
  action: Action;
  /** The action the coach would have taken. */
  best: Action;
  grade: Grade;
  /** Chips of expected value given up against `best`. Never negative. */
  evLoss: number;
  /** One line, factual, numbers only from `facts`. */
  reason: string;
  leak: Leak | null;
  facts: DecisionFacts;
}

export interface CoachOptions {
  /** Monte Carlo samples per decision. Review is not on the hot path; be accurate. */
  iterations?: number;
  /** Required. Grading is deterministic given the same RNG. */
  rng: Rng;
}

const DEFAULT_ITERATIONS = 2_000;

/**
 * Grade thresholds, in big blinds of expected value given up.
 *
 * The bottom band is not zero: equity here is sampled, ranges are estimated, and
 * calling a decision a mistake on a tenth of a blind of modelled EV would be
 * false precision dressed up as coaching.
 */
const GRADE_BANDS: readonly { grade: Grade; upTo: number }[] = [
  { grade: 'correct', upTo: 0.25 },
  { grade: 'marginal', upTo: 1 },
  { grade: 'mistake', upTo: 4 },
  { grade: 'blunder', upTo: Infinity },
];

/**
 * How much of the final pot is still to be bet, by street.
 *
 * The EV model below is showdown-only: it asks what a call is worth if the hand
 * were checked down from here. That is the right way to *rank* the lines — it
 * favours nothing and nobody — but it badly understates what an early mistake
 * costs, because the chips a preflop error commits you to keep going in for
 * three more streets. Folding aces on the button reads as 0.8bb of showdown EV
 * and is obviously not a 0.8bb mistake.
 *
 * So severity, and only severity, is weighted by how much betting is left. The
 * ranking of actions is untouched, which matters: scaling the EV of calling
 * would bias every grade towards calling more, and a coach that encourages
 * loose calls is worse than one that under-rates aces.
 *
 * These are coarse. They are a stand-in for a real multi-street EV model, and
 * they are the first thing to replace when one exists.
 */
const STREET_WEIGHT: Record<Street, number> = {
  preflop: 4,
  flop: 2.5,
  turn: 1.5,
  river: 1,
  showdown: 1,
};

/** Below this Chen score, entering a pot voluntarily is a losing habit. */
const LOOSE_ENTRY_SCORE = 8;

/** The share of the pot a value bet is assumed to make when it is called. */
const VALUE_BET_FRACTION = 0.66;

/**
 * Grades one decision, in the state the table was in when it was made.
 *
 * `state` must be waiting on `state.toAct`, and `action` is what that seat did.
 */
export function reviewDecision(
  state: HandState,
  action: Action,
  options: CoachOptions,
): DecisionReview | null {
  const seat = state.toAct;

  if (seat === null || state.complete) {
    return null;
  }

  const player = playerAt(state, seat);

  if (!player.holeCards) {
    return null;
  }

  const facts = measure(state, seat, player.holeCards, options);
  const pot = facts.pot;
  const toCall = facts.toCall;

  // Chips already in the middle are sunk: folding is worth exactly nothing from
  // here, which is what every other line is measured against.
  const evCall = toCall > 0 ? facts.equity * (pot + toCall) - toCall : 0;
  const canRaise = legalActions(state).some(
    (legal) => legal.type === 'bet' || legal.type === 'raise',
  );
  const evValueBet = canRaise ? valueBetEv(pot, facts.equity) : Number.NEGATIVE_INFINITY;

  const lines: { action: Action; ev: number }[] = [
    toCall > 0 ? { action: { type: 'fold' }, ev: 0 } : { action: { type: 'check' }, ev: 0 },
  ];

  if (toCall > 0) {
    lines.push({ action: { type: 'call' }, ev: evCall });
  }

  if (canRaise) {
    lines.push({ action: raiseAction(state, seat, pot, toCall), ev: evValueBet });
  }

  const best = lines.reduce((a, b) => (b.ev > a.ev ? b : a));
  const taken = evOf(action, evCall, evValueBet);
  const evLoss = Math.max(0, best.ev - taken) * (STREET_WEIGHT[facts.street] ?? 1);
  const bigBlind = state.blinds.bigBlind || 1;

  return {
    seat,
    action,
    best: best.action,
    grade: gradeFor(evLoss / bigBlind),
    evLoss,
    reason: describe(action, facts, evLoss),
    leak: leakFor(action, facts, evLoss, best.action, state, seat),
    facts,
  };
}

/**
 * Grades every decision a seat made in a hand that has already been played.
 *
 * Re-deals from the shuffled deck the hand recorded in its own opening event and
 * replays the actions through the real engine, so the state handed to each grade
 * is exactly the one the player faced. Nothing is reconstructed by hand, and
 * nothing can drift from what actually happened.
 */
export function reviewHand(
  config: TableConfig,
  events: readonly HandEvent[],
  seat: SeatIndex,
  options: CoachOptions,
): DecisionReview[] {
  const opening = events.find((event) => event.type === 'handStart');

  if (!opening || opening.type !== 'handStart') {
    return [];
  }

  const reviews: DecisionReview[] = [];
  let state = dealHand(config, opening.deck);

  for (const event of events) {
    if (event.type !== 'actionTaken') {
      continue;
    }

    const action = toAction(event.action);

    if (event.seat === seat) {
      const review = reviewDecision(state, action, options);

      if (review) {
        reviews.push(review);
      }
    }

    state = applyAction(state, action);
  }

  return reviews;
}

/** Everything the coach measures before it judges anything. */
function measure(
  state: HandState,
  seat: SeatIndex,
  hole: readonly [Card, Card],
  options: CoachOptions,
): DecisionFacts {
  const pot = totalPot(state);
  const toCall = amountToCall(state, seat);
  const player = playerAt(state, seat);
  const opponents = contestingPlayers(state).filter((other) => other.seat !== seat);

  const equity =
    opponents.length === 0
      ? 1
      : simulateEquity({
          hero: hole,
          board: state.board,
          opponents: specsFor(state, seat, hole, opponents.length),
          iterations: options.iterations ?? DEFAULT_ITERATIONS,
          rng: options.rng,
        }).equity;

  return {
    street: state.street,
    playersBehind: opponents.filter((other) => !other.hasActedThisStreet).length,
    pot,
    toCall,
    stack: player.stack,
    spr: pot > 0 ? player.stack / pot : Infinity,
    equity,
    requiredEquity: toCall > 0 ? toCall / (pot + toCall) : 0,
    outs: detectDraws(hole, state.board).outCount,
  };
}

/** Ranges for every live opponent, so equity is measured against a read. */
function specsFor(
  state: HandState,
  seat: SeatIndex,
  hole: readonly [Card, Card],
  count: number,
): OpponentSpec[] {
  const models = modelOpponents(state, seat, { dead: hole });
  const specs = [...models.values()]
    .filter((model) => model.combos.length > 0)
    .map((model) => ({ kind: 'range', combos: model.combos }) as const);

  return specs.length === count
    ? [...specs]
    : Array.from({ length: count }, () => ({ kind: 'random' }) as const);
}

/**
 * What a value bet is worth, assuming it is called.
 *
 * A deliberately conservative model: no fold equity, so bluffs are never
 * credited with the pot they might win uncontested. That makes the coach
 * under-value aggression rather than over-value it, and an under-valued raise
 * shows up as a marginal grade rather than a wrong one.
 */
function valueBetEv(pot: number, equity: number): number {
  const size = VALUE_BET_FRACTION * pot;

  return size * (2 * equity - 1);
}

/** The bet or raise the coach would make, sized off the pot. */
function raiseAction(state: HandState, seat: SeatIndex, pot: number, toCall: number): Action {
  const player = playerAt(state, seat);
  const to = Math.min(
    player.committedThisStreet + toCall + Math.round(VALUE_BET_FRACTION * (pot + toCall)),
    player.committedThisStreet + player.stack,
  );

  return state.currentBet === 0 ? { type: 'bet', to } : { type: 'raise', to };
}

function evOf(action: Action, evCall: number, evValueBet: number): number {
  switch (action.type) {
    case 'fold':
    case 'check':
      return 0;
    case 'call':
      return evCall;
    case 'bet':
    case 'raise':
      return evValueBet;
  }
}

function gradeFor(lossInBigBlinds: number): Grade {
  return GRADE_BANDS.find((band) => lossInBigBlinds <= band.upTo)?.grade ?? 'blunder';
}

/**
 * One line of arithmetic, in the terms a player reads at the table.
 *
 * Percentages of the pot rather than raw chips, because "called 40% of pot with
 * 18% equity" transfers to the next table and "called 240" does not.
 */
function describe(action: Action, facts: DecisionFacts, evLoss: number): string {
  const equity = percent(facts.equity);
  const price = facts.pot > 0 ? Math.round((facts.toCall / facts.pot) * 100) : 0;
  const draw = facts.outs > 0 ? `${facts.outs} outs` : 'no draw';

  switch (action.type) {
    case 'fold':
      return facts.toCall > 0
        ? `Folded to ${price}% of pot holding ${equity} equity, needing ${percent(facts.requiredEquity)}.`
        : `Folded with nothing to call.`;
    case 'check':
      return `Checked with ${equity} equity and ${draw}.`;
    case 'call':
      return `Called ${price}% of pot with ${equity} equity and ${draw}, needing ${percent(facts.requiredEquity)}.`;
    case 'bet':
    case 'raise':
      return `${action.type === 'bet' ? 'Bet' : 'Raised'} with ${equity} equity and ${draw}${
        evLoss > 0 ? ', against a range that has it beaten' : ''
      }.`;
  }
}

/** The habit a bad decision is evidence of, or null when it was not bad. */
function leakFor(
  action: Action,
  facts: DecisionFacts,
  evLoss: number,
  best: Action,
  state: HandState,
  seat: SeatIndex,
): Leak | null {
  if (gradeFor(evLoss / (state.blinds.bigBlind || 1)) === 'correct') {
    return null;
  }

  const hole = playerAt(state, seat).holeCards;

  if (
    facts.street === 'preflop' &&
    action.type !== 'fold' &&
    hole &&
    chenScore(hole) < LOOSE_ENTRY_SCORE
  ) {
    return 'preflopLooseness';
  }

  if (action.type === 'call' && facts.equity < facts.requiredEquity) {
    return 'chasingWithoutOdds';
  }

  if (action.type === 'check' && (best.type === 'bet' || best.type === 'raise')) {
    return 'missedValue';
  }

  if ((action.type === 'bet' || action.type === 'raise') && facts.equity < 0.5) {
    return 'overBluffing';
  }

  // Acting into several players still to speak, from a spot that offered no
  // information, is the shape a positional error takes.
  return facts.playersBehind > 0 ? 'positional' : null;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** A logged action carries the chips it moved; grading only needs the shape. */
function toAction(logged: { type: string; to?: number }): Action {
  switch (logged.type) {
    case 'bet':
      return { type: 'bet', to: logged.to ?? 0 };
    case 'raise':
      return { type: 'raise', to: logged.to ?? 0 };
    case 'call':
      return { type: 'call' };
    case 'check':
      return { type: 'check' };
    default:
      return { type: 'fold' };
  }
}
