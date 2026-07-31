/**
 * A real hand's worth of `HandState` from what the camera and two taps know.
 *
 * The engine grades decisions, not observations, so the live screen's facts —
 * hero cards, a locked board, an opponent count, a pot and a bet entered by
 * tap — are dressed as the mid-hand state they describe: hero to act, one
 * villain owning the bet and the pot so far, the rest live behind him. The
 * coach then measures it exactly as it measures a practice hand.
 *
 * Amounts arrive in big blinds and become integer chips at 100 per blind, the
 * resolution a tap entry can actually mean.
 */

import {
  allCards,
  type Card,
  type HandState,
  type Player,
  type SeatIndex,
  type Street,
} from '@/engine';

/** Chips per big blind in synthesized live hands. */
export const LIVE_BIG_BLIND = 100;

export const MIN_LIVE_OPPONENTS = 1;
export const MAX_LIVE_OPPONENTS = 8;

/** What LivePlay actually knows when hero faces a decision. */
export interface LiveObservation {
  heroCards: readonly [Card, Card];
  /** The locked board: exactly 0, 3, 4 or 5 cards. */
  board: readonly Card[];
  /** Live opponents still in the hand. */
  opponents: number;
  /** Chips in the middle before the bet facing hero, in big blinds. */
  potBb: number;
  /** The bet hero is facing, in big blinds. Zero when checked to hero. */
  toCallBb: number;
  heroStackBb: number;
}

/** The street a board of this many cards is on, or null mid-flop. */
export function streetOfBoard(boardLength: number): Street | null {
  switch (boardLength) {
    case 0:
      return 'preflop';
    case 3:
      return 'flop';
    case 4:
      return 'turn';
    case 5:
      return 'river';
    default:
      return null;
  }
}

/**
 * Synthesizes the `HandState` the observation describes, or null while the
 * observation is not a gradable spot (mid-flop board, no stack, bad counts).
 */
export function buildLiveHandState(obs: LiveObservation): HandState | null {
  const street = streetOfBoard(obs.board.length);

  if (
    street === null ||
    obs.opponents < MIN_LIVE_OPPONENTS ||
    obs.opponents > MAX_LIVE_OPPONENTS ||
    obs.potBb < 0 ||
    obs.toCallBb < 0 ||
    obs.heroStackBb <= 0
  ) {
    return null;
  }

  const taken = new Set<Card>([...obs.heroCards, ...obs.board]);

  if (taken.size !== 2 + obs.board.length) {
    return null;
  }

  const pot = Math.round(obs.potBb * LIVE_BIG_BLIND);
  const toCall = Math.round(obs.toCallBb * LIVE_BIG_BLIND);
  const heroStack = Math.round(obs.heroStackBb * LIVE_BIG_BLIND);

  // Deep enough that no villain is accidentally all in behind the numbers.
  const villainStack = Math.max(heroStack, 200 * LIVE_BIG_BLIND) + pot + toCall;

  const hero: Player = {
    seat: 0,
    id: 'hero',
    stack: heroStack,
    holeCards: obs.heroCards,
    status: 'active',
    committedThisStreet: 0,
    committedTotal: 0,
    hasActedThisStreet: false,
    mayRaiseThisStreet: true,
  };

  // Seat 1 owns the action so far: the bet facing hero on this street, and the
  // whole pot before it. Which villain the chips came from does not change any
  // number the coach reads — `totalPot` sums commitments across seats.
  const villains: Player[] = Array.from({ length: obs.opponents }, (_, index) => ({
    seat: (index + 1) as SeatIndex,
    id: `villain${index + 1}`,
    stack: villainStack - (index === 0 ? pot + toCall : 0),
    holeCards: null,
    status: 'active' as const,
    committedThisStreet: index === 0 ? toCall : 0,
    committedTotal: index === 0 ? pot + toCall : 0,
    hasActedThisStreet: true,
    mayRaiseThisStreet: true,
  }));

  const lastRaiseSize = Math.max(toCall, LIVE_BIG_BLIND);

  return {
    handNumber: 1,
    seed: 0,
    button: obs.opponents as SeatIndex,
    blinds: { smallBlind: LIVE_BIG_BLIND / 2, bigBlind: LIVE_BIG_BLIND },
    players: [hero, ...villains],
    street,
    board: obs.board,
    deck: allCards().filter((card) => !taken.has(card)),
    toAct: 0,
    currentBet: toCall,
    minRaiseTo: toCall + lastRaiseSize,
    lastRaiseSize,
    pots: [{ amount: pot + toCall, eligible: [hero, ...villains].map((p) => p.seat) }],
    events: [],
    complete: false,
  };
}
