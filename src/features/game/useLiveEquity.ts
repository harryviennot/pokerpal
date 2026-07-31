import { useMemo } from 'react';

import {
  requiredEquity,
  snapshotPot,
  snapshotToCall,
  type Card,
  type EquityRequest,
  type OpponentSpec,
  type ReplaySeat,
  type SeatIndex,
  type TableSnapshot,
} from '@/engine';
import { useChunkedEquity } from '@/hooks/useChunkedEquity';
import { formatPercentWhole } from '@/utils/format';

export interface UseLiveEquityInput {
  /**
   * The frame on screen — never the engine's hand, which runs ahead of it. The
   * engine deals a run-out in one burst, so reading its board would put the river
   * in the badge a second before the turn is on the table.
   */
  snapshot: TableSnapshot | null;
  heroSeat: SeatIndex;
  /**
   * Learning mode only. Real mode says nothing until the session is over: being
   * told your equity mid-hand is being coached, and that is the whole difference
   * between the two modes.
   */
  enabled: boolean;
}

export interface LiveEquityRead {
  /** Frosted badges by seat — the hero's own only. Null when there is nothing to say. */
  badges: readonly (string | null)[] | null;
  /** One line for the console: what the hand is worth, and what the price needs. */
  hint: string | null;
}

/**
 * What the hero's hand is worth right now, and whether the price is fair.
 *
 * Against unknown hands, so it is the honest figure a player could work out for
 * themselves rather than a peek at what the bots are holding — the range modelling
 * the coach does belongs after the hand, not over the top of it.
 */
export function useLiveEquity({ snapshot, heroSeat, enabled }: UseLiveEquityInput): LiveEquityRead {
  const hero = snapshot?.seats[heroSeat] ?? null;
  const cards = enabled && snapshot !== null && !snapshot.complete ? heroCards(hero) : null;
  const board = snapshot?.board ?? NO_CARDS;
  const against = snapshot ? opponentsOf(snapshot, heroSeat) : 0;
  const key = cards && against > 0 ? `${cards.join(',')}|${board.join(',')}|${against}` : '';

  const requests = useMemo<readonly EquityRequest[] | null>(
    () =>
      cards && against > 0
        ? [
            {
              hero: cards,
              board,
              opponents: Array.from({ length: against }, (): OpponentSpec => RANDOM),
            },
          ]
        : null,
    [cards, board, against],
  );

  const equity = useChunkedEquity(key, requests)[0] ?? null;

  if (equity === null || !snapshot) {
    return NOTHING;
  }

  const badge = formatPercentWhole(equity);
  const toCall = snapshotToCall(snapshot, heroSeat);

  return {
    badges: snapshot.seats.map((seat) => (seat.seat === heroSeat ? badge : null)),
    // `requiredEquity` is undefined without a price, so a free look says only what
    // the hand is worth rather than inventing a break-even point for nothing.
    hint:
      toCall > 0
        ? `${badge} to win · ${formatPercentWhole(requiredEquity(snapshotPot(snapshot), toCall))} to call`
        : `${badge} to win`,
  };
}

/** The hero's hand while they are still in the pot, or null once they are not. */
function heroCards(hero: ReplaySeat | null): readonly [Card, Card] | null {
  if (!hero || (hero.status !== 'active' && hero.status !== 'allIn')) {
    return null;
  }

  return hero.holeCards;
}

/** Opponents still contesting the pot, as the frame on screen shows it. */
function opponentsOf(snapshot: TableSnapshot, heroSeat: SeatIndex): number {
  return snapshot.seats.filter(
    (seat) => seat.seat !== heroSeat && (seat.status === 'active' || seat.status === 'allIn'),
  ).length;
}

const RANDOM: OpponentSpec = { kind: 'random' };

const NO_CARDS: readonly Card[] = [];

const NOTHING: LiveEquityRead = { badges: null, hint: null };
