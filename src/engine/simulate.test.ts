import { makeBot, TAG } from './archetypes';
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
