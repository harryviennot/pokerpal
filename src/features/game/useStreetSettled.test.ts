import { act, renderHook } from '@testing-library/react-native';

import { parseCard, parseCards, type HandEvent } from '@/engine';

import { streetSettleFor } from './pacing';
import { useStreetSettled } from './useStreetSettled';

const FLOP: HandEvent = {
  type: 'streetDealt',
  street: 'flop',
  cards: parseCards('Qc 7d 2s'),
  burned: parseCard('9h'),
};

const CHECK: HandEvent = {
  type: 'actionTaken',
  seat: 1,
  action: { type: 'check' },
  allIn: false,
};

describe('useStreetSettled', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('is settled for anything that is not a street', async () => {
    const { result } = await renderHook(() => useStreetSettled(CHECK));

    expect(result.current).toBe(true);
  });

  it('holds while a street lands, then settles after the pause', async () => {
    const { result } = await renderHook(() => useStreetSettled(FLOP));

    expect(result.current).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(streetSettleFor('flop') - 1);
    });

    expect(result.current).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    expect(result.current).toBe(true);
  });

  it('settles immediately once a later event replaces the street', async () => {
    const { result, rerender } = await renderHook(
      ({ event }: { event: HandEvent }) => useStreetSettled(event),
      { initialProps: { event: FLOP } },
    );

    expect(result.current).toBe(false);

    await rerender({ event: CHECK });

    expect(result.current).toBe(true);
  });

  it('holds again for the next street of the same hand', async () => {
    const turn: HandEvent = {
      type: 'streetDealt',
      street: 'turn',
      cards: parseCards('9s'),
      burned: parseCard('4h'),
    };
    const { result, rerender } = await renderHook(
      ({ event }: { event: HandEvent }) => useStreetSettled(event),
      { initialProps: { event: FLOP } },
    );

    await act(async () => {
      jest.advanceTimersByTime(streetSettleFor('flop'));
    });

    expect(result.current).toBe(true);

    await rerender({ event: turn });

    expect(result.current).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(streetSettleFor('turn'));
    });

    expect(result.current).toBe(true);
  });

  it('holds a lone card longer than the flop, absorbing its later stagger', () => {
    expect(streetSettleFor('turn')).toBeGreaterThan(streetSettleFor('flop'));
    expect(streetSettleFor('river')).toBeGreaterThan(streetSettleFor('turn'));
  });
});
