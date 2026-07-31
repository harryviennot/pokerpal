import { parseCard, parseCards } from '@/engine';

import { computeLiveAdvice, seedOf } from './liveAdvice';
import { LIVE_BIG_BLIND, type LiveObservation } from './liveHandState';

function observation(overrides: Partial<LiveObservation> = {}): LiveObservation {
  return {
    heroCards: [parseCard('9h'), parseCard('8h')],
    board: parseCards('Ah 7h 2c'),
    opponents: 2,
    potBb: 10,
    toCallBb: 1,
    heroStackBb: 100,
    ...overrides,
  };
}

describe('computeLiveAdvice', () => {
  it('never folds a big flush draw offered ten to one', () => {
    const advice = computeLiveAdvice(observation());

    expect(advice).not.toBeNull();
    expect(advice!.best.type).not.toBe('fold');
    expect(advice!.facts.outs).toBeGreaterThanOrEqual(9);
  });

  it('folds bare air facing a pot-sized river bet', () => {
    const advice = computeLiveAdvice(
      observation({
        heroCards: [parseCard('3c'), parseCard('2d')],
        board: parseCards('Ah Ks Qh 7s 9d'),
        potBb: 10,
        toCallBb: 10,
      }),
    );

    expect(advice).not.toBeNull();
    expect(advice!.best.type).toBe('fold');
  });

  it('reports the entered pot and price in chips the engine saw', () => {
    const advice = computeLiveAdvice(observation())!;

    expect(advice.facts.pot).toBe(11 * LIVE_BIG_BLIND);
    expect(advice.facts.toCall).toBe(1 * LIVE_BIG_BLIND);
    expect(advice.facts.requiredEquity).toBeCloseTo(100 / 1200);
  });

  it('gives the same spot the same advice every time', () => {
    const first = computeLiveAdvice(observation());
    const second = computeLiveAdvice(observation());

    expect(second).toEqual(first);
  });

  it('sizes its raises as raise-to totals', () => {
    // A monster facing a small bet: whatever the line, a raise carries `to`.
    const advice = computeLiveAdvice(
      observation({
        heroCards: [parseCard('Ad'), parseCard('Ac')],
        board: parseCards('As 7h 2c'),
        potBb: 6,
        toCallBb: 1,
      }),
    )!;

    if (advice.best.type === 'raise' || advice.best.type === 'bet') {
      expect(advice.best.to).toBeGreaterThan(1 * LIVE_BIG_BLIND);
    }

    expect(advice.reason.length).toBeGreaterThan(0);
  });

  it('returns null for an observation that is not a gradable spot', () => {
    expect(computeLiveAdvice(observation({ board: parseCards('Ah 7h') }))).toBeNull();
  });
});

describe('seedOf', () => {
  it('is stable for equal observations and differs across spots', () => {
    expect(seedOf(observation())).toBe(seedOf(observation()));
    expect(seedOf(observation())).not.toBe(seedOf(observation({ potBb: 12 })));
  });
});
