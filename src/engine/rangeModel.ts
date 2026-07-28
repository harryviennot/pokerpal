/**
 * What an opponent could be holding.
 *
 * The PRD's third layer: instead of treating every opponent as a random hand,
 * keep the set of hands consistent with what they have actually done, and narrow
 * it every time they act. A player who opened, bet the flop and bet again on a
 * scary turn is not holding a random hand, and a bot that thinks they are will
 * pay them off forever.
 *
 * The model is deliberately crude in a way worth stating plainly: it narrows to
 * the top share of a *strength ordering*, so it captures "they are representing
 * something strong" but not "they are representing a draw" or "that line makes
 * no sense". It has no notion of bluffing and no notion of a player who checks
 * a monster. Those are the Shark's balance and exploitation layers, above this.
 *
 * Everything here is pure and reads only from the hand's public event log — no
 * bot may see a card the table has not shown.
 */

import { type Card } from './cards';
import { rankOf, suitOf } from './cards';
import { handValue } from './evaluator';
import { type HandEvent, type SeatIndex } from './events';
import { allCombos, type Combo } from './ranges';
import { type HandState } from './table';

export interface OpponentModel {
  seat: SeatIndex;
  /** Hands still consistent with everything this seat has done. Never empty. */
  combos: readonly Combo[];
  /** Share of all 1 326 starting hands still in the range, 0 to 1. */
  fraction: number;
}

export interface RangeModelOptions {
  /**
   * Cards nobody else can hold: the observer's own, plus anything else known.
   * The board is taken from the log and does not need repeating here.
   */
  dead?: readonly Card[];
  /** Share of the range kept when a seat bets or raises. */
  onRaise?: number;
  /** Share kept when a seat calls a bet. */
  onCall?: number;
  /** Share kept when a seat checks — a wide action, so barely a narrowing. */
  onCheck?: number;
}

/**
 * Defaults chosen to be pessimistic rather than clever: a raise says a lot, a
 * call says a little, a check says almost nothing. Narrowing too hard is the
 * dangerous direction — it invents a range the opponent never had and then
 * folds correct calls to it.
 */
const DEFAULTS = {
  onRaise: 0.35,
  onCall: 0.7,
  onCheck: 0.9,
} as const;

/** Below this many combos, narrowing stops: a range of one is a claim, not a read. */
const MIN_COMBOS = 12;

/**
 * Builds a range for every seat still contesting the pot, except `observer`.
 *
 * Walks the hand's own event log, so the model depends on nothing but what
 * everyone at the table saw.
 */
export function modelOpponents(
  state: HandState,
  observer: SeatIndex,
  options: RangeModelOptions = {},
): Map<SeatIndex, OpponentModel> {
  const settings = { ...DEFAULTS, ...options };
  const dead = new Set<Card>([...(options.dead ?? []), ...state.board]);
  const start = allCombos().filter((combo) => !dead.has(combo[0]) && !dead.has(combo[1]));
  const models = new Map<SeatIndex, readonly Combo[]>();

  for (const player of state.players) {
    if (player.seat !== observer && (player.status === 'active' || player.status === 'allIn')) {
      models.set(player.seat, start);
    }
  }

  // The board as it stood when each action was taken: a flop raise says
  // something about the flop, not about the river that came three streets later.
  let board: Card[] = [];

  for (const event of state.events) {
    if (event.type === 'streetDealt') {
      board = [...board, ...event.cards];
      continue;
    }

    if (event.type !== 'actionTaken') {
      continue;
    }

    const current = models.get(event.seat);

    if (!current) {
      continue;
    }

    const keep = keepShare(event, settings);

    if (keep < 1) {
      models.set(event.seat, narrow(current, board, keep));
    }
  }

  const result = new Map<SeatIndex, OpponentModel>();
  const total = start.length || 1;

  for (const [seat, combos] of models) {
    result.set(seat, { seat, combos, fraction: combos.length / total });
  }

  return result;
}

/** The share of a range an action leaves behind. */
function keepShare(
  event: Extract<HandEvent, { type: 'actionTaken' }>,
  settings: Required<Omit<RangeModelOptions, 'dead'>>,
): number {
  switch (event.action.type) {
    case 'bet':
    case 'raise':
      return settings.onRaise;
    case 'call':
      return settings.onCall;
    case 'check':
      return settings.onCheck;
    case 'fold':
      return 1;
  }
}

/** Keeps the strongest `share` of a range against the board as it stood. */
function narrow(combos: readonly Combo[], board: readonly Card[], share: number): readonly Combo[] {
  const target = Math.max(MIN_COMBOS, Math.round(combos.length * share));

  if (target >= combos.length) {
    return combos;
  }

  const ranked = combos
    .map((combo) => ({ combo, strength: strengthOf(combo, board) }))
    .sort((a, b) => b.strength - a.strength);

  return ranked.slice(0, target).map((entry) => entry.combo);
}

/**
 * How good a starting hand is, in whatever terms the street allows.
 *
 * Preflop that is the Chen formula — a cheap, well-known ordering that is close
 * enough to rank a range. Postflop it is the hand the combo actually makes with
 * the board, straight from the evaluator, which is exact.
 */
export function strengthOf(combo: Combo, board: readonly Card[]): number {
  return board.length === 0 ? chenScore(combo) : handValue([...combo, ...board]);
}

/**
 * Bill Chen's starting-hand formula.
 *
 * High card scored on its own scale, doubled for a pair, a bonus for suited, a
 * penalty for the gap between the cards, and a small bonus for connected low
 * cards that can make a straight. It is not equity, and it does not need to be:
 * it only has to sort 169 starting hands into roughly the right order.
 */
export function chenScore(combo: Combo): number {
  const [first, second] = combo;
  const high = Math.max(rankOf(first), rankOf(second));
  const low = Math.min(rankOf(first), rankOf(second));

  let score = highCardValue(high);

  if (high === low) {
    // A pair is worth twice its high card, and never less than a pair of deuces.
    return Math.max(score * 2, 5);
  }

  if (suitOf(first) === suitOf(second)) {
    score += 2;
  }

  const gap = high - low - 1;

  score -= GAP_PENALTY[Math.min(gap, 4)] as number;

  // Two connected cards below a queen can make a straight from both ends.
  if (gap <= 1 && high < 12) {
    score += 1;
  }

  return Math.ceil(score);
}

const GAP_PENALTY = [0, 1, 2, 4, 5] as const;

function highCardValue(rank: number): number {
  switch (rank) {
    case 14:
      return 10;
    case 13:
      return 8;
    case 12:
      return 7;
    case 11:
      return 6;
    default:
      return rank / 2;
  }
}
