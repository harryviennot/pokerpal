import { type DecisionFacts, type DecisionReview } from '@/engine';

import { describeDuration, highlightsOf, tallyGrades } from './sessionReport';
import { type HandCoachRecord } from './types';

const FACTS: DecisionFacts = {
  street: 'flop',
  playersBehind: 0,
  pot: 100,
  toCall: 25,
  stack: 900,
  spr: 9,
  equity: 0.18,
  requiredEquity: 0.2,
  outs: 0,
};

function review(overrides: Partial<DecisionReview> = {}): DecisionReview {
  return {
    seat: 0,
    action: { type: 'call' },
    best: { type: 'fold' },
    grade: 'correct',
    evLoss: 0,
    reason: 'Called 25% of pot holding 18% equity, needing 20%.',
    leak: null,
    facts: FACTS,
    ...overrides,
  };
}

function hand(handNumber: number, reviews: DecisionReview[]): HandCoachRecord {
  return { handNumber, net: 0, reviews };
}

describe('highlightsOf', () => {
  it('names the hand each highlight came from', () => {
    const bestReview = review({ facts: { ...FACTS, pot: 900 } });
    const worstReview = review({ grade: 'blunder', evLoss: 120 });

    const { best, worst } = highlightsOf([
      hand(1, [review()]),
      hand(2, [bestReview]),
      hand(3, [worstReview]),
    ]);

    expect(best).toEqual({ handNumber: 2, review: bestReview });
    expect(worst).toEqual({ handNumber: 3, review: worstReview });
  });

  it('tells identical decisions in different hands apart', () => {
    // Same fields, different hands: only the object identity says which is which.
    const first = review({ grade: 'mistake', evLoss: 40 });
    const second = review({ grade: 'mistake', evLoss: 40 });

    expect(highlightsOf([hand(4, [first]), hand(5, [second])]).worst?.handNumber).toBe(4);
  });

  it('has no costliest decision when nothing was really given up', () => {
    const { best, worst } = highlightsOf([hand(1, [review({ evLoss: 0.4 })])]);

    expect(best?.handNumber).toBe(1);
    expect(worst).toBeNull();
  });

  it('does not call a decision the coach graded correct the costliest one', () => {
    // Correct, yet a couple of chips behind the theoretical best line: a real
    // shape at low stakes, and not a mistake to show anyone.
    expect(highlightsOf([hand(1, [review({ grade: 'correct', evLoss: 2 })])]).worst).toBeNull();
  });

  it('has no highlights at all without a graded decision', () => {
    expect(highlightsOf([])).toEqual({ best: null, worst: null });
    expect(highlightsOf([hand(1, [])])).toEqual({ best: null, worst: null });
  });

  it('has no best decision when every decision was a mistake', () => {
    expect(highlightsOf([hand(1, [review({ grade: 'mistake', evLoss: 30 })])]).best).toBeNull();
  });
});

describe('tallyGrades', () => {
  it('counts every verdict across the session, zeroes included', () => {
    const counts = tallyGrades([
      hand(1, [review(), review()]),
      hand(2, [review({ grade: 'mistake', evLoss: 30 }), review({ grade: 'marginal', evLoss: 8 })]),
    ]);

    expect(counts).toEqual({ correct: 2, marginal: 1, mistake: 1, blunder: 0 });
  });
});

describe('describeDuration', () => {
  it('says how long a session ran the way a person would', () => {
    expect(describeDuration(20_000)).toBe('under a minute');
    expect(describeDuration(43 * 60_000)).toBe('43 min');
    expect(describeDuration(72 * 60_000)).toBe('1 h 12 min');
    expect(describeDuration(120 * 60_000)).toBe('2 h');
  });

  it('never reads as a negative duration', () => {
    expect(describeDuration(-1_000)).toBe('under a minute');
  });
});
