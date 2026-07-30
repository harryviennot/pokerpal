import { act, renderHook } from '@testing-library/react-native';

import { parseCards, type Card, type ReplaySeat, type TableSnapshot } from '@/engine';

import { useRunoutEquity } from './useRunoutEquity';

const HERO = 0;

const hole = (notation: string): readonly [Card, Card] =>
  parseCards(notation) as unknown as readonly [Card, Card];

function seat(index: number, id: string, overrides: Partial<ReplaySeat> = {}): ReplaySeat {
  return {
    seat: index,
    id,
    stack: 0,
    bet: 0,
    status: 'allIn',
    holeCards: null,
    shown: false,
    mucked: false,
    won: 0,
    rank: null,
    bestFive: null,
    ...overrides,
  };
}

function snapshotOf(seats: ReplaySeat[], overrides: Partial<TableSnapshot> = {}): TableSnapshot {
  return {
    handNumber: 1,
    button: 0,
    street: 'turn',
    board: [],
    seats,
    pot: 1_000,
    actor: null,
    complete: false,
    ...overrides,
  };
}

/**
 * An all-in on the turn: aces against a set of kings, one card to come.
 *
 * Forty-four runouts, so the engine enumerates rather than samples and the answer
 * arrives on the first render with no sampling error in it at all.
 */
const TURN = snapshotOf(
  [
    seat(HERO, 'You', { holeCards: hole('Ah Ad') }),
    seat(1, 'Ava', { holeCards: hole('Kh Kc'), shown: true }),
  ],
  { board: parseCards('Ks 8d 3c 2h') },
);

/** The same all-in, called before the flop: too many runouts to walk, so sampled. */
const PREFLOP = snapshotOf(
  [
    seat(HERO, 'You', { holeCards: hole('Ah Ad') }),
    seat(1, 'Ava', { holeCards: hole('Kh Kc'), shown: true }),
  ],
  { street: 'preflop' },
);

const percent = (badge: string | null | undefined): number => Number(badge?.replace('%', ''));

describe('useRunoutEquity', () => {
  it('badges every hand on the table with what it is worth', async () => {
    const { result } = await renderHook(() => useRunoutEquity({ snapshot: TURN, heroSeat: HERO }));
    const badges = result.current;

    expect(badges?.[HERO]).toMatch(/^\d+%$/);
    expect(badges?.[1]).toMatch(/^\d+%$/);
    // A set of kings is far ahead of aces with one card to come, and between them
    // the two hands own the whole pot.
    expect(percent(badges?.[1])).toBeGreaterThan(percent(badges?.[HERO]));
    expect(percent(badges?.[HERO]) + percent(badges?.[1])).toBeGreaterThanOrEqual(99);
    expect(percent(badges?.[HERO]) + percent(badges?.[1])).toBeLessThanOrEqual(101);
  });

  it('samples a run-out too large to walk, without blocking the first frame', async () => {
    jest.useFakeTimers();

    try {
      const { result } = await renderHook(() =>
        useRunoutEquity({ snapshot: PREFLOP, heroSeat: HERO }),
      );

      // Nothing yet: a preflop all-in is over a million runouts, so the answer is
      // sampled across frames rather than found before the screen paints.
      expect(result.current?.[HERO]).toBeNull();

      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      expect(result.current?.[HERO]).toMatch(/^\d+%$/);
      expect(percent(result.current?.[HERO])).toBeGreaterThan(percent(result.current?.[1]));
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('says nothing when only the hero has their cards up', async () => {
    const alone = snapshotOf(
      [
        seat(HERO, 'You', { holeCards: hole('Ah Ad') }),
        seat(1, 'Ava', { holeCards: hole('Kh Kc') }),
      ],
      { board: parseCards('Ks 8d 3c 2h') },
    );

    const { result } = await renderHook(() => useRunoutEquity({ snapshot: alone, heroSeat: HERO }));

    // Ava's cards are in the log but not on the table, and a badge over the back
    // of a card would hand out the hand with it.
    expect(result.current).toBeNull();
  });

  it('says nothing once the pot has been pushed', async () => {
    const { result } = await renderHook(() =>
      useRunoutEquity({ snapshot: { ...TURN, complete: true }, heroSeat: HERO }),
    );

    expect(result.current).toBeNull();
  });

  it('ignores a hand that folded or mucked rather than pricing it', async () => {
    const folded = snapshotOf(
      [
        seat(HERO, 'You', { holeCards: hole('Ah Ad') }),
        seat(1, 'Ava', { holeCards: hole('Kh Kc'), shown: true, mucked: true }),
        seat(2, 'Ben', { holeCards: hole('7s 7d'), status: 'folded' }),
      ],
      { board: parseCards('Ks 8d 3c 2h') },
    );

    const { result } = await renderHook(() =>
      useRunoutEquity({ snapshot: folded, heroSeat: HERO }),
    );

    expect(result.current).toBeNull();
  });

  it('says nothing between hands, when there is no frame at all', async () => {
    const { result } = await renderHook(() => useRunoutEquity({ snapshot: null, heroSeat: HERO }));

    expect(result.current).toBeNull();
  });
});
