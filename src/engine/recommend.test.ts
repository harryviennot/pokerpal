import { allCards, parseCards, type Card } from './cards';
import { reviewDecision } from './coach';
import { applyAction, dealHand, startHand } from './hand';
import {
  factsFrom,
  lineValue,
  measureDecision,
  opponentSpecs,
  rankLines,
  recommend,
} from './recommend';
import { createRng } from './rng';
import { type Action, type HandState, type TableConfig } from './table';

const CONFIG: TableConfig = {
  seats: [
    { id: 'Hero', stack: 1000 },
    { id: 'Villain', stack: 1000 },
    { id: 'Other', stack: 1000 },
  ],
  button: 0,
  blinds: { smallBlind: 5, bigBlind: 10 },
  seed: 5,
};

const HERO_SEAT = 0;

const coach = () => ({ rng: createRng(99), iterations: 3_000 });

/**
 * Deals a stated spot rather than hunting for one.
 *
 * The same deck-stacking `coach.test.ts` uses: hole cards go round-robin from
 * the seat left of the button, then a burn card before each street.
 */
function stacked(hands: { hero: string; villain: string; other: string; board?: string }) {
  const hero = parseCards(hands.hero);
  const villain = parseCards(hands.villain);
  const other = parseCards(hands.other);
  const board = hands.board ? parseCards(hands.board) : [];

  const named = [villain[0], other[0], hero[0], villain[1], other[1], hero[1]].filter(
    (card): card is Card => card !== undefined,
  );
  const used = new Set<Card>([...named, ...board]);
  const spare = allCards().filter((card) => !used.has(card));
  const burn = (): Card => spare.shift() as Card;
  const deck: Card[] = [...named];

  for (const street of [board.slice(0, 3), board.slice(3, 4), board.slice(4, 5)]) {
    if (street.length > 0) {
      deck.push(burn(), ...street);
    }
  }

  return dealHand(CONFIG, [...deck, ...spare]);
}

function play(state: HandState, script: readonly Action[]): HandState {
  return script.reduce((current, action) => applyAction(current, action), state);
}

/**
 * Hero holds seven-deuce on a three-spade flop, facing 200 into 230 from a seat
 * holding the nut flush. No pair, no draw, no price that could make it right.
 *
 * Three-handed with the button on seat 0, hero acts first preflop and last on
 * the flop, so the bet reaches them with one seat already out of the way.
 */
const DEAD_ON_THE_FLOP: HandState = play(
  stacked({ hero: '7c 2d', villain: 'As Ks', other: 'Th 9h', board: 'Qs Js 4s' }),
  [
    { type: 'call' },
    { type: 'call' },
    { type: 'check' },
    { type: 'bet', to: 200 },
    { type: 'fold' },
  ],
);

describe('recommend', () => {
  it('says nothing about a hand that is over', () => {
    const done = play(startHand(CONFIG, createRng(1)), [{ type: 'fold' }, { type: 'fold' }]);

    expect(recommend(done, HERO_SEAT, coach())).toBeNull();
  });

  it('says nothing about a seat that is not the one to act', () => {
    const state = stacked({ hero: 'As Ah', villain: 'Kd Kh', other: '7c 7d' });

    expect(state.toAct).not.toBe(1);
    expect(recommend(state, 1, coach())).toBeNull();
  });

  it('never folds the best hand at the table', () => {
    const state = stacked({ hero: 'As Ah', villain: 'Kd Kh', other: '7c 7d' });
    const recommendation = recommend(state, HERO_SEAT, coach());

    expect(recommendation?.facts.equity).toBeGreaterThan(0.5);
    expect(recommendation?.best.type).not.toBe('fold');
  });

  /**
   * Pins the model's known conservatism rather than wishing it away. A value bet
   * is credited with no fold equity at all, so a small pot makes calling with a
   * big edge worth more than raising with it. The guide's copy leans on this:
   * it says what the math likes, never that it is the only right move.
   */
  it('values a raise below a call when the pot is small, having no fold equity', () => {
    const state = stacked({ hero: 'As Ah', villain: 'Kd Kh', other: '7c 7d' });
    const lines = recommend(state, HERO_SEAT, coach())?.lines ?? [];
    const call = lines.find((line) => line.action.type === 'call');
    const raise = lines.find((line) => line.action.type === 'raise');

    expect(raise?.ev).toBeLessThan(call?.ev ?? 0);
  });

  it('folds a hand drawing dead to a price it cannot pay', () => {
    const recommendation = recommend(DEAD_ON_THE_FLOP, HERO_SEAT, coach());

    expect(recommendation?.facts.outs).toBe(0);
    expect(recommendation?.best.type).toBe('fold');
  });

  it('sizes the raise it offers at two-thirds of the pot, on top of the call', () => {
    const raise = recommend(DEAD_ON_THE_FLOP, HERO_SEAT, coach())?.lines.find(
      (line) => line.action.type === 'raise',
    )?.action;
    const facts = recommend(DEAD_ON_THE_FLOP, HERO_SEAT, coach())?.facts;

    if (raise?.type !== 'raise' || !facts) {
      throw new Error('expected a raise to be on offer');
    }

    const committed = DEAD_ON_THE_FLOP.players[HERO_SEAT]?.committedThisStreet ?? 0;

    expect(raise.to).toBe(committed + facts.toCall + Math.round(0.66 * (facts.pot + facts.toCall)));
  });

  it('offers the lines it weighed, passive first', () => {
    const state = stacked({ hero: 'As Ah', villain: 'Kd Kh', other: '7c 7d' });
    const lines = recommend(state, HERO_SEAT, coach())?.lines ?? [];

    expect(lines.map((line) => line.action.type)).toEqual(['fold', 'call', 'raise']);
    expect(lines[0]?.ev).toBe(0);
  });
});

describe('lineValue', () => {
  it('values folding and checking at nothing, whatever else is on offer', () => {
    const state = stacked({ hero: 'As Ah', villain: 'Kd Kh', other: '7c 7d' });
    const recommendation = recommend(state, HERO_SEAT, coach());

    if (!recommendation) {
      throw new Error('expected a recommendation');
    }

    expect(lineValue(recommendation, { type: 'fold' })).toBe(0);
    expect(lineValue(recommendation, { type: 'check' })).toBe(0);
  });

  it('values a bet by the size the coach would have chosen, not the size given', () => {
    const state = stacked({ hero: 'As Ah', villain: 'Kd Kh', other: '7c 7d' });
    const recommendation = recommend(state, HERO_SEAT, coach());

    if (!recommendation) {
      throw new Error('expected a recommendation');
    }

    expect(lineValue(recommendation, { type: 'raise', to: 40 })).toBe(
      lineValue(recommendation, { type: 'raise', to: 900 }),
    );
  });
});

describe('factsFrom', () => {
  it('measures the price without sampling anything', () => {
    const state = stacked({ hero: 'As Ah', villain: 'Kd Kh', other: '7c 7d' });
    const facts = factsFrom(state, HERO_SEAT, 0.5);

    expect(facts?.equity).toBe(0.5);
    expect(facts?.street).toBe('preflop');
    // Hero is on the button facing the big blind, so there is a price to pay.
    expect(facts?.toCall).toBeGreaterThan(0);
    expect(facts?.requiredEquity).toBeCloseTo(
      (facts?.toCall ?? 0) / ((facts?.pot ?? 0) + (facts?.toCall ?? 0)),
    );
  });

  it('reaches the same facts as the sampling path, given its equity', () => {
    const state = stacked({ hero: 'As Ah', villain: 'Kd Kh', other: '7c 7d' });
    const measured = measureDecision(state, HERO_SEAT, coach());

    expect(factsFrom(state, HERO_SEAT, measured?.equity ?? 0)).toEqual(measured);
  });

  it('ranks the same lines from a supplied equity as from a sampled one', () => {
    const state = stacked({ hero: 'As Ah', villain: 'Kd Kh', other: '7c 7d' });
    const sampled = recommend(state, HERO_SEAT, coach());
    const facts = factsFrom(state, HERO_SEAT, sampled?.facts.equity ?? 0);

    expect(facts && rankLines(state, HERO_SEAT, facts)).toEqual(sampled);
  });
});

describe('opponentSpecs', () => {
  it('produces one spec per live opponent', () => {
    const state = stacked({ hero: 'As Ah', villain: 'Kd Kh', other: '7c 7d' });
    const hole = state.players[HERO_SEAT]?.holeCards;

    if (!hole) {
      throw new Error('expected hole cards');
    }

    expect(opponentSpecs(state, HERO_SEAT, hole)).toHaveLength(2);
  });

  it('never puts a card hero holds in an opponent range', () => {
    const state = stacked({ hero: 'As Ah', villain: 'Kd Kh', other: '7c 7d' });
    const hole = state.players[HERO_SEAT]?.holeCards;

    if (!hole) {
      throw new Error('expected hole cards');
    }

    for (const spec of opponentSpecs(state, HERO_SEAT, hole)) {
      if (spec.kind !== 'range') {
        continue;
      }

      for (const combo of spec.combos) {
        expect(hole).not.toContain(combo[0]);
        expect(hole).not.toContain(combo[1]);
      }
    }
  });
});

describe('agreement with the grader', () => {
  /**
   * The whole reason this module exists. The guide speaks before the decision
   * and the grade speaks after it; if they ever named different best lines the
   * player would be marked down for taking the advice they were given.
   */
  it('names the same best line the grade is measured against', () => {
    const spots: HandState[] = [
      stacked({ hero: 'As Ah', villain: 'Kd Kh', other: '7c 7d' }),
      stacked({ hero: '7c 2d', villain: 'As Ks', other: 'Th 9h' }),
      stacked({ hero: 'Jd Th', villain: 'Ac Qc', other: '5s 5d', board: '9h 8c 2d' }),
    ];

    for (const state of spots) {
      const seat = state.toAct as number;

      expect(recommend(state, seat, coach())?.best).toEqual(
        reviewDecision(state, { type: 'fold' }, coach())?.best,
      );
    }
  });

  it('grades the line it recommends as correct', () => {
    const state = stacked({ hero: 'As Ah', villain: 'Kd Kh', other: '7c 7d' });
    const best = recommend(state, HERO_SEAT, coach())?.best;

    if (!best) {
      throw new Error('expected a recommendation');
    }

    expect(reviewDecision(state, best, coach())?.grade).toBe('correct');
  });
});
