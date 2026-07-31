import { useMemo } from 'react';

import {
  factsFrom,
  opponentSpecs,
  rankLines,
  type EquityRequest,
  type HandState,
  type Recommendation,
  type SeatIndex,
} from '@/engine';

import { useChunkedEquity } from './useChunkedEquity';

export interface UseGuidedAdviceInput {
  /**
   * The engine's hand, not the frame on screen.
   *
   * The opposite of what `useLiveEquity` does, and for a reason: this only ever
   * runs when it is the hero's turn, and the pump does not hand the hero the
   * turn until every card and chip has been revealed. At that moment the engine
   * and the felt agree, and the engine is the state the decision is made in.
   */
  hand: HandState;
  heroSeat: SeatIndex;
  /** Learning mode with the guide switched on. Nothing is computed otherwise. */
  enabled: boolean;
}

export interface GuidedRead {
  /** What the coach would do, or null while it is still working it out. */
  recommendation: Recommendation | null;
  /** True while there is an answer coming. Distinguishes "thinking" from "nothing to say". */
  pending: boolean;
}

/**
 * What the coach would do in the spot the hero is looking at.
 *
 * The same ranking that grades the hand afterwards, run before the decision
 * instead of after it — so taking the advice cannot earn a bad grade.
 *
 * Equity comes through `useChunkedEquity`, which samples in small chunks on a
 * zero-delay timer, because a full Monte Carlo run against modelled ranges is
 * long enough to drop frames on the one screen that cannot afford to. Once it
 * lands, `factsFrom` and `rankLines` are pure arithmetic and cost nothing.
 *
 * Ranges, not random hands. `useLiveEquity` deliberately measures against random
 * hands so its badge is a figure the player could work out themselves; a guide
 * that ignored what the table's betting has said would be giving worse advice
 * than a competent opponent gives themselves. `modelOpponents` reads only the
 * public event log, so nothing here is a peek at anyone's cards.
 */
export function useGuidedAdvice({ hand, heroSeat, enabled }: UseGuidedAdviceInput): GuidedRead {
  const asking = enabled && !hand.complete && hand.toAct === heroSeat;
  const hole = asking ? (hand.players[heroSeat]?.holeCards ?? null) : null;
  const specs = useMemo(
    () => (hole ? opponentSpecs(hand, heroSeat, hole) : null),
    // Pinned to the decision rather than to `hand`, which is a fresh object on
    // every tick of the pump: rebuilding the specs would restart the sampling
    // run under a player who has not done anything.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hole, heroSeat, hand.handNumber, hand.events.length],
  );

  const key = specs && hole ? `${hand.handNumber}|${hand.events.length}|${hole.join(',')}` : '';

  const requests = useMemo<readonly EquityRequest[] | null>(
    () =>
      hole && specs && specs.length > 0
        ? [{ hero: hole, board: hand.board, opponents: specs }]
        : null,
    [hole, specs, hand.board],
  );

  const equity = useChunkedEquity(key, requests)[0] ?? null;

  return useMemo(() => {
    if (!asking || !requests) {
      return NOTHING;
    }

    if (equity === null) {
      return WORKING;
    }

    const facts = factsFrom(hand, heroSeat, equity);
    const recommendation = facts ? rankLines(hand, heroSeat, facts) : null;

    return recommendation ? { recommendation, pending: false } : NOTHING;
  }, [asking, requests, equity, hand, heroSeat]);
}

const NOTHING: GuidedRead = { recommendation: null, pending: false };

const WORKING: GuidedRead = { recommendation: null, pending: true };
