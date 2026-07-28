/**
 * Hero equity against one or more opponents.
 *
 * Two independent code paths:
 *
 * - `enumerateEquity` walks every possible runout exactly. Used automatically
 *   when the unknown space is small (a turn or river decision), it returns an
 *   exact answer with no sampling error.
 * - `simulateEquity` samples runouts with a seeded RNG for spots too large to
 *   enumerate, such as preflop against several opponents.
 *
 * Keeping them separate matters beyond product value: the exact path is the
 * ground truth the sampled path is tested against.
 */

import { CARD_COUNT, type Card } from './cards';
import { hasDuplicates, remainingDeck } from './deck';
import { handValue } from './evaluator';
import { type Rng } from './rng';

const BOARD_SIZE = 5;
const HOLE_CARDS = 2;

/** How an opponent's unknown hole cards are modelled. */
export type OpponentSpec =
  | { kind: 'random' }
  /** Sampled from a set of allowed starting hands. See `ranges.ts`. */
  | { kind: 'range'; combos: readonly (readonly [Card, Card])[] }
  /** Fully known — a showdown or a training scenario. */
  | { kind: 'known'; cards: readonly [Card, Card] };

export interface EquityRequest {
  /** Hero's hole cards. Fewer than two is not supported; equity is undefined without a hand. */
  hero: readonly [Card, Card];
  /** Zero to five community cards. */
  board?: readonly Card[];
  opponents: readonly OpponentSpec[];
  /** Ignored by `enumerateEquity`. */
  iterations?: number;
  rng?: Rng;
}

export interface EquityResult {
  /** Share of the pot hero expects, 0 to 1. Ties contribute a fractional share. */
  equity: number;
  /** Fraction of runouts hero wins outright, 0 to 1. */
  win: number;
  /** Fraction of runouts hero ties, 0 to 1. */
  tie: number;
  /** Fraction of runouts hero loses, 0 to 1. */
  lose: number;
  /** Runouts examined. */
  iterations: number;
  /** True when every runout was enumerated, so the result carries no sampling error. */
  exact: boolean;
}

export class InvalidEquityRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEquityRequestError';
  }
}

/** Board sizes above this are impossible; five community cards is the maximum. */
function validate(request: EquityRequest): {
  board: readonly Card[];
  opponents: readonly OpponentSpec[];
} {
  const board = request.board ?? [];

  if (board.length > BOARD_SIZE) {
    throw new InvalidEquityRequestError(
      `A board holds at most ${BOARD_SIZE} cards, received ${board.length}.`,
    );
  }

  if (request.opponents.length < 1) {
    throw new InvalidEquityRequestError('Equity needs at least one opponent.');
  }

  const known: Card[] = [...request.hero, ...board];

  for (const opponent of request.opponents) {
    if (opponent.kind === 'known') {
      known.push(...opponent.cards);
    }
    if (opponent.kind === 'range' && opponent.combos.length === 0) {
      throw new InvalidEquityRequestError('An opponent range contains no hands.');
    }
  }

  if (hasDuplicates(known)) {
    throw new InvalidEquityRequestError('The same card appears more than once.');
  }

  const needed = known.length + countUnknownHoleCards(request.opponents);

  if (needed + (BOARD_SIZE - board.length) > CARD_COUNT) {
    throw new InvalidEquityRequestError('Too many players for one deck.');
  }

  return { board, opponents: request.opponents };
}

function countUnknownHoleCards(opponents: readonly OpponentSpec[]): number {
  return opponents.filter((opponent) => opponent.kind !== 'known').length * HOLE_CARDS;
}

/**
 * Tallies one showdown into the running counters.
 *
 * Hero's share of a pot split n ways is 1/n, which is what makes `equity`
 * meaningful rather than just a win rate.
 */
class Tally {
  win = 0;
  tie = 0;
  lose = 0;
  private equitySum = 0;
  private count = 0;

  record(heroValue: number, opponentValues: readonly number[]): void {
    let better = 0;
    let equal = 0;

    for (let i = 0; i < opponentValues.length; i++) {
      const value = opponentValues[i] as number;

      if (value > heroValue) better++;
      else if (value === heroValue) equal++;
    }

    this.count++;

    if (better > 0) {
      this.lose++;
    } else if (equal > 0) {
      this.tie++;
      this.equitySum += 1 / (equal + 1);
    } else {
      this.win++;
      this.equitySum += 1;
    }
  }

  toResult(exact: boolean): EquityResult {
    if (this.count === 0) {
      return { equity: 0, win: 0, tie: 0, lose: 0, iterations: 0, exact };
    }

    return {
      equity: this.equitySum / this.count,
      win: this.win / this.count,
      tie: this.tie / this.count,
      lose: this.lose / this.count,
      iterations: this.count,
      exact,
    };
  }
}

/** Number of distinct runouts `enumerateEquity` would examine, ignoring opponent ranges. */
export function runoutCount(boardSize: number, deckSize: number): number {
  return binomial(deckSize, BOARD_SIZE - boardSize);
}

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;

  let result = 1;

  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }

  return Math.round(result);
}

/**
 * Exact equity by enumerating every remaining board. Every opponent must be
 * `known`, since enumerating unknown hole cards as well explodes combinatorially.
 *
 * @throws {InvalidEquityRequestError} when an opponent's hand is not known.
 */
export function enumerateEquity(request: EquityRequest): EquityResult {
  const { board, opponents } = validate(request);

  const opponentHoles: (readonly [Card, Card])[] = [];

  for (const opponent of opponents) {
    if (opponent.kind !== 'known') {
      throw new InvalidEquityRequestError(
        'enumerateEquity requires every opponent hand to be known. Use simulateEquity instead.',
      );
    }

    opponentHoles.push(opponent.cards);
  }

  const dead: Card[] = [...request.hero, ...board, ...opponentHoles.flat()];
  const deck = remainingDeck(dead);
  const missing = BOARD_SIZE - board.length;
  const tally = new Tally();

  const heroHand: Card[] = [...request.hero, ...board];
  const opponentHands = opponentHoles.map((hole) => [...hole, ...board] as Card[]);
  const opponentValues = new Array<number>(opponentHands.length).fill(0);

  // Push the runout onto every hand, score, then pop.
  const scoreCurrent = (): void => {
    for (let i = 0; i < opponentHands.length; i++) {
      opponentValues[i] = handValue(opponentHands[i] as Card[]);
    }
    tally.record(handValue(heroHand), opponentValues);
  };

  const walk = (start: number, remaining: number): void => {
    if (remaining === 0) {
      scoreCurrent();
      return;
    }

    for (let i = start; i <= deck.length - remaining; i++) {
      const card = deck[i] as Card;

      heroHand.push(card);
      for (const hand of opponentHands) hand.push(card);

      walk(i + 1, remaining - 1);

      heroHand.pop();
      for (const hand of opponentHands) hand.pop();
    }
  };

  walk(0, missing);

  return tally.toResult(true);
}

/**
 * Sampled equity. Runs `iterations` random runouts, drawing unknown opponent
 * hole cards as well as the remaining board.
 *
 * Prefer `equity` below, which picks the exact path when it is cheap enough.
 */
export function simulateEquity(request: EquityRequest & { rng: Rng }): EquityResult {
  const { board, opponents } = validate(request);
  const iterations = request.iterations ?? 10_000;

  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new InvalidEquityRequestError(
      `iterations must be a positive integer, got ${iterations}.`,
    );
  }

  const { rng } = request;
  const dead: Card[] = [...request.hero, ...board];

  for (const opponent of opponents) {
    if (opponent.kind === 'known') dead.push(...opponent.cards);
  }

  const deck = remainingDeck(dead);
  const missingBoard = BOARD_SIZE - board.length;
  const tally = new Tally();

  const heroHand: Card[] = new Array<Card>(HOLE_CARDS + BOARD_SIZE) as Card[];
  const opponentHands = opponents.map(() => new Array<Card>(HOLE_CARDS + BOARD_SIZE) as Card[]);
  const opponentValues = new Array<number>(opponents.length).fill(0);

  // Cards unavailable to the current iteration. Seeded with the dead cards each
  // time round: `draw` never sees them because they are absent from `deck`, but
  // a range combo could otherwise name a card hero or the board already holds.
  const deadMask = new Uint8Array(CARD_COUNT);

  for (const card of dead) {
    deadMask[card] = 1;
  }

  const taken = new Uint8Array(CARD_COUNT);

  /**
   * Draws an unused card by rejection. With at most ~20 of ~45 deck cards
   * taken, this averages well under two attempts — cheaper and far clearer
   * than maintaining a partially shuffled region alongside range sampling.
   */
  const draw = (): Card => {
    for (;;) {
      const card = deck[rng.nextInt(deck.length)] as Card;

      if (taken[card] === 0) {
        taken[card] = 1;

        return card;
      }
    }
  };

  for (let iteration = 0; iteration < iterations; iteration++) {
    taken.set(deadMask);

    let blocked = false;

    // Range opponents first: their combos can be blocked, and bailing out
    // before dealing a board wastes less work.
    for (let o = 0; o < opponents.length; o++) {
      const opponent = opponents[o] as OpponentSpec;
      const hand = opponentHands[o] as Card[];

      if (opponent.kind === 'known') {
        hand[0] = opponent.cards[0];
        hand[1] = opponent.cards[1];
        continue;
      }

      if (opponent.kind === 'random') {
        hand[0] = draw();
        hand[1] = draw();
        continue;
      }

      const combo = pickCombo(opponent.combos, taken, rng);

      if (combo === null) {
        blocked = true;
        break;
      }

      hand[0] = combo[0];
      hand[1] = combo[1];
      taken[combo[0]] = 1;
      taken[combo[1]] = 1;
    }

    if (blocked) {
      continue;
    }

    heroHand[0] = request.hero[0];
    heroHand[1] = request.hero[1];

    for (let i = 0; i < board.length; i++) {
      heroHand[HOLE_CARDS + i] = board[i] as Card;
    }

    for (let i = 0; i < missingBoard; i++) {
      heroHand[HOLE_CARDS + board.length + i] = draw();
    }

    for (let o = 0; o < opponentHands.length; o++) {
      const hand = opponentHands[o] as Card[];

      for (let i = 0; i < BOARD_SIZE; i++) {
        hand[HOLE_CARDS + i] = heroHand[HOLE_CARDS + i] as Card;
      }

      opponentValues[o] = handValue(hand);
    }

    tally.record(handValue(heroHand), opponentValues);
  }

  return tally.toResult(false);
}

const MAX_COMBO_ATTEMPTS = 200;

/**
 * Rejection-samples a combo whose cards are still available. Returns null when
 * the range is effectively blocked, so the caller can skip the iteration rather
 * than spin forever.
 */
function pickCombo(
  combos: readonly (readonly [Card, Card])[],
  taken: Uint8Array,
  rng: Rng,
): readonly [Card, Card] | null {
  for (let attempt = 0; attempt < MAX_COMBO_ATTEMPTS; attempt++) {
    const combo = combos[rng.nextInt(combos.length)] as readonly [Card, Card];

    if (taken[combo[0]] === 0 && taken[combo[1]] === 0) {
      return combo;
    }
  }

  return null;
}

/**
 * Threshold for choosing exact enumeration. Enumerating a preflop heads-up spot
 * means 1.7M runouts, which is fine in a test but not on a phone; a turn or
 * river decision is a few thousand at most.
 */
const MAX_EXACT_RUNOUTS = 25_000;

/**
 * Hero equity, exact when that is cheap and sampled otherwise.
 *
 * This is the entry point features should call.
 */
export function equity(request: EquityRequest & { rng: Rng }): EquityResult {
  const board = request.board ?? [];
  const allKnown = request.opponents.every((opponent) => opponent.kind === 'known');

  if (allKnown) {
    const dead = 2 + board.length + request.opponents.length * HOLE_CARDS;
    const runouts = runoutCount(board.length, CARD_COUNT - dead);

    if (runouts <= MAX_EXACT_RUNOUTS) {
      return enumerateEquity(request);
    }
  }

  return simulateEquity(request);
}
