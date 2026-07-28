import { act, cleanup, renderHook } from '@testing-library/react-native';

import { DEMO_HAND } from './demoHand';
import { useHandReplay } from './useHandReplay';

afterEach(async () => {
  await cleanup();
});

describe('useHandReplay', () => {
  it('opens on the first frame of the hand', async () => {
    const { result } = await renderHook(() => useHandReplay(DEMO_HAND));

    expect(result.current.index).toBe(0);
    expect(result.current.frame.event.type).toBe('handStart');
    expect(result.current.atStart).toBe(true);
    expect(result.current.atEnd).toBe(false);
    expect(result.current.frames).toHaveLength(DEMO_HAND.events.length);
  });

  it('steps forwards and backwards through the log', async () => {
    const { result } = await renderHook(() => useHandReplay(DEMO_HAND));

    await act(async () => result.current.step(1));
    expect(result.current.index).toBe(1);

    await act(async () => result.current.step(-1));
    expect(result.current.index).toBe(0);
  });

  it('stops at both ends rather than running off the log', async () => {
    const { result } = await renderHook(() => useHandReplay(DEMO_HAND));

    await act(async () => result.current.step(-1));
    expect(result.current.index).toBe(0);

    await act(async () => result.current.step(DEMO_HAND.events.length * 2));
    expect(result.current.index).toBe(DEMO_HAND.events.length - 1);
    expect(result.current.atEnd).toBe(true);
    expect(result.current.snapshot.complete).toBe(true);
  });

  it('jumps a street at a time', async () => {
    const { result } = await renderHook(() => useHandReplay(DEMO_HAND));

    await act(async () => result.current.stepStreet(1));
    expect(result.current.frame.event).toMatchObject({ type: 'streetDealt', street: 'flop' });

    await act(async () => result.current.stepStreet(1));
    expect(result.current.frame.event).toMatchObject({ type: 'streetDealt', street: 'turn' });

    await act(async () => result.current.stepStreet(-1));
    expect(result.current.frame.event).toMatchObject({ type: 'streetDealt', street: 'flop' });
  });

  it('runs to the end of the hand when no street is left', async () => {
    const { result } = await renderHook(() => useHandReplay(DEMO_HAND));

    for (let street = 0; street < 5; street++) {
      await act(async () => result.current.stepStreet(1));
    }

    expect(result.current.atEnd).toBe(true);
  });

  it('restarts to the top of the hand', async () => {
    const { result } = await renderHook(() => useHandReplay(DEMO_HAND));

    await act(async () => result.current.step(6));
    await act(async () => result.current.restart());

    expect(result.current.index).toBe(0);
    expect(result.current.snapshot.complete).toBe(false);
  });
});
