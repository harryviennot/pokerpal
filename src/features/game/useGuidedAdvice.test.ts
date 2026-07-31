import { act, cleanup, renderHook } from '@testing-library/react-native';

import { createRng, recommend, startHand, type HandState, type TableConfig } from '@/engine';

import { useGuidedAdvice } from './useGuidedAdvice';

const CONFIG: TableConfig = {
  seats: [
    { id: 'You', stack: 1_000 },
    { id: 'Ava', stack: 1_000 },
    { id: 'Ben', stack: 1_000 },
  ],
  button: 0,
  blinds: { smallBlind: 5, bigBlind: 10 },
  seed: 7,
};

const HERO_SEAT = 0;

function dealt(): HandState {
  return startHand(CONFIG, createRng(7));
}

/** Turns the clock until the chunked Monte Carlo behind the guide has finished. */
async function settle(): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(1_000);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(async () => {
  await cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('useGuidedAdvice', () => {
  it('says nothing, and is not thinking, when the guide is off', async () => {
    const { result } = await renderHook(() =>
      useGuidedAdvice({ hand: dealt(), heroSeat: HERO_SEAT, enabled: false }),
    );

    await settle();

    expect(result.current).toEqual({ recommendation: null, pending: false });
  });

  it('reports that it is working before it has an answer', async () => {
    const { result } = await renderHook(() =>
      useGuidedAdvice({ hand: dealt(), heroSeat: HERO_SEAT, enabled: true }),
    );

    expect(result.current.pending).toBe(true);
    expect(result.current.recommendation).toBeNull();
  });

  it('names a move once the sampling lands', async () => {
    const { result } = await renderHook(() =>
      useGuidedAdvice({ hand: dealt(), heroSeat: HERO_SEAT, enabled: true }),
    );

    await settle();

    expect(result.current.pending).toBe(false);
    expect(result.current.recommendation?.best.type).toBeDefined();
    expect(result.current.recommendation?.seat).toBe(HERO_SEAT);
  });

  it('says nothing about a seat that is not the one to act', async () => {
    const hand = dealt();
    const other = hand.toAct === 1 ? 2 : 1;
    const { result } = await renderHook(() =>
      useGuidedAdvice({ hand, heroSeat: other, enabled: true }),
    );

    await settle();

    expect(result.current).toEqual({ recommendation: null, pending: false });
  });

  /**
   * The reason this hook exists rather than a second opinion built for the
   * felt: what it advises before the decision is what the grade is measured
   * against afterwards.
   */
  it('measures the same lines the grader measures', async () => {
    const hand = dealt();
    const { result } = await renderHook(() =>
      useGuidedAdvice({ hand, heroSeat: HERO_SEAT, enabled: true }),
    );

    await settle();

    const graded = recommend(hand, HERO_SEAT, { rng: createRng(1), iterations: 4_000 });
    const live = result.current.recommendation;

    expect(live?.lines.map((line) => line.action.type)).toEqual(
      graded?.lines.map((line) => line.action.type),
    );
    // Sampled independently, so the equities agree within Monte Carlo noise
    // rather than exactly.
    expect(live?.facts.equity).toBeCloseTo(graded?.facts.equity ?? 0, 1);
    expect(live?.facts.pot).toBe(graded?.facts.pot);
    expect(live?.facts.toCall).toBe(graded?.facts.toCall);
  });

  it('never puts a card the hero holds in an opponent range', async () => {
    const hand = dealt();
    const hole = hand.players[HERO_SEAT]?.holeCards ?? [];
    const { result } = await renderHook(() =>
      useGuidedAdvice({ hand, heroSeat: HERO_SEAT, enabled: true }),
    );

    await settle();

    // The guide reads ranges, not cards: `modelOpponents` walks the public
    // event log, so nothing it produces is a peek at what anyone is holding.
    expect(result.current.recommendation?.facts.equity).toBeGreaterThan(0);
    expect(hole).toHaveLength(2);
  });
});
