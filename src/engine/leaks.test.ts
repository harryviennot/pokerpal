import { type DecisionFacts, type DecisionReview } from './coach';
import { bestDecision, costliestDecision, summarizeSession, tallyLeaks, topLeaks } from './leaks';

const FACTS: DecisionFacts = {
  street: 'flop',
  playersBehind: 0,
  pot: 100,
  toCall: 25,
  stack: 900,
  spr: 9,
  equity: 0.3,
  requiredEquity: 0.2,
  outs: 0,
};

/** A review fixture. Aggregation only reads grade, evLoss, leak and facts.pot. */
function review(overrides: Partial<DecisionReview> = {}): DecisionReview {
  return {
    seat: 0,
    action: { type: 'call' },
    best: { type: 'call' },
    grade: 'correct',
    evLoss: 0,
    reason: 'Called.',
    leak: null,
    facts: FACTS,
    ...overrides,
  };
}

describe('tallyLeaks', () => {
  it('groups by leak, counting decisions and summing the chips they gave up', () => {
    const tallies = tallyLeaks([
      review({ leak: 'chasingWithoutOdds', evLoss: 30, grade: 'mistake' }),
      review({ leak: 'chasingWithoutOdds', evLoss: 20, grade: 'mistake' }),
      review({ leak: 'missedValue', evLoss: 10, grade: 'marginal' }),
    ]);

    expect(tallies).toEqual([
      { leak: 'chasingWithoutOdds', count: 2, evLoss: 50 },
      { leak: 'missedValue', count: 1, evLoss: 10 },
    ]);
  });

  it('sorts by chips lost, not by how often the leak showed up', () => {
    const tallies = tallyLeaks([
      review({ leak: 'preflopLooseness', evLoss: 5, grade: 'marginal' }),
      review({ leak: 'preflopLooseness', evLoss: 5, grade: 'marginal' }),
      review({ leak: 'preflopLooseness', evLoss: 5, grade: 'marginal' }),
      review({ leak: 'overBluffing', evLoss: 100, grade: 'blunder' }),
    ]);

    expect(tallies.map((tally) => tally.leak)).toEqual(['overBluffing', 'preflopLooseness']);
  });

  it('ignores decisions that were not evidence of a leak', () => {
    expect(tallyLeaks([review(), review({ grade: 'marginal', evLoss: 3 })])).toEqual([]);
  });

  it('returns nothing for no decisions', () => {
    expect(tallyLeaks([])).toEqual([]);
  });
});

describe('topLeaks', () => {
  const reviews = [
    review({ leak: 'preflopLooseness', evLoss: 40, grade: 'mistake' }),
    review({ leak: 'chasingWithoutOdds', evLoss: 30, grade: 'mistake' }),
    review({ leak: 'missedValue', evLoss: 20, grade: 'mistake' }),
    review({ leak: 'overBluffing', evLoss: 10, grade: 'marginal' }),
  ];

  it('keeps the three costliest', () => {
    expect(topLeaks(reviews).map((tally) => tally.leak)).toEqual([
      'preflopLooseness',
      'chasingWithoutOdds',
      'missedValue',
    ]);
  });

  it('returns fewer when fewer exist', () => {
    expect(topLeaks(reviews.slice(0, 2))).toHaveLength(2);
    expect(topLeaks([])).toEqual([]);
  });
});

describe('costliestDecision', () => {
  it('finds the decision that gave up the most', () => {
    const worst = review({ evLoss: 80, grade: 'blunder' });

    expect(costliestDecision([review({ evLoss: 5 }), worst, review()])).toBe(worst);
  });

  it('returns null for no decisions', () => {
    expect(costliestDecision([])).toBeNull();
  });
});

describe('bestDecision', () => {
  it('finds the correct decision made for the biggest pot', () => {
    const big = review({ facts: { ...FACTS, pot: 400 } });

    expect(
      bestDecision([
        review({ facts: { ...FACTS, pot: 50 } }),
        big,
        // A bigger pot still, but the decision in it was wrong.
        review({ grade: 'blunder', evLoss: 60, facts: { ...FACTS, pot: 900 } }),
      ]),
    ).toBe(big);
  });

  it('returns null when nothing was done correctly', () => {
    expect(bestDecision([review({ grade: 'mistake', evLoss: 20 })])).toBeNull();
    expect(bestDecision([])).toBeNull();
  });
});

describe('summarizeSession', () => {
  it('adds up a session', () => {
    const summary = summarizeSession([
      {
        net: 120,
        reviews: [review(), review({ leak: 'missedValue', evLoss: 15, grade: 'mistake' })],
      },
      { net: -45, reviews: [review({ leak: 'chasingWithoutOdds', evLoss: 30, grade: 'mistake' })] },
      { net: -80, reviews: [] },
    ]);

    expect(summary).toEqual({
      handsPlayed: 3,
      net: -5,
      biggestWin: 120,
      biggestLoss: -80,
      decisionsGraded: 3,
      focus: 'chasingWithoutOdds',
    });
  });

  it('reports zeros and no focus before anything has happened', () => {
    expect(summarizeSession([])).toEqual({
      handsPlayed: 0,
      net: 0,
      biggestWin: 0,
      biggestLoss: 0,
      decisionsGraded: 0,
      focus: null,
    });
  });

  it('has no focus when no decision leaked', () => {
    expect(summarizeSession([{ net: 10, reviews: [review()] }]).focus).toBeNull();
  });

  it('leaves wins and losses at zero when the session only went one way', () => {
    const summary = summarizeSession([
      { net: 30, reviews: [] },
      { net: 70, reviews: [] },
    ]);

    expect(summary.biggestWin).toBe(70);
    expect(summary.biggestLoss).toBe(0);
  });
});
