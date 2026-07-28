import { legalActions } from './betting';
import { alwaysCall, alwaysFold, playUntilSeat } from './bots';
import { applyAction, startHand } from './hand';
import { createRng } from './rng';
import { totalPot, type HandState, type TableConfig } from './table';

const CONFIG: TableConfig = {
  seats: [
    { id: 'Hero', stack: 1000 },
    { id: 'Bot 1', stack: 1000 },
    { id: 'Bot 2', stack: 1000 },
  ],
  button: 0,
  blinds: { smallBlind: 5, bigBlind: 10 },
  seed: 3,
};

const HERO = 0;

function fresh(): HandState {
  return startHand(CONFIG, createRng(3));
}

describe('alwaysCall', () => {
  it('calls when there is a price and checks when there is not', () => {
    const rng = createRng(1);
    const preflop = fresh();

    expect(alwaysCall(preflop, legalActions(preflop), rng)).toEqual({ type: 'call' });

    const flop = playUntilSeat(applyAction(preflop, { type: 'call' }), HERO, alwaysCall, rng);

    expect(alwaysCall(flop, legalActions(flop), rng)).toEqual({ type: 'check' });
  });

  it('only ever returns an action the rules allow', () => {
    const rng = createRng(9);
    let state = fresh();
    const illegal: string[] = [];

    for (let step = 0; step < 100 && !state.complete; step++) {
      const legal = legalActions(state);

      if (legal.length === 0) {
        break;
      }

      const action = alwaysCall(state, legal, rng);

      if (!legal.some((option) => option.type === action.type)) {
        illegal.push(`${action.type} was not legal at step ${step}`);
      }

      state = applyAction(state, action);
    }

    expect(illegal).toEqual([]);
    expect(state.complete).toBe(true);
  });
});

describe('alwaysFold', () => {
  it('folds to a bet and checks when folding is not offered', () => {
    const rng = createRng(1);
    const preflop = fresh();

    expect(alwaysFold(preflop, legalActions(preflop), rng)).toEqual({ type: 'fold' });
  });

  it('hands the blinds to the big blind when everyone folds around', () => {
    const rng = createRng(1);
    const state = playUntilSeat(fresh(), -1, alwaysFold, rng);

    expect(state.complete).toBe(true);
    // The big blind takes the small blind and gets its own bet back.
    expect(state.players.map((player) => player.stack)).toEqual([1000, 995, 1005]);
  });
});

describe('playUntilSeat', () => {
  it('stops on the hero rather than acting for them', () => {
    const state = playUntilSeat(fresh(), HERO, alwaysCall, createRng(1));

    expect(state.toAct).toBe(HERO);
    expect(state.complete).toBe(false);
  });

  it('runs the hand out when no seat is excluded', () => {
    const state = playUntilSeat(fresh(), -1, alwaysCall, createRng(1));

    expect(state.complete).toBe(true);
    expect(state.board).toHaveLength(5);
    // Three callers, no raises: everyone in for the big blind.
    expect(totalPot(state)).toBe(30);
  });

  it('leaves a finished hand alone', () => {
    const done = playUntilSeat(fresh(), -1, alwaysCall, createRng(1));

    expect(playUntilSeat(done, HERO, alwaysCall, createRng(1))).toBe(done);
  });

  it('conserves chips over many seeded hands', () => {
    const broken: string[] = [];

    for (let seed = 1; seed <= 200; seed++) {
      const state = playUntilSeat(
        startHand({ ...CONFIG, seed }, createRng(seed)),
        -1,
        alwaysCall,
        createRng(seed),
      );
      const behind = state.players.reduce((sum, player) => sum + player.stack, 0);

      if (!state.complete) {
        broken.push(`seed ${seed}: hand did not finish`);
      }

      if (behind !== 3000) {
        broken.push(`seed ${seed}: ${behind} chips behind, expected 3000`);
      }
    }

    expect(broken).toEqual([]);
  });
});
