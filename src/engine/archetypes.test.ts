import { ARCHETYPES, CALLING_STATION, makeBot, MANIAC, ROCK, TAG } from './archetypes';
import { legalActions } from './betting';
import { alwaysCall } from './bots';
import { applyAction, startHand } from './hand';
import { createRng } from './rng';
import { simulateMatch } from './simulate';
import { type TableConfig } from './table';

const BLINDS = { smallBlind: 5, bigBlind: 10 };

const SIX_HANDED: TableConfig = {
  seats: Array.from({ length: 6 }, (_, seat) => ({ id: `Seat ${seat}`, stack: 1000 })),
  button: 0,
  blinds: BLINDS,
  seed: 5,
};

/** A table of one archetype and five calling stations, for behaviour counts. */
function mixedTable(hands: number, seed: number) {
  return simulateMatch({
    policies: [
      makeBot(ROCK),
      makeBot(CALLING_STATION),
      makeBot(MANIAC),
      makeBot(TAG),
      alwaysCall,
      alwaysCall,
    ],
    hands,
    startingStack: 1000,
    blinds: BLINDS,
    seed,
  });
}

const ROCK_SEAT = 0;
const STATION_SEAT = 1;
const MANIAC_SEAT = 2;
const TAG_SEAT = 3;

describe('makeBot', () => {
  it('only ever returns an action the rules allow', () => {
    const broken: string[] = [];

    for (const profile of ARCHETYPES) {
      const bot = makeBot(profile, { iterations: 40 });

      for (let seed = 1; seed <= 12; seed++) {
        const rng = createRng(seed);
        let state = startHand({ ...SIX_HANDED, seed }, createRng(seed));

        for (let step = 0; step < 200 && !state.complete; step++) {
          const legal = legalActions(state);

          if (legal.length === 0) {
            break;
          }

          const action = bot(state, legal, rng);
          const option = legal.find((candidate) => candidate.type === action.type);

          if (!option) {
            broken.push(`${profile.name} chose ${action.type}, which was not legal`);
            break;
          }

          if ((action.type === 'bet' || action.type === 'raise') && option.type === action.type) {
            if (action.to < option.min || action.to > option.max) {
              broken.push(
                `${profile.name} sized ${action.to} outside ${option.min}..${option.max}`,
              );
              break;
            }
          }

          state = applyAction(state, action);
        }
      }
    }

    expect(broken).toEqual([]);
  });

  it('decides the same way twice from the same seed', () => {
    const bot = makeBot(TAG, { iterations: 40 });
    const state = startHand(SIX_HANDED, createRng(1));
    const legal = legalActions(state);

    expect(bot(state, legal, createRng(9))).toEqual(bot(state, legal, createRng(9)));
  });

  it('folds rather than acting on a hand it cannot see', () => {
    const bot = makeBot(TAG, { iterations: 40 });
    const state = startHand(SIX_HANDED, createRng(1));
    const blind = { ...state, players: state.players.map((p) => ({ ...p, holeCards: null })) };

    expect(bot(blind, legalActions(state), createRng(1)).type).toBe('fold');
  });
});

/**
 * The archetypes are named after how they play, so that is what gets checked:
 * not that a Maniac is good, but that it is loose and aggressive, and that the
 * Rock and the Calling Station are not. Counted over a seeded run rather than
 * asserted spot by spot — a personality is a distribution, not a decision.
 */
describe('archetype behaviour', () => {
  const match = mixedTable(200, 3);
  const aggression = (seat: number): number =>
    (match.raises[seat] ?? 0) / Math.max(1, match.voluntary[seat] ?? 0);

  it('puts them in order of how loose they are', () => {
    expect(match.voluntary[ROCK_SEAT]).toBeLessThan(match.voluntary[TAG_SEAT] ?? 0);
    expect(match.voluntary[TAG_SEAT]).toBeLessThan(match.voluntary[STATION_SEAT] ?? 0);
    expect(match.voluntary[STATION_SEAT]).toBeLessThan(match.voluntary[MANIAC_SEAT] ?? 0);
  });

  it('puts them in order of how aggressive they are', () => {
    expect(aggression(STATION_SEAT)).toBeLessThan(aggression(TAG_SEAT));
    expect(aggression(TAG_SEAT)).toBeLessThan(aggression(MANIAC_SEAT));
  });

  it('has the calling station call far more often than it raises', () => {
    expect(aggression(STATION_SEAT)).toBeLessThan(0.1);
  });
});

/**
 * The PRD's acceptance criterion for the bots: an always-call strategy has to
 * lose chips to a Medium bot. `POKER_LONG_SIM=1` runs the long version.
 */
describe('measured against the baseline', () => {
  const beatsAlwaysCall = (profile: typeof TAG, hands: number, seed: number): number => {
    const result = simulateMatch({
      policies: [makeBot(profile), alwaysCall, alwaysCall, alwaysCall, alwaysCall, alwaysCall],
      hands,
      startingStack: 1000,
      blinds: BLINDS,
      seed,
    });

    return result.bbPer100[0] ?? 0;
  };

  it('has the TAG take chips off a table of calling stations', () => {
    expect(beatsAlwaysCall(TAG, 300, 1)).toBeGreaterThan(0);
  });

  it('has the Rock beat it too, by playing far fewer hands', () => {
    expect(beatsAlwaysCall(ROCK, 300, 7)).toBeGreaterThan(0);
  });
});
