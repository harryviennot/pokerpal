/**
 * The replay log.
 *
 * Every transition a hand makes appends one event. Three consumers read them:
 * the table UI animates from them, hand replay steps through them street by
 * street, and the coach (Phase 3) reads the decision points out of them. They
 * are the reason a hand can be reconstructed without re-running the RNG.
 */

import { formatCard, type Card } from './cards';
import { type HandRank } from './evaluator';

/** Betting rounds, in order. `showdown` is terminal, not a betting round. */
export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

/** Index into the hand's `players` array. Stable for the life of a hand. */
export type SeatIndex = number;

export type BlindKind = 'smallBlind' | 'bigBlind' | 'ante';

export type HandEvent =
  /** Opens the log. `deck` is the full shuffled deck, which makes the hand replayable. */
  | {
      type: 'handStart';
      handNumber: number;
      seed: number;
      button: SeatIndex;
      deck: readonly Card[];
    }
  | { type: 'blindPosted'; seat: SeatIndex; kind: BlindKind; amount: number; allIn: boolean }
  | { type: 'holeCardsDealt'; seat: SeatIndex; cards: readonly [Card, Card] }
  | { type: 'streetDealt'; street: Street; cards: readonly Card[]; burned: Card }
  | { type: 'actionTaken'; seat: SeatIndex; action: LoggedAction; allIn: boolean }
  /** The excess of an unmatched bet, handed back before the pot is built. */
  | { type: 'uncalledBetReturned'; seat: SeatIndex; amount: number }
  | { type: 'showdownHand'; seat: SeatIndex; cards: readonly [Card, Card]; rank: HandRank }
  /** A losing hand that was never shown; recorded so replay can grey the seat out. */
  | { type: 'handMucked'; seat: SeatIndex }
  | { type: 'potAwarded'; seat: SeatIndex; amount: number; potIndex: number; oddChip: boolean }
  | { type: 'handEnd'; street: Street };

/** An action as recorded, with the chips it actually moved resolved. */
export type LoggedAction =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call'; amount: number }
  | { type: 'bet'; to: number; amount: number }
  | { type: 'raise'; to: number; amount: number };

/**
 * One-line human-readable text for an event, e.g. `Seat 2 raises to 250`.
 *
 * Deliberately terse and seat-numbered rather than named: the engine does not
 * know display names, so the UI substitutes them when it has them.
 */
export function describeEvent(event: HandEvent): string {
  switch (event.type) {
    case 'handStart':
      return `Hand #${event.handNumber} begins, button on seat ${event.button}`;
    case 'blindPosted':
      return `Seat ${event.seat} posts ${BLIND_LABELS[event.kind]} ${event.amount}${
        event.allIn ? ' and is all in' : ''
      }`;
    case 'holeCardsDealt':
      return `Seat ${event.seat} is dealt two cards`;
    case 'streetDealt':
      return `${STREET_LABELS[event.street]}: ${event.cards.map(formatCard).join(' ')}`;
    case 'actionTaken':
      return `Seat ${event.seat} ${describeAction(event.action)}${
        event.allIn ? ' and is all in' : ''
      }`;
    case 'uncalledBetReturned':
      return `${event.amount} returned to seat ${event.seat}`;
    case 'showdownHand':
      return `Seat ${event.seat} shows ${event.cards.map(formatCard).join(' ')}`;
    case 'handMucked':
      return `Seat ${event.seat} mucks`;
    case 'potAwarded':
      return `Seat ${event.seat} wins ${event.amount}${event.oddChip ? ' (odd chip)' : ''}`;
    case 'handEnd':
      return `Hand ends on the ${event.street}`;
  }
}

const BLIND_LABELS: Record<BlindKind, string> = {
  smallBlind: 'the small blind',
  bigBlind: 'the big blind',
  ante: 'an ante',
};

const STREET_LABELS: Record<Street, string> = {
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
};

function describeAction(action: LoggedAction): string {
  switch (action.type) {
    case 'fold':
      return 'folds';
    case 'check':
      return 'checks';
    case 'call':
      return `calls ${action.amount}`;
    case 'bet':
      return `bets ${action.to}`;
    case 'raise':
      return `raises to ${action.to}`;
  }
}
