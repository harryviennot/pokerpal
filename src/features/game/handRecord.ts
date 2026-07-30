/**
 * A hand's row: the stacks it was dealt from, what it cost the hero, and the
 * archiver that writes it down.
 *
 * Kept out of the store because none of it is a decision — it is the bookkeeping
 * the store does either side of one, and it is all pure but the archiver.
 */

import {
  type DecisionReview,
  type HandState,
  type SeatIndex,
  type SessionConfig,
  type SessionState,
} from '@/engine';
import { getHandHistoryRepo, HandArchiver, type ArchivedHand } from '@/services/handHistory';

/** One archiver per session: its lazily created row is the session's identity. */
export function makeArchiver(
  config: SessionConfig,
  heroSeat: SeatIndex,
  onStatus: (status: 'ok' | 'error') => void,
): HandArchiver {
  return new HandArchiver(
    getHandHistoryRepo,
    {
      style: config.style,
      seed: config.seed,
      heroSeat,
      blinds: config.levels[0] ?? { smallBlind: 0, bigBlind: 0 },
    },
    onStatus,
  );
}

/** Everything the repository needs to keep a finished hand, replayably. */
export function toArchived(
  hand: HandState,
  seats: readonly { id: string; stack: number }[],
  heroSeat: SeatIndex,
  reviews: readonly DecisionReview[],
): ArchivedHand {
  return {
    handNumber: hand.handNumber,
    seed: hand.seed,
    button: hand.button,
    blinds: hand.blinds,
    seats,
    events: hand.events,
    heroNet: heroNetOf(hand, seats, heroSeat),
    reviews,
  };
}

/** The hero's chips won or lost on one hand. */
export function heroNetOf(
  hand: HandState,
  seats: readonly { id: string; stack: number }[],
  heroSeat: SeatIndex,
): number {
  return (hand.players[heroSeat]?.stack ?? 0) - (seats[heroSeat]?.stack ?? 0);
}

/**
 * The stacks a hand is about to be dealt from.
 *
 * Taken before the deal, because once blinds are posted the players' stacks no
 * longer say what they started the hand on — which is what net-for-the-hand,
 * the archive row and the felt's seat labels all need.
 */
export function seatsOf(session: SessionState): readonly { id: string; stack: number }[] {
  return session.seats.map((seat) => ({ id: seat.id, stack: seat.seated ? seat.stack : 0 }));
}
