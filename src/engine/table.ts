/**
 * The shape of a hand in progress.
 *
 * Data and trivial accessors only — every rule that changes state lives in
 * `betting.ts`, `pots.ts`, `showdown.ts` and `hand.ts`, which all import from
 * here. Keeping the types in one leaf module is what stops those four from
 * importing each other in a cycle.
 *
 * All chip amounts are integers in whatever unit the table is denominated in.
 * The engine never sees a fractional chip, which is what makes split pots and
 * odd-chip rules exact.
 */

import { type Card } from './cards';
import { type HandEvent, type SeatIndex, type Street } from './events';

export { type SeatIndex, type Street } from './events';

/**
 * `active` may still act. `allIn` is contesting the pot with nothing left to
 * wager. `folded` and `sittingOut` are out of the hand — `sittingOut` seats
 * were never dealt in.
 */
export type PlayerStatus = 'active' | 'folded' | 'allIn' | 'sittingOut';

export interface Player {
  seat: SeatIndex;
  /** Stable identifier supplied by the caller; the engine only passes it through. */
  id: string;
  stack: number;
  holeCards: readonly [Card, Card] | null;
  status: PlayerStatus;
  /** Chips pushed forward on the current street. Reset when the street changes. */
  committedThisStreet: number;
  /** Chips pushed forward across the whole hand. Drives side-pot layering. */
  committedTotal: number;
  /** False until this player has acted since the last full raise on this street. */
  hasActedThisStreet: boolean;
  /**
   * False once an all-in raise too small to be a full raise has passed this
   * player by: they may call or fold, but the betting is not reopened to them.
   */
  mayRaiseThisStreet: boolean;
}

export interface Blinds {
  smallBlind: number;
  bigBlind: number;
  /** Posted by every dealt-in player before the hand. Zero on most tables. */
  ante?: number;
}

export interface TableConfig {
  /** Seats in clockwise order. Two to nine, per the PRD's one-to-eight bots. */
  seats: readonly { id: string; stack: number }[];
  button: SeatIndex;
  blinds: Blinds;
  /** Recorded in the log so a hand can be identified in history. */
  handNumber?: number;
  seed?: number;
}

/** One layer of the pot, claimable only by `eligible`. */
export interface Pot {
  amount: number;
  /** Seats still in the hand that contributed to this layer. Never empty. */
  eligible: readonly SeatIndex[];
}

/** What a seat may do right now. `min`/`max` are total street commitments. */
export type LegalAction =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call'; amount: number }
  | { type: 'bet'; min: number; max: number }
  | { type: 'raise'; min: number; max: number };

/**
 * A player's decision. `to` is the player's *total* commitment on this street
 * once the action is made, not the increment — the way a raise is announced at
 * a table, and what makes an all-in simply `to = committedThisStreet + stack`.
 */
export type Action =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'bet'; to: number }
  | { type: 'raise'; to: number };

export type ActionType = Action['type'];

export interface HandState {
  handNumber: number;
  seed: number;
  button: SeatIndex;
  blinds: Blinds;
  players: readonly Player[];
  street: Street;
  board: readonly Card[];
  /** Cards not yet dealt, in deal order. The front of the array is the top. */
  deck: readonly Card[];
  /** The seat to act, or null when the hand is over or a street is closing. */
  toAct: SeatIndex | null;
  /** Highest `committedThisStreet` anyone has reached. Zero on a fresh street. */
  currentBet: number;
  /** Smallest legal total a raise may go to. */
  minRaiseTo: number;
  /** Size of the last full raise increment, the floor for the next one. */
  lastRaiseSize: number;
  /** Chips from streets already collected, plus the current street's commitments. */
  pots: readonly Pot[];
  events: readonly HandEvent[];
  complete: boolean;
}

export function playerAt(state: HandState, seat: SeatIndex): Player {
  const player = state.players[seat];

  if (!player) {
    throw new RangeError(`No seat ${seat} at a ${state.players.length}-handed table.`);
  }

  return player;
}

/** Seats that can still be dealt to and can still act. */
export function activePlayers(state: HandState): readonly Player[] {
  return state.players.filter((player) => player.status === 'active');
}

/** Seats still contesting the pot, whether or not they have chips behind. */
export function contestingPlayers(state: HandState): readonly Player[] {
  return state.players.filter((player) => player.status === 'active' || player.status === 'allIn');
}

/** Every chip wagered so far this hand, including the current street. */
export function totalPot(state: HandState): number {
  return state.players.reduce((sum, player) => sum + player.committedTotal, 0);
}

/** Chips a seat must put in to match the current bet, capped by their stack. */
export function amountToCall(state: HandState, seat: SeatIndex): number {
  const player = playerAt(state, seat);

  return Math.min(state.currentBet - player.committedThisStreet, player.stack);
}

export function isHandOver(state: HandState): boolean {
  return state.complete;
}

/**
 * The next occupied seat clockwise from `from`, matching `predicate`.
 * Returns null when a full lap finds nobody — the caller decides what that means.
 */
export function nextSeat(
  players: readonly Player[],
  from: SeatIndex,
  predicate: (player: Player) => boolean,
): SeatIndex | null {
  for (let step = 1; step <= players.length; step++) {
    const seat = (from + step) % players.length;
    const player = players[seat];

    if (player && predicate(player)) {
      return seat;
    }
  }

  return null;
}

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalActionError';
  }
}

export class InvalidTableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTableError';
  }
}
