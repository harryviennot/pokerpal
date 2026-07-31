/**
 * What the coach would do in a spot, and what each line it considered is worth.
 *
 * This is the half of Pillar C that has an opinion but passes no judgement. It
 * measures the spot — equity against the ranges the table's own betting implies,
 * the price the pot is offering, the draws that are live — ranks every legal line
 * by expected value, and stops there. `coach.ts` sits on top and turns the gap
 * between the best line and the one taken into a grade.
 *
 * Splitting it out is what lets the guide speak *before* the decision and the
 * grade speak *after* it while both read from one implementation. A guide that
 * recommended a call and a coach that then marked the call down would be two
 * coaches disagreeing in front of the player, and the product's whole claim is
 * that the feedback is trustworthy.
 *
 * The EV model is showdown-only: every line is valued as if the hand were checked
 * down from here. That is honest for *ranking* lines — it favours nothing and
 * nobody — and deliberately conservative about aggression, since a value bet is
 * credited with no fold equity at all. See `valueBetEv`.
 *
 * Nothing here reads a card the table has not shown. `modelOpponents` walks the
 * public event log, so a recommendation given mid-hand tells the player what a
 * good opponent could work out for themselves, never what anyone is holding.
 */

import { legalActions } from './betting';
import { type Card } from './cards';
import { detectDraws } from './draws';
import { simulateEquity, type OpponentSpec } from './equity';
import { type Street } from './events';
import { modelOpponents } from './rangeModel';
import { type Rng } from './rng';
import {
  amountToCall,
  contestingPlayers,
  playerAt,
  totalPot,
  type Action,
  type HandState,
  type SeatIndex,
} from './table';

/** Everything the coach measures before it has an opinion about anything. */
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

/** One line the coach weighed, and what it is worth in chips. */
export interface Line {
  action: Action;
  /** Showdown-only expected value, in chips. Folding and checking are worth zero. */
  ev: number;
}

export interface Recommendation {
  seat: SeatIndex;
  /** The line the coach would take. Bets and raises carry the size it would use. */
  best: Action;
  /**
   * Every line considered, in the order they were weighed rather than by value.
   * Ties resolve to the first, and that ordering — fold or check, then call, then
   * the raise — is what makes the coach passive on a dead heat rather than random.
   */
  lines: readonly Line[];
  facts: DecisionFacts;
}

export interface CoachOptions {
  /** Monte Carlo samples per decision. Review is not on the hot path; be accurate. */
  iterations?: number;
  /** Required. Grading is deterministic given the same RNG. */
  rng: Rng;
}

export const DEFAULT_ITERATIONS = 2_000;

/** The share of the pot a value bet is assumed to make when it is called. */
const VALUE_BET_FRACTION = 0.66;

/**
 * What the coach would do here, measured and ranked.
 *
 * `state` must be waiting on `seat`. Null when there is nothing to recommend:
 * the hand is over, it is nobody's turn, or the seat has no cards.
 *
 * Draws from `options.rng` exactly once, through one `simulateEquity` call, and
 * only when there is an opponent left to have equity against. Callers that grade
 * a sequence of decisions on a shared generator depend on that count.
 */
export function recommend(
  state: HandState,
  seat: SeatIndex,
  options: CoachOptions,
): Recommendation | null {
  const facts = measureDecision(state, seat, options);

  return facts && rankLines(state, seat, facts);
}

/**
 * Measures the spot, sampling equity against the modelled ranges.
 *
 * The sampling half of `recommend`, separated so a caller that has already
 * computed hero's equity some other way — the felt does, in small chunks off the
 * frame budget — can reach the same facts through `factsFrom` without paying for
 * a second Monte Carlo run.
 */
export function measureDecision(
  state: HandState,
  seat: SeatIndex,
  options: CoachOptions,
): DecisionFacts | null {
  const hole = decidingCards(state, seat);

  if (!hole) {
    return null;
  }

  const opponents = contestingPlayers(state).filter((other) => other.seat !== seat);

  const equity =
    opponents.length === 0
      ? 1
      : simulateEquity({
          hero: hole,
          board: state.board,
          opponents: opponentSpecs(state, seat, hole),
          iterations: options.iterations ?? DEFAULT_ITERATIONS,
          rng: options.rng,
        }).equity;

  return factsFrom(state, seat, equity);
}

/**
 * The same facts, from an equity figure worked out elsewhere.
 *
 * `equity` is hero's share against every live opponent, 0 to 1. Pure — no
 * sampling, no RNG — so the live guide can measure once and re-rank for free.
 */
export function factsFrom(state: HandState, seat: SeatIndex, equity: number): DecisionFacts | null {
  const hole = decidingCards(state, seat);

  if (!hole) {
    return null;
  }

  const pot = totalPot(state);
  const toCall = amountToCall(state, seat);
  const player = playerAt(state, seat);
  const opponents = contestingPlayers(state).filter((other) => other.seat !== seat);

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

/**
 * Ranges for every live opponent, so equity is measured against a read rather
 * than against random hands.
 *
 * Falls back to random hands whenever the model cannot produce one range per
 * opponent: a partial read applied to a full table would quietly measure equity
 * against the wrong number of players.
 */
export function opponentSpecs(
  state: HandState,
  seat: SeatIndex,
  hole: readonly [Card, Card],
): readonly OpponentSpec[] {
  const count = contestingPlayers(state).filter((other) => other.seat !== seat).length;
  const models = modelOpponents(state, seat, { dead: hole });
  const specs = [...models.values()]
    .filter((model) => model.combos.length > 0)
    .map((model) => ({ kind: 'range', combos: model.combos }) as const);

  return specs.length === count
    ? [...specs]
    : Array.from({ length: count }, () => ({ kind: 'random' }) as const);
}

/**
 * Ranks the legal lines by expected value. Pure arithmetic once the facts are in.
 *
 * Chips already in the middle are sunk, so folding is worth exactly nothing from
 * here — which is what every other line is measured against.
 */
export function rankLines(
  state: HandState,
  seat: SeatIndex,
  facts: DecisionFacts,
): Recommendation | null {
  if (!decidingCards(state, seat)) {
    return null;
  }

  const { pot, toCall } = facts;
  const evCall = toCall > 0 ? facts.equity * (pot + toCall) - toCall : 0;
  const canRaise = legalActions(state).some(
    (legal) => legal.type === 'bet' || legal.type === 'raise',
  );

  const lines: Line[] = [
    toCall > 0 ? { action: { type: 'fold' }, ev: 0 } : { action: { type: 'check' }, ev: 0 },
  ];

  if (toCall > 0) {
    lines.push({ action: { type: 'call' }, ev: evCall });
  }

  if (canRaise) {
    lines.push({
      action: raiseAction(state, seat, pot, toCall),
      ev: valueBetEv(pot, facts.equity),
    });
  }

  return {
    seat,
    best: lines.reduce((a, b) => (b.ev > a.ev ? b : a)).action,
    lines,
    facts,
  };
}

/**
 * What `action` is worth against this recommendation, in chips.
 *
 * Only the shape of the action matters: the coach values a bet by the size it
 * would have chosen, not the size the player did, because the alternative is a
 * grade that punishes sizing through a model that has no opinion about sizing.
 */
export function lineValue(recommendation: Recommendation, action: Action): number {
  switch (action.type) {
    case 'fold':
    case 'check':
      return 0;
    case 'call':
      return recommendation.lines.find((line) => line.action.type === 'call')?.ev ?? 0;
    case 'bet':
    case 'raise':
      return (
        recommendation.lines.find(
          (line) => line.action.type === 'bet' || line.action.type === 'raise',
        )?.ev ?? Number.NEGATIVE_INFINITY
      );
  }
}

/** Hero's cards, or null when this seat has no decision to be advised on. */
function decidingCards(state: HandState, seat: SeatIndex): readonly [Card, Card] | null {
  if (state.complete || state.toAct !== seat) {
    return null;
  }

  return playerAt(state, seat).holeCards;
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
