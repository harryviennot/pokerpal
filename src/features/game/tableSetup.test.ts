import { CALLING_STATION, MANIAC, ROCK, SHARK, TAG, startSession } from '@/engine';

import {
  blindLadder,
  DEFAULT_GAME_SETUP,
  DEFAULT_SETUP,
  describeBlinds,
  MAX_OPPONENTS,
  seatsFor,
  STAKE_OPTIONS,
  toSessionConfig,
  type GameSetup,
} from './tableSetup';

function setup(overrides: Partial<GameSetup> = {}): GameSetup {
  return { ...DEFAULT_GAME_SETUP, ...overrides };
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

describe('toSessionConfig in real mode', () => {
  it('plays the whole ladder', () => {
    const config = toSessionConfig(setup({ mode: 'real' }), 1);

    expect(config.levels).toEqual(blindLadder(DEFAULT_SETUP.blinds));
    expect(config.levels.length).toBeGreaterThan(1);
  });

  it('refuses to rebuy however the toggle is left', () => {
    // Blinds that keep rising against a stack you can top up is not a game with
    // any pressure in it, which is the only thing real mode adds.
    expect(toSessionConfig(setup({ mode: 'real', rebuys: true }), 1).rebuyTo).toBeUndefined();
  });

  it('starts on the stakes the player chose', () => {
    const config = toSessionConfig(
      setup({ mode: 'real', blinds: { smallBlind: 25, bigBlind: 50 } }),
      1,
    );

    expect(config.levels[0]).toEqual({ smallBlind: 25, bigBlind: 50 });
  });

  it('builds a session the engine accepts for every stake offered', () => {
    for (const blinds of STAKE_OPTIONS) {
      expect(() => startSession(toSessionConfig(setup({ mode: 'real', blinds }), 2))).not.toThrow();
    }
  });
});

describe('blindLadder', () => {
  it('starts on the chosen blinds', () => {
    expect(blindLadder({ smallBlind: 5, bigBlind: 10 })[0]).toEqual({
      smallBlind: 5,
      bigBlind: 10,
    });
  });

  it('escalates in the documented style', () => {
    // The shape a live tournament clock uses: roughly a third, then a half, so
    // the stakes double every two levels.
    expect(blindLadder({ smallBlind: 15, bigBlind: 30 }).slice(0, 5)).toEqual([
      { smallBlind: 15, bigBlind: 30 },
      { smallBlind: 20, bigBlind: 40 },
      { smallBlind: 30, bigBlind: 60 },
      { smallBlind: 40, bigBlind: 80 },
      { smallBlind: 60, bigBlind: 120 },
    ]);
  });

  it('is strictly increasing and roughly a dozen levels, for every stake offered', () => {
    for (const blinds of STAKE_OPTIONS) {
      const ladder = blindLadder(blinds);

      expect(ladder.length).toBeGreaterThanOrEqual(10);
      expect(ladder.length).toBeLessThanOrEqual(12);

      ladder.forEach((level, index) => {
        const previous = ladder[index - 1];

        expect(Number.isInteger(level.smallBlind)).toBe(true);
        expect(level.bigBlind).toBeGreaterThan(level.smallBlind);

        if (previous) {
          expect(level.smallBlind).toBeGreaterThan(previous.smallBlind);
          expect(level.bigBlind).toBeGreaterThan(previous.bigBlind);
        }
      });
    }
  });

  it('keeps the big blind and the ante in proportion', () => {
    const ladder = blindLadder({ smallBlind: 50, bigBlind: 100, ante: 10 });

    ladder.forEach((level) => {
      expect(level.bigBlind).toBe(level.smallBlind * 2);
      expect(level.ante).toBe(Math.round(level.smallBlind * 0.2));
    });
  });

  it('leaves the ante out when the table has none', () => {
    expect(blindLadder({ smallBlind: 5, bigBlind: 10 }).every((level) => !level.ante)).toBe(true);
  });

  it('rounds to blinds a cardroom would print', () => {
    expect(blindLadder({ smallBlind: 5, bigBlind: 10 }).map((level) => level.smallBlind)).toEqual([
      5, 6, 10, 15, 20, 30, 40, 50, 80, 100, 150, 200,
    ]);
  });
});

describe('describeBlinds', () => {
  it('names the stakes, and the ante only when there is one', () => {
    expect(describeBlinds({ smallBlind: 5, bigBlind: 10 })).toBe('5 / 10');
    expect(describeBlinds({ smallBlind: 50, bigBlind: 100, ante: 10 })).toBe('50 / 100 (10 ante)');
  });
});
