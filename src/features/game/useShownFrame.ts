import { useMemo } from 'react';

import { replayHand, type ReplayFrame } from '@/engine';

import { type ActiveGame } from './types';

/**
 * The frame the player has actually been shown.
 *
 * The one rule on this screen that is easy to get wrong, and expensive: `shown`
 * counts REVEALED EVENTS, not board cards, and the engine runs well ahead of it. A
 * street closing or a showdown resolving appends several events at once, and the
 * store hands them over one tick at a time. Rendering the prefix is what makes the
 * cards and the chips arrive one by one.
 *
 * So this must never follow the newest frame. `useHandReplay(..., { follow: true })`
 * does exactly that and belongs to the tracker, where the hand is already over;
 * using it here would jump the felt to the end of every burst and undo the whole
 * of the store's pacing in a single line.
 */
export function useShownFrame({ handSeats, hand, shown }: ActiveGame): ReplayFrame | null {
  return useMemo(() => {
    // At least the first event, which carries only the hand's number and its
    // button. The store reveals it in the same tick that it deals, so the floor is
    // never reached in practice; without it a zero would leave nothing to draw.
    const events = hand.events.slice(0, Math.max(1, shown));
    const frames = replayHand({ seats: handSeats, events });

    return frames[frames.length - 1] ?? null;
  }, [handSeats, hand.events, shown]);
}
