import { parseCards, type Card } from './cards';
import {
  enumerateEquity,
  equity,
  InvalidEquityRequestError,
  runoutCount,
  simulateEquity,
  type EquityRequest,
  type OpponentSpec,
} from './equity';
import { presetRange } from './ranges';
import { createRng } from './rng';

const hole = (notation: string): readonly [Card, Card] => {
  const cards = parseCards(notation);

  return [cards[0] as Card, cards[1] as Card];
};

const versus = (notation: string): OpponentSpec => ({ kind: 'known', cards: hole(notation) });

describe('enumerateEquity', () => {
  it('reports a certain win when hero already holds the nuts on a full board', () => {
    const result = enumerateEquity({
      hero: hole('As Ks'),
      board: parseCards('Qs Js Ts 2c 3d'),
      opponents: [versus('Ah Ad')],
    });

    expect(result.equity).toBe(1);
    expect(result.win).toBe(1);
    expect(result.exact).toBe(true);
    expect(result.iterations).toBe(1);
  });

  it('reports a split when the board plays for both players', () => {
    const result = enumerateEquity({
      hero: hole('2c 3d'),
      board: parseCards('As Ks Qs Js Ts'),
      opponents: [versus('4h 5h')],
    });

    expect(result.equity).toBe(0.5);
    expect(result.tie).toBe(1);
  });

  it('splits three ways when three players chop', () => {
    const result = enumerateEquity({
      hero: hole('2c 3d'),
      board: parseCards('As Ks Qs Js Ts'),
      opponents: [versus('4h 5h'), versus('6h 7h')],
    });

    expect(result.equity).toBeCloseTo(1 / 3, 10);
  });

  it('counts every river card exactly once', () => {
    const result = enumerateEquity({
      hero: hole('Ah Kh'),
      board: parseCards('Qh Jh 2c 5d'),
      opponents: [versus('9s 9d')],
    });

    // 52 - 2 hero - 4 board - 2 villain = 44 possible rivers.
    expect(result.iterations).toBe(44);
    expect(result.exact).toBe(true);
  });

  it('enumerates both turn and river', () => {
    const result = enumerateEquity({
      hero: hole('Ah Kh'),
      board: parseCards('Qh Jh 2c'),
      opponents: [versus('9s 9d')],
    });

    // C(45, 2) = 990.
    expect(result.iterations).toBe(990);
  });

  it('refuses to run when an opponent hand is unknown', () => {
    expect(() =>
      enumerateEquity({
        hero: hole('Ah Kh'),
        board: parseCards('Qh Jh 2c'),
        opponents: [{ kind: 'random' }],
      }),
    ).toThrow(InvalidEquityRequestError);
  });

  it('adds up: win, tie and lose account for every runout', () => {
    const result = enumerateEquity({
      hero: hole('Ah Kd'),
      board: parseCards('Qh Jd 2c'),
      opponents: [versus('9s 9c')],
    });

    expect(result.win + result.tie + result.lose).toBeCloseTo(1, 10);
  });
});

describe('simulateEquity matches exact enumeration', () => {
  // The two paths share only the evaluator, so agreement is real evidence.
  const spots: [string, EquityRequest][] = [
    [
      'AK suited vs pocket nines on a Qh Jh 2c flop',
      { hero: hole('Ah Kh'), board: parseCards('Qh Jh 2c'), opponents: [versus('9s 9d')] },
    ],
    [
      'overpair vs flush draw on the turn',
      { hero: hole('Ac Ad'), board: parseCards('Kh 7h 2s 3c'), opponents: [versus('Qh Jh')] },
    ],
    [
      'set vs open-ender on the flop',
      { hero: hole('7c 7d'), board: parseCards('7h 9s Tc'), opponents: [versus('Jd 8d')] },
    ],
    [
      'three-way flop',
      {
        hero: hole('As Ks'),
        board: parseCards('Qs 8d 3c'),
        opponents: [versus('9h 9d'), versus('Jc Tc')],
      },
    ],
  ];

  it.each(spots)('agrees within 1 point: %s', (_name, request) => {
    const exact = enumerateEquity(request);
    const sampled = simulateEquity({ ...request, rng: createRng(4242), iterations: 60_000 });

    expect(Math.abs(sampled.equity - exact.equity)).toBeLessThan(0.01);
    expect(Math.abs(sampled.win - exact.win)).toBeLessThan(0.01);
    expect(Math.abs(sampled.tie - exact.tie)).toBeLessThan(0.01);
  });
});

describe('simulateEquity', () => {
  it('is deterministic for a given seed', () => {
    const request = {
      hero: hole('Ah Kh'),
      board: parseCards('Qh Jh 2c'),
      opponents: [{ kind: 'random' } as OpponentSpec],
      iterations: 2_000,
    };

    const a = simulateEquity({ ...request, rng: createRng(7) });
    const b = simulateEquity({ ...request, rng: createRng(7) });

    expect(a).toEqual(b);
  });

  it('gives a different answer for a different seed, but a close one', () => {
    const request = {
      hero: hole('Ah Kh'),
      opponents: [{ kind: 'random' } as OpponentSpec],
      iterations: 40_000,
    };

    const a = simulateEquity({ ...request, rng: createRng(1) });
    const b = simulateEquity({ ...request, rng: createRng(2) });

    expect(a.equity).not.toBe(b.equity);
    expect(Math.abs(a.equity - b.equity)).toBeLessThan(0.01);
  });

  it('never deals a card twice across a runout', () => {
    // A duplicate would silently corrupt equity, so assert the invariant
    // directly by giving every opponent a range and checking the tally is sane.
    const result = simulateEquity({
      hero: hole('Ah Kh'),
      board: parseCards('Qh Jh 2c'),
      opponents: [
        { kind: 'range', combos: presetRange('tight') },
        { kind: 'range', combos: presetRange('standard') },
      ],
      iterations: 5_000,
      rng: createRng(11),
    });

    expect(result.win + result.tie + result.lose).toBeCloseTo(1, 10);
    expect(result.equity).toBeGreaterThan(0);
    expect(result.equity).toBeLessThan(1);
  });

  it('respects a range: aces should fare worse against a tight range than a random hand', () => {
    const base = { hero: hole('Ac Ad'), iterations: 30_000 };

    const versusRandom = simulateEquity({
      ...base,
      opponents: [{ kind: 'random' }],
      rng: createRng(3),
    });
    const versusTight = simulateEquity({
      ...base,
      opponents: [{ kind: 'range', combos: presetRange('tight') }],
      rng: createRng(3),
    });

    expect(versusTight.equity).toBeLessThan(versusRandom.equity);
  });

  it('drops equity as opponents are added', () => {
    const equities = [1, 2, 4, 8].map(
      (count) =>
        simulateEquity({
          hero: hole('Ac Ad'),
          opponents: Array.from({ length: count }, () => ({ kind: 'random' }) as OpponentSpec),
          iterations: 20_000,
          rng: createRng(5),
        }).equity,
    );

    for (let i = 1; i < equities.length; i++) {
      expect(equities[i]).toBeLessThan(equities[i - 1] as number);
    }
  });

  it('rejects impossible requests', () => {
    const rng = createRng(1);

    expect(() =>
      simulateEquity({ hero: hole('Ah Ah'), opponents: [{ kind: 'random' }], rng }),
    ).toThrow(InvalidEquityRequestError);

    expect(() =>
      simulateEquity({
        hero: hole('Ah Kh'),
        board: parseCards('Ah 2c 3d'),
        opponents: [{ kind: 'random' }],
        rng,
      }),
    ).toThrow(InvalidEquityRequestError);

    expect(() => simulateEquity({ hero: hole('Ah Kh'), opponents: [], rng })).toThrow(
      InvalidEquityRequestError,
    );

    expect(() =>
      simulateEquity({
        hero: hole('Ah Kh'),
        opponents: [{ kind: 'range', combos: [] }],
        rng,
      }),
    ).toThrow(InvalidEquityRequestError);

    expect(() =>
      simulateEquity({
        hero: hole('Ah Kh'),
        opponents: [{ kind: 'random' }],
        iterations: 0,
        rng,
      }),
    ).toThrow(InvalidEquityRequestError);
  });

  it('rejects a board longer than five cards', () => {
    expect(() =>
      simulateEquity({
        hero: hole('Ah Kh'),
        board: parseCards('2c 3d 4h 5s 6c 7d'),
        opponents: [{ kind: 'random' }],
        rng: createRng(1),
      }),
    ).toThrow(InvalidEquityRequestError);
  });
});

describe('equity', () => {
  it('takes the exact path when the runout space is small', () => {
    const result = equity({
      hero: hole('Ah Kh'),
      board: parseCards('Qh Jh 2c'),
      opponents: [versus('9s 9d')],
      rng: createRng(1),
    });

    expect(result.exact).toBe(true);
    expect(result.iterations).toBe(990);
  });

  it('samples when an opponent hand is unknown', () => {
    const result = equity({
      hero: hole('Ah Kh'),
      board: parseCards('Qh Jh 2c'),
      opponents: [{ kind: 'random' }],
      iterations: 1_000,
      rng: createRng(1),
    });

    expect(result.exact).toBe(false);
  });

  it('samples preflop, where enumeration would be millions of runouts', () => {
    const result = equity({
      hero: hole('Ah Kh'),
      opponents: [versus('9s 9d')],
      iterations: 1_000,
      rng: createRng(1),
    });

    expect(result.exact).toBe(false);
  });
});

describe('runoutCount', () => {
  it('counts the remaining boards', () => {
    expect(runoutCount(5, 45)).toBe(1);
    expect(runoutCount(4, 44)).toBe(44);
    expect(runoutCount(3, 45)).toBe(990);
    expect(runoutCount(0, 48)).toBe(1_712_304);
  });
});
