import { renderHook } from '@testing-library/react-native';

import { type ReplayFrame } from '@/engine';
import { playHand, HERO_SEAT, SEATS } from '@/fixtures/playedHand';

import { type ActiveGame } from './types';
import { useShownFrame } from './useShownFrame';

const PLAYED = playHand();

/**
 * A game whose engine hand is finished but whose screen has only been shown
 * `shown` events.
 *
 * That gap is the normal state of this screen rather than an edge case: the store
 * reveals one event per tick while the engine has already resolved the whole
 * street. Only the four fields the hook reads are filled in.
 */
function gameAt(shown: number): ActiveGame {
  return {
    shown,
    handSeats: [...SEATS],
    hand: { events: PLAYED.events },
    heroSeat: HERO_SEAT,
  } as unknown as ActiveGame;
}

async function frameAt(shown: number): Promise<ReplayFrame | null> {
  const { result } = await renderHook(() => useShownFrame(gameAt(shown)));

  return result.current;
}

describe('useShownFrame', () => {
  it('renders the prefix of the log the player has been shown', async () => {
    const last = await frameAt(PLAYED.events.length);

    expect(last?.index).toBe(PLAYED.events.length - 1);
    expect(last?.snapshot.complete).toBe(true);
  });

  it('lags the engine rather than jumping to the newest frame', async () => {
    const early = await frameAt(4);

    // The engine has already played the hand out; the screen is four events in.
    expect(early?.index).toBe(3);
    expect(early?.snapshot.complete).toBe(false);
    expect(early?.snapshot.board).toHaveLength(0);
  });

  it('lets the board arrive a card at a time as events are revealed', async () => {
    const sizes: number[] = [];

    for (let shown = 1; shown <= PLAYED.events.length; shown++) {
      sizes.push((await frameAt(shown))?.snapshot.board.length ?? -1);
    }

    // Never runs ahead of itself, and reaches a full board only at the end.
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    expect(sizes[0]).toBe(0);
    expect(sizes[sizes.length - 1]).toBe(5);
  });

  it('draws the opening event rather than nothing when no event has been shown', async () => {
    // The store reveals the first event in the same tick that it deals, so this is
    // only ever a transient — but a blank felt for a frame would be visible.
    expect((await frameAt(0))?.index).toBe(0);
  });
});
