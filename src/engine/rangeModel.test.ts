import { parseCards } from './cards';
import { applyAction, startHand } from './hand';
import { chenScore, modelOpponents, strengthOf } from './rangeModel';
import { allCombos, type Combo } from './ranges';
import { createRng } from './rng';
import { type Action, type TableConfig } from './table';

const CONFIG: TableConfig = {
  seats: Array.from({ length: 4 }, (_, seat) => ({ id: `Seat ${seat}`, stack: 1000 })),
  button: 0,
  blinds: { smallBlind: 5, bigBlind: 10 },
  seed: 11,
};

const combo = (text: string): Combo => {
  const cards = parseCards(text);

  return [cards[0], cards[1]] as unknown as Combo;
};

function play(script: readonly Action[]) {
  return script.reduce(
    (state, action) => applyAction(state, action),
    startHand(CONFIG, createRng(2)),
  );
}

describe('chenScore', () => {
  it('matches the published values for the hands everyone knows', () => {
    expect(chenScore(combo('As Ah'))).toBe(20);
    expect(chenScore(combo('As Ks'))).toBe(12);
    expect(chenScore(combo('7s 2h'))).toBe(-1);
    expect(chenScore(combo('5s 5h'))).toBe(5);
  });

  it('prefers suited to offsuit and connected to gapped', () => {
    expect(chenScore(combo('As Ks'))).toBeGreaterThan(chenScore(combo('As Kh')));
    expect(chenScore(combo('9s 8h'))).toBeGreaterThan(chenScore(combo('9s 4h')));
  });

  it('ranks every pair above its own high card offsuit', () => {
    expect(chenScore(combo('Ts Th'))).toBeGreaterThan(chenScore(combo('Ts 9h')));
  });
});

describe('strengthOf', () => {
  it('scores preflop hands on Chen and postflop hands on what they make', () => {
    const board = parseCards('Ah Kh Qh');

    expect(strengthOf(combo('As Ad'), [])).toBe(chenScore(combo('As Ad')));
    // A flush beats a pair of aces once there is a board to make it on.
    expect(strengthOf(combo('Jh Th'), board)).toBeGreaterThan(strengthOf(combo('As Ad'), board));
  });
});

describe('modelOpponents', () => {
  it('models every live seat except the observer', () => {
    const models = modelOpponents(play([]), 0);

    expect([...models.keys()].sort()).toEqual([1, 2, 3]);
  });

  it('drops a seat that folded', () => {
    // Four-handed with the button on seat 0, the first seat to act is 3.
    const models = modelOpponents(play([{ type: 'fold' }]), 1);

    expect(models.has(3)).toBe(false);
    expect(models.has(0)).toBe(true);
  });

  it('narrows a raiser further than a caller', () => {
    // Seat 3 opens, seat 0 calls.
    const state = play([{ type: 'raise', to: 30 }, { type: 'call' }]);
    const models = modelOpponents(state, 1);

    expect(models.get(3)?.combos.length).toBeLessThan(models.get(0)?.combos.length ?? 0);
    expect(models.get(3)?.fraction).toBeLessThan(1);
  });

  it('narrows further with every action a seat takes', () => {
    const once = modelOpponents(play([{ type: 'raise', to: 30 }]), 1).get(3);
    const twice = modelOpponents(
      play([
        { type: 'raise', to: 30 },
        { type: 'raise', to: 90 },
        { type: 'fold' },
        { type: 'fold' },
        { type: 'call' },
      ]),
      1,
    ).get(3);

    expect(twice?.combos.length).toBeLessThan(once?.combos.length ?? 0);
  });

  it('never lets a hand hold a card that is on the board or in the observer hand', () => {
    const state = play([{ type: 'call' }, { type: 'call' }, { type: 'call' }, { type: 'check' }]);
    const hero = state.players[0]?.holeCards ?? [];
    const dead = new Set([...state.board, ...hero]);
    const models = modelOpponents(state, 0, { dead: hero });
    const offending = [...models.values()].flatMap((model) =>
      model.combos.filter((c) => dead.has(c[0]) || dead.has(c[1])),
    );

    expect(state.board.length).toBeGreaterThan(0);
    expect(offending).toEqual([]);
  });

  it('never narrows a range away to nothing', () => {
    const state = play([
      { type: 'raise', to: 30 },
      { type: 'raise', to: 90 },
      { type: 'fold' },
      { type: 'fold' },
      { type: 'raise', to: 270 },
      { type: 'call' },
      { type: 'bet', to: 200 },
      { type: 'raise', to: 600 },
      { type: 'call' },
    ]);

    for (const model of modelOpponents(state, 3).values()) {
      expect(model.combos.length).toBeGreaterThan(0);
    }
  });

  it('starts from every combo that is not dead', () => {
    const models = modelOpponents(play([]), 0);

    expect(models.get(1)?.combos.length).toBe(allCombos().length);
    expect(models.get(1)?.fraction).toBe(1);
  });
});
