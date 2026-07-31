import { useMemo } from 'react';

import {
  type Card,
  type EquityRequest,
  type ReplaySeat,
  type SeatIndex,
  type TableSnapshot,
} from '@/engine';
import { useChunkedEquity } from '@/hooks/useChunkedEquity';
import { formatPercentWhole } from '@/utils/format';

export interface UseRunoutEquityInput {
  /** The frame on screen. Only the hands it shows face up are ever read. */
  snapshot: TableSnapshot | null;
  /** The seat whose cards the table always shows: the hero's own. */
  heroSeat: SeatIndex;
}

/**
 * A hand with its cards on the table and its equity worth showing.
 *
 * Face up means face up *on screen*: the hero's own always, an opponent's only
 * once the log has shown them. Reading `holeCards` for a seat the player cannot
 * see would put a badge over the back of a card and hand out the hand with it.
 */
interface FaceUp {
  seat: SeatIndex;
  cards: readonly [Card, Card];
}

/** The fewest hands worth comparing. One hand against nobody has no equity. */
const MIN_HANDS = 2;

/**
 * Per-seat equity for the frosted badges on an all-in run-out.
 *
 * Both modes, unlike the coaching: once the chips are in there is no decision
 * left to influence, so showing what each hand is worth is not help, it is the
 * scoreboard — and watching a pair hold at 28% is the most instructive thing a
 * losing all-in ever does.
 *
 * Returns null unless at least two hands are face up on a hand still in progress,
 * which is exactly when the reference shows the badges. Note that this engine
 * only turns hands over at showdown, so today the window opens as the hands are
 * revealed one at a time and closes when the pot is pushed; a run-out that turns
 * the hands over before the board completes will light the same badges up with no
 * change here.
 */
export function useRunoutEquity({
  snapshot,
  heroSeat,
}: UseRunoutEquityInput): readonly (string | null)[] | null {
  const board = snapshot?.board ?? NO_CARDS;
  const hands = faceUpHands(snapshot, heroSeat);
  const live = snapshot !== null && !snapshot.complete && hands.length >= MIN_HANDS;
  const key = live ? `${board.join(',')}|${hands.map(describe).join('|')}` : '';

  const requests = useMemo<readonly EquityRequest[] | null>(
    () =>
      live
        ? hands.map((hand) => ({
            hero: hand.cards,
            board,
            opponents: hands
              .filter((other) => other.seat !== hand.seat)
              .map((other) => ({ kind: 'known' as const, cards: other.cards })),
          }))
        : null,
    // The hands and the board are rebuilt from the frame on every render; `key` is
    // the content that actually decides the answer, and what pins the run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  const equities = useChunkedEquity(key, requests);

  if (!live) {
    return null;
  }

  // One entry per chair, so `seatBadges[seat]` is never a hole. Cheap enough at
  // nine seats to rebuild every render rather than memoise.
  const badges: (string | null)[] = snapshot.seats.map(() => null);

  hands.forEach((hand, index) => {
    const equity = equities[index];

    badges[hand.seat] = equity === null || equity === undefined ? null : formatPercentWhole(equity);
  });

  return badges;
}

/** Hands the frame is showing, in seat order. */
function faceUpHands(snapshot: TableSnapshot | null, heroSeat: SeatIndex): readonly FaceUp[] {
  if (!snapshot) {
    return NO_HANDS;
  }

  const shown: FaceUp[] = [];

  for (const seat of snapshot.seats) {
    if (seat.holeCards && isFaceUp(seat, heroSeat)) {
      shown.push({ seat: seat.seat, cards: seat.holeCards });
    }
  }

  return shown;
}

function isFaceUp(seat: ReplaySeat, heroSeat: SeatIndex): boolean {
  if (seat.mucked || seat.status === 'folded' || seat.status === 'sittingOut') {
    return false;
  }

  return seat.shown || seat.seat === heroSeat;
}

const describe = (hand: FaceUp): string => `${hand.seat}:${hand.cards.join('.')}`;

const NO_CARDS: readonly Card[] = [];

const NO_HANDS: readonly FaceUp[] = [];
