import { type ReplaySeat } from '@/engine';
import { colors } from '@/theme';

import { seatTone, stackLine } from './seatTone';

const { light } = colors;

function seat(overrides: Partial<ReplaySeat> = {}): ReplaySeat {
  return {
    seat: 0,
    id: 'Ava',
    stack: 1000,
    bet: 0,
    status: 'active',
    holeCards: null,
    shown: false,
    mucked: false,
    won: 0,
    rank: null,
    bestFive: null,
    ...overrides,
  };
}

describe('seatTone', () => {
  it('is dark while a seat waits its turn', () => {
    expect(seatTone(seat(), false, light)).toEqual({
      state: 'waiting',
      background: light.pillDark,
      ink: light.onPillDark,
    });
  });

  it('inverts to white for the seat on the clock', () => {
    const tone = seatTone(seat(), true, light);

    expect(tone.state).toBe('acting');
    expect(tone.background).toBe(light.pillLight);
    expect(tone.ink).toBe(light.onPillLight);
  });

  it('greys out a seat that folded or sat out', () => {
    expect(seatTone(seat({ status: 'folded' }), false, light).background).toBe(light.pillFolded);
    expect(seatTone(seat({ status: 'sittingOut' }), false, light).background).toBe(
      light.pillFolded,
    );
  });

  it('keeps a folded seat grey even on the frame that names it the actor', () => {
    // The frame that shows a fold still has that seat as `actor`; whitening it
    // would put the clock on somebody who has already acted.
    expect(seatTone(seat({ status: 'folded' }), true, light).state).toBe('folded');
  });

  it('goes gold for a winner, whatever else is true of them', () => {
    // Won after folding — everyone behind folded too — is a real hand.
    expect(seatTone(seat({ won: 120, status: 'folded' }), false, light).state).toBe('winner');
    expect(seatTone(seat({ won: 120 }), true, light).background).toBe(light.plateGold);
  });

  it('reads legibly in either scheme', () => {
    // The arena palette is deliberately the same in light and dark, so the plate
    // must not change with the OS.
    expect(seatTone(seat(), false, colors.dark)).toEqual(seatTone(seat(), false, light));
  });
});

describe('stackLine', () => {
  it('shows the stack behind, grouped', () => {
    expect(stackLine(seat({ stack: 12500 }))).toBe('12 500');
  });

  it('shows the gain once a seat takes the pot', () => {
    expect(stackLine(seat({ won: 240, stack: 1240 }))).toBe('+240');
  });

  it('says all-in rather than nothing when the stack is gone', () => {
    expect(stackLine(seat({ stack: 0, status: 'allIn' }))).toBe('All-in');
  });

  it('shows a bare zero for a seat that is simply broke', () => {
    expect(stackLine(seat({ stack: 0 }))).toBe('0');
  });
});
