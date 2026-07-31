/**
 * Rebuilding a hand from its event log.
 *
 * The table never renders a live `HandState`: it renders one frame of a replay,
 * and "live" is just the last frame. Stepping backwards, reviewing a hand from
 * history and watching one play out are then the same code path, and the UI
 * only ever reads a flat, already-resolved shape.
 *
 * This module is bookkeeping, not rules. Legality, betting closure, who shows
 * and who wins were all settled when the hand was played and are recorded in
 * the log; all that is left here is moving chips between a stack, the bet in
 * front of a seat and the middle. Nothing in this file may decide anything —
 * if it needs a rule, the rule belongs in the engine modules above it.
 */

import { type Card } from './cards';
import { type DecisionReview } from './coach';
import { type HandRank } from './evaluator';
import {
  describeEvent,
  type HandEvent,
  type LoggedAction,
  type SeatIndex,
  type Street,
} from './events';
import { type PlayerStatus } from './table';

export interface ReplaySeat {
  seat: SeatIndex;
  /** The caller's identifier, which doubles as the display name. */
  id: string;
  stack: number;
  /** Chips in front of the seat on this street, not yet pulled into the middle. */
  bet: number;
  status: PlayerStatus;
  /** Known from the log for every dealt-in seat; showing them is the UI's call. */
  holeCards: readonly [Card, Card] | null;
  /** True once the seat has turned its cards face up at showdown. */
  shown: boolean;
  mucked: boolean;
  /** Chips awarded to this seat so far, across every pot layer. */
  won: number;
  /** The made hand shown down, when it was shown. */
  rank: HandRank | null;
  /** The five cards that played, once shown. Null for hands logged before it existed. */
  bestFive: readonly Card[] | null;
}

export interface TableSnapshot {
  handNumber: number;
  button: SeatIndex;
  street: Street;
  board: readonly Card[];
  seats: readonly ReplaySeat[];
  /** Chips already pulled into the middle. Street bets are still in front of seats. */
  pot: number;
  /** The seat this frame's event belongs to, for highlighting. Null for table events. */
  actor: SeatIndex | null;
  complete: boolean;
}

export interface ReplayFrame {
  /** Index into the event log that produced this frame. */
  index: number;
  event: HandEvent;
  /** One line of commentary, with seat names substituted in. */
  description: string;
  snapshot: TableSnapshot;
}

export interface ReplayInput {
  /** Seats in the order they were dealt, with the stacks they started the hand with. */
  seats: readonly { id: string; stack: number }[];
  events: readonly HandEvent[];
}

/**
 * Every state the table passed through, one frame per event.
 *
 * Frames are cheap and immutable, so a replay is just an index into this array.
 */
export function replayHand({ seats, events }: ReplayInput): readonly ReplayFrame[] {
  const name = (seat: SeatIndex): string => seats[seat]?.id ?? `Seat ${seat}`;
  const frames: ReplayFrame[] = [];
  let snapshot = initialSnapshot(seats);

  for (const [index, event] of events.entries()) {
    snapshot = applyEvent(snapshot, event);
    frames.push({ index, event, description: describeEvent(event, name), snapshot });
  }

  return frames;
}

/**
 * The coach's verdicts lined up against the frames they belong to.
 *
 * Returns one entry per frame: the review of that frame's action, or null where
 * the frame is not a graded decision by `seat`. `reviewHand` drops any decision
 * the coach could not grade, so the reviews are a *subsequence* of the seat's
 * actions rather than a guaranteed pairing — when the counts disagree this
 * returns all nulls rather than attributing a grade to the wrong action. A
 * coach that says nothing is recoverable; one that blames the wrong decision is
 * not.
 */
export function reviewsByFrame(
  frames: readonly ReplayFrame[],
  reviews: readonly DecisionReview[],
  seat: SeatIndex,
): readonly (DecisionReview | null)[] {
  const acted = frames.filter(
    (frame) => frame.event.type === 'actionTaken' && frame.event.seat === seat,
  );

  if (acted.length !== reviews.length) {
    return frames.map(() => null);
  }

  const byIndex = new Map(acted.map((frame, ordinal) => [frame.index, reviews[ordinal] ?? null]));

  return frames.map((frame) => byIndex.get(frame.index) ?? null);
}

/** Every chip wagered this hand: the middle plus what is still in front of seats. */
export function snapshotPot(snapshot: TableSnapshot): number {
  return snapshot.seats.reduce((sum, seat) => sum + seat.bet, snapshot.pot);
}

/** Chips a seat needs to match the largest bet in front of anyone. */
export function snapshotToCall(snapshot: TableSnapshot, seat: SeatIndex): number {
  const highest = snapshot.seats.reduce((max, other) => Math.max(max, other.bet), 0);

  return Math.max(0, highest - (snapshot.seats[seat]?.bet ?? 0));
}

function initialSnapshot(seats: ReplayInput['seats']): TableSnapshot {
  return {
    handNumber: 0,
    button: 0,
    street: 'preflop',
    board: [],
    seats: seats.map((seat, index) => ({
      seat: index,
      id: seat.id,
      stack: seat.stack,
      bet: 0,
      // A seat with no chips is never dealt in; the log confirms it by never
      // dealing it cards.
      status: seat.stack > 0 ? 'active' : 'sittingOut',
      holeCards: null,
      shown: false,
      mucked: false,
      won: 0,
      rank: null,
      bestFive: null,
    })),
    pot: 0,
    actor: null,
    complete: false,
  };
}

function applyEvent(snapshot: TableSnapshot, event: HandEvent): TableSnapshot {
  switch (event.type) {
    case 'handStart':
      return {
        ...snapshot,
        handNumber: event.handNumber,
        button: event.button,
        actor: null,
      };

    case 'blindPosted': {
      // An ante is dead money: it goes straight to the middle rather than
      // sitting in front of the seat as part of what they have bet.
      const ante = event.kind === 'ante';

      return withSeat(
        { ...snapshot, pot: ante ? snapshot.pot + event.amount : snapshot.pot, actor: event.seat },
        event.seat,
        (seat) => ({
          ...seat,
          stack: seat.stack - event.amount,
          bet: ante ? seat.bet : seat.bet + event.amount,
          status: event.allIn ? 'allIn' : seat.status,
        }),
      );
    }

    case 'holeCardsDealt':
      return withSeat({ ...snapshot, actor: null }, event.seat, (seat) => ({
        ...seat,
        holeCards: event.cards,
      }));

    case 'streetDealt':
      return {
        ...collectBets(snapshot),
        street: event.street,
        board: [...snapshot.board, ...event.cards],
        actor: null,
      };

    case 'actionTaken':
      return withSeat({ ...snapshot, actor: event.seat }, event.seat, (seat) =>
        applyPlayerAction(seat, event.action, event.allIn),
      );

    case 'uncalledBetReturned':
      return withSeat({ ...snapshot, actor: event.seat }, event.seat, (seat) => ({
        ...seat,
        stack: seat.stack + event.amount,
        bet: seat.bet - event.amount,
      }));

    case 'handRevealed':
      // Cards only — the rank arrives with `showdownHand`, once there is a
      // full board to rank against.
      return withSeat({ ...snapshot, actor: event.seat }, event.seat, (seat) => ({
        ...seat,
        holeCards: event.cards,
        shown: true,
      }));

    case 'showdownHand':
      return withSeat({ ...collectBets(snapshot), actor: event.seat }, event.seat, (seat) => ({
        ...seat,
        holeCards: event.cards,
        shown: true,
        rank: event.rank,
        bestFive: event.bestFive ?? null,
      }));

    case 'handMucked':
      return withSeat({ ...collectBets(snapshot), actor: event.seat }, event.seat, (seat) => ({
        ...seat,
        mucked: true,
      }));

    case 'potAwarded': {
      const collected = collectBets(snapshot);

      return withSeat(
        { ...collected, pot: collected.pot - event.amount, actor: event.seat },
        event.seat,
        (seat) => ({ ...seat, stack: seat.stack + event.amount, won: seat.won + event.amount }),
      );
    }

    case 'handEnd':
      return { ...snapshot, street: event.street, actor: null, complete: true };
  }
}

function applyPlayerAction(seat: ReplaySeat, action: LoggedAction, allIn: boolean): ReplaySeat {
  const status: PlayerStatus = action.type === 'fold' ? 'folded' : allIn ? 'allIn' : seat.status;

  switch (action.type) {
    case 'fold':
    case 'check':
      return { ...seat, status };
    case 'call':
      return { ...seat, status, stack: seat.stack - action.amount, bet: seat.bet + action.amount };
    case 'bet':
    case 'raise':
      // `to` is the total street commitment, so the chips that move are only
      // the difference from what is already in front of the seat.
      return { ...seat, status, stack: seat.stack - (action.to - seat.bet), bet: action.to };
  }
}

/** Pulls the street's bets into the middle. Idempotent once they are already in. */
function collectBets(snapshot: TableSnapshot): TableSnapshot {
  const bets = snapshot.seats.reduce((sum, seat) => sum + seat.bet, 0);

  if (bets === 0) {
    return snapshot;
  }

  return {
    ...snapshot,
    pot: snapshot.pot + bets,
    seats: snapshot.seats.map((seat) => (seat.bet === 0 ? seat : { ...seat, bet: 0 })),
  };
}

function withSeat(
  snapshot: TableSnapshot,
  seat: SeatIndex,
  update: (previous: ReplaySeat) => ReplaySeat,
): TableSnapshot {
  return {
    ...snapshot,
    seats: snapshot.seats.map((previous) => (previous.seat === seat ? update(previous) : previous)),
  };
}
