import { makeBot, SHARK, TAG } from './archetypes';
import { alwaysCall, alwaysFold } from './bots';
import { simulateMatch } from './simulate';
import { InvalidTableError } from './table';

const BLINDS = { smallBlind: 5, bigBlind: 10 };

const base = {
  hands: 40,
  startingStack: 1000,
  blinds: BLINDS,
  seed: 4,
};

describe('simulateMatch', () => {
  it('plays the requested number of hands', () => {
    const result = simulateMatch({ ...base, policies: [alwaysCall, alwaysCall, alwaysCall] });

    expect(result.hands).toBe(40);
    expect(result.net).toHaveLength(3);
  });

  it('conserves chips: what one seat wins, the others lost', () => {
    const result = simulateMatch({
      ...base,
      policies: [makeBot(TAG, { iterations: 40 }), alwaysCall, alwaysFold, alwaysCall],
    });

    expect(result.net.reduce((sum, chips) => sum + chips, 0)).toBe(0);
  });

  it('reports the same run twice from the same seed', () => {
    const policies = [makeBot(TAG, { iterations: 40 }), alwaysCall, alwaysCall];

    expect(simulateMatch({ ...base, policies })).toEqual(simulateMatch({ ...base, policies }));
  });

  it('reports a different run from a different seed', () => {
    const policies = [makeBot(TAG, { iterations: 40 }), alwaysCall, alwaysCall];

    expect(simulateMatch({ ...base, policies, seed: 1 }).net).not.toEqual(
      simulateMatch({ ...base, policies, seed: 2 }).net,
    );
  });

  it('converts chips into big blinds per hundred hands', () => {
    const result = simulateMatch({ ...base, policies: [alwaysCall, alwaysCall, alwaysFold] });

    result.net.forEach((chips, seat) => {
      expect(result.bbPer100[seat]).toBeCloseTo((chips * 100) / base.hands / BLINDS.bigBlind, 6);
    });
  });

  it('hands the blinds around when everybody folds', () => {
    // 39 hands, not the usual 40: folding around is chip-neutral only over a
    // whole orbit, and three-handed that means a multiple of three. One hand
    // more and the small blind is down exactly its blind.
    const result = simulateMatch({
      ...base,
      hands: 39,
      policies: [alwaysFold, alwaysFold, alwaysFold],
    });

    expect(result.net).toEqual([0, 0, 0]);
    expect(result.raises).toEqual([0, 0, 0]);
    expect(result.voluntary).toEqual([0, 0, 0]);
  });

  it('counts a call of the big blind as voluntary and a check as not', () => {
    const result = simulateMatch({ ...base, policies: [alwaysCall, alwaysCall, alwaysCall] });

    // Every seat calls preflop every hand; nobody ever bets, so every later
    // street is checked through and adds nothing.
    expect(result.voluntary.every((count) => count > 0)).toBe(true);
    expect(result.raises).toEqual([0, 0, 0]);
  });

  it('refuses a match with no hands in it', () => {
    expect(() => simulateMatch({ ...base, hands: 0, policies: [alwaysCall, alwaysCall] })).toThrow(
      InvalidTableError,
    );
  });
});

/**
 * The PRD wants 100k+ hands before it believes a bot. That is a minute of CPU,
 * not something to put in front of every commit, so it is opt-in:
 *
 *     POKER_LONG_SIM=1 npx jest --selectProjects engine simulate
 */
const long = process.env.POKER_LONG_SIM === '1' ? describe : describe.skip;

long('the long run', () => {
  /**
   * The PRD's tier ladder: a Hard bot has to beat a Medium one. Three of each,
   * seats interleaved so neither side owns the button, over a sample big enough
   * that a single seed's variance cannot decide it. Measured at 2 400 hands
   * while writing this: the Sharks took 4 348 chips off the TAGs, winning five
   * of six seeds — the one they lost is why this is not a 400-hand test.
   */
  it('has the Shark beat the TAG', () => {
    let sharks = 0;

    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const result = simulateMatch({
        policies: [
          makeBot(SHARK),
          makeBot(TAG),
          makeBot(SHARK),
          makeBot(TAG),
          makeBot(SHARK),
          makeBot(TAG),
        ],
        hands: 400,
        startingStack: 1000,
        blinds: BLINDS,
        seed,
      });

      sharks += (result.net[0] ?? 0) + (result.net[2] ?? 0) + (result.net[4] ?? 0);
    }

    expect(sharks).toBeGreaterThan(0);
  }, 3_600_000);

  it('has the TAG beat a table of calling stations over 100k hands', () => {
    const result = simulateMatch({
      policies: [makeBot(TAG), alwaysCall, alwaysCall, alwaysCall, alwaysCall, alwaysCall],
      hands: 100_000,
      startingStack: 1000,
      blinds: BLINDS,
      seed: 1,
    });

    expect(result.bbPer100[0]).toBeGreaterThan(0);
  }, 3_600_000);
});
