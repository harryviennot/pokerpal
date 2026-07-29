import { CALLING_STATION, MANIAC, ROCK, SHARK, TAG, startSession } from '@/engine';

import {
  DEFAULT_SETUP,
  describeBlinds,
  MAX_OPPONENTS,
  seatsFor,
  toSessionConfig,
  type TableSetup,
} from './tableSetup';

function setup(overrides: Partial<TableSetup> = {}): TableSetup {
  return { ...DEFAULT_SETUP, ...overrides };
}

describe('seatsFor', () => {
  it('seats the hero first and names every opponent', () => {
    const seats = seatsFor(setup({ opponents: 3 }));

    expect(seats).toHaveLength(4);
    expect(seats[0]).toEqual({ id: 'You', profile: null });
    expect(seats.slice(1).map((seat) => seat.id)).toEqual(['Ava', 'Ben', 'Cleo']);
  });

  it('deals a mixed table a different archetype per seat', () => {
    const seats = seatsFor(setup({ opponents: 4, mix: 'mixed' }));

    expect(seats.slice(1).map((seat) => seat.profile)).toEqual([
      TAG,
      CALLING_STATION,
      ROCK,
      MANIAC,
    ]);
  });

  it('fills a single-archetype table with that archetype', () => {
    const seats = seatsFor(setup({ opponents: 5, mix: 'shark' }));

    expect(seats.slice(1).every((seat) => seat.profile === SHARK)).toBe(true);
  });

  it('clamps a count the engine could not seat', () => {
    expect(seatsFor(setup({ opponents: 0 }))).toHaveLength(2);
    expect(seatsFor(setup({ opponents: 99 }))).toHaveLength(MAX_OPPONENTS + 1);
  });
});

describe('toSessionConfig', () => {
  it('carries the stack, the stakes and the style through', () => {
    const config = toSessionConfig(
      setup({ opponents: 2, startingStack: 2_500, blinds: { smallBlind: 25, bigBlind: 50 } }),
      7,
    );

    expect(config.seats).toEqual([
      { id: 'You', stack: 2_500 },
      { id: 'Ava', stack: 2_500 },
      { id: 'Ben', stack: 2_500 },
    ]);
    expect(config.levels).toEqual([{ smallBlind: 25, bigBlind: 50 }]);
    expect(config.style).toBe('cash');
    expect(config.seed).toBe(7);
    expect(config.rebuyTo).toBe(2_500);
  });

  it('leaves rebuys off when they are off', () => {
    expect(toSessionConfig(setup({ rebuys: false }), 1).rebuyTo).toBeUndefined();
  });

  it('refuses to rebuy in a sit-and-go however the toggle is left', () => {
    const config = toSessionConfig(setup({ style: 'sitAndGo', rebuys: true }), 1);

    expect(config.style).toBe('sitAndGo');
    expect(config.rebuyTo).toBeUndefined();
  });

  it('builds a table the engine accepts, at both ends of the range', () => {
    for (const opponents of [1, MAX_OPPONENTS]) {
      const session = startSession(toSessionConfig(setup({ opponents }), 3));

      expect(session.seats).toHaveLength(opponents + 1);
      expect(session.over).toBe(false);
    }
  });

  it('builds a playable table for every mix and stake the screen offers', () => {
    for (const mix of ['mixed', 'rock', 'callingStation', 'maniac', 'tag', 'shark'] as const) {
      for (const blinds of [
        { smallBlind: 1, bigBlind: 2 },
        { smallBlind: 50, bigBlind: 100, ante: 10 },
      ]) {
        expect(() =>
          startSession(toSessionConfig(setup({ mix, blinds, startingStack: 500 }), 5)),
        ).not.toThrow();
      }
    }
  });
});

describe('describeBlinds', () => {
  it('names the stakes, and the ante only when there is one', () => {
    expect(describeBlinds({ smallBlind: 5, bigBlind: 10 })).toBe('5 / 10');
    expect(describeBlinds({ smallBlind: 50, bigBlind: 100, ante: 10 })).toBe('50 / 100 (10 ante)');
  });
});
