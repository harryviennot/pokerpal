import {
  type Action,
  type DecisionFacts,
  type DecisionReview,
  type Grade,
  type Leak,
  type Recommendation,
  type Street,
} from '@/engine';

import { type CoachLanguage } from './coachCopy';
import { explainRecommendation, explainReview } from './explain';

const FACTS: DecisionFacts = {
  street: 'flop',
  playersBehind: 1,
  pot: 120,
  toCall: 40,
  stack: 800,
  spr: 6.67,
  equity: 0.18,
  requiredEquity: 0.25,
  outs: 4,
};

function review(patch: Partial<DecisionReview> = {}): DecisionReview {
  return {
    seat: 0,
    action: { type: 'call' },
    best: { type: 'fold' },
    grade: 'blunder',
    evLoss: 60,
    reason: 'Called 33% of pot with 18% equity and 4 outs, needing 25%.',
    leak: 'chasingWithoutOdds',
    facts: FACTS,
    ...patch,
  };
}

const LANGUAGES: readonly CoachLanguage[] = ['plain', 'poker'];

const GRADES: readonly Grade[] = ['correct', 'marginal', 'mistake', 'blunder'];

const LEAKS: readonly (Leak | null)[] = [
  null,
  'preflopLooseness',
  'chasingWithoutOdds',
  'missedValue',
  'overBluffing',
  'positional',
];

const ACTIONS: readonly Action[] = [
  { type: 'fold' },
  { type: 'check' },
  { type: 'call' },
  { type: 'bet', to: 80 },
  { type: 'raise', to: 160 },
];

const STREETS: readonly Street[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];

describe('explainReview', () => {
  /**
   * The matrix, in one test. Any combination the engine can produce has to come
   * out as sentences in both registers — an empty string or a stray `NaN` on a
   * review screen is the failure mode this guards.
   */
  it('says something complete for every grade, habit, action and street', () => {
    for (const language of LANGUAGES) {
      for (const grade of GRADES) {
        for (const leak of LEAKS) {
          for (const action of ACTIONS) {
            for (const street of STREETS) {
              const explanation = explainReview(
                review({ grade, leak, action, facts: { ...FACTS, street } }),
                { language, bigBlind: 10 },
              );
              const sentences = [
                explanation.what,
                ...explanation.why,
                explanation.cost ?? '',
                explanation.instead ?? '',
              ];

              expect(explanation.what.length).toBeGreaterThan(0);
              expect(explanation.why.length).toBeGreaterThan(0);

              for (const sentence of sentences) {
                expect(sentence).not.toMatch(/NaN|undefined|Infinity/);
              }
            }
          }
        }
      }
    }
  });

  it('quotes the same figures in both registers', () => {
    const both = LANGUAGES.map((language) => explainReview(review(), { language, bigBlind: 10 }));

    // 18% equity, 25% needed, 6.0 big blinds given up — in either wording.
    for (const explanation of both) {
      const text = [explanation.what, ...explanation.why, explanation.cost].join(' ');

      expect(text).toContain('18%');
      expect(text).toContain('25%');
      expect(text).toContain('6.0');
    }
  });

  it('gives the plain register a friendlier form of the odds alongside the percentage', () => {
    const explanation = explainReview(review(), { language: 'plain', bigBlind: 10 });
    const why = explanation.why.join(' ');

    expect(why).toContain('1 time in 6');
    expect(why).toContain('18%');
    expect(why).toContain('1 time in 4');
  });

  it('uses the engine reason verbatim in the poker register', () => {
    const one = review();

    expect(explainReview(one, { language: 'poker' }).what).toBe(one.reason);
  });

  it('names no cost when the decision gave up nothing worth naming', () => {
    const explanation = explainReview(review({ grade: 'correct', evLoss: 0.4 }), {
      language: 'plain',
      bigBlind: 10,
    });

    expect(explanation.cost).toBeNull();
  });

  it('quotes the cost in chips when no blind is supplied', () => {
    const explanation = explainReview(review(), { language: 'plain' });

    expect(explanation.cost).toContain('60');
    expect(explanation.cost).not.toContain('big blinds');
  });

  it('suggests nothing when the move taken was the move the coach wanted', () => {
    const explanation = explainReview(review({ action: { type: 'fold' } }), {
      language: 'plain',
    });

    expect(explanation.instead).toBeNull();
  });

  /**
   * The coach's EV model has no opinion about sizing, so a raise graded against
   * a differently sized raise must not come back as "next time, raise".
   */
  it('treats a bet and a raise as the same move when suggesting an alternative', () => {
    const explanation = explainReview(
      review({ action: { type: 'raise', to: 160 }, best: { type: 'bet', to: 80 } }),
      { language: 'plain' },
    );

    expect(explanation.instead).toBeNull();
  });

  it('suggests the coach line when a different move was wanted', () => {
    const explanation = explainReview(review(), { language: 'plain' });

    expect(explanation.instead).toContain('give this one up');
  });

  it('does not claim a draw that is not there', () => {
    const explanation = explainReview(review({ facts: { ...FACTS, outs: 0 } }), {
      language: 'plain',
    });

    expect(explanation.why.join(' ')).not.toMatch(/cards left/);
  });

  it('reports a lone out in the singular', () => {
    const explanation = explainReview(review({ facts: { ...FACTS, outs: 1 } }), {
      language: 'plain',
    });

    expect(explanation.why.join(' ')).toContain('is 1 card');
  });

  it('says nothing about players behind when the hero closed the action', () => {
    const explanation = explainReview(review({ facts: { ...FACTS, playersBehind: 0 } }), {
      language: 'plain',
    });

    expect(explanation.why.join(' ')).not.toMatch(/had not spoken/);
  });

  it('invents no break-even price when there is nothing to call', () => {
    const explanation = explainReview(
      review({ action: { type: 'check' }, facts: { ...FACTS, toCall: 0, requiredEquity: 0 } }),
      { language: 'plain' },
    );

    expect(explanation.why.join(' ')).not.toMatch(/break even/);
  });
});

describe('explainRecommendation', () => {
  function recommendation(best: Action, facts: DecisionFacts = FACTS): Recommendation {
    return { seat: 0, best, lines: [{ action: best, ev: 1 }], facts };
  }

  it('leads with the move and its size', () => {
    expect(
      explainRecommendation(recommendation({ type: 'raise', to: 160 }), { language: 'poker' })
        .headline,
    ).toBe('Raise to 160');
  });

  it('names every move in both registers', () => {
    for (const language of LANGUAGES) {
      for (const action of ACTIONS) {
        const { headline, why } = explainRecommendation(recommendation(action), { language });

        expect(headline.length).toBeGreaterThan(0);
        expect(headline).not.toMatch(/NaN|undefined/);
        expect(why.length).toBeGreaterThan(0);
      }
    }
  });

  it('explains itself with the same reasoning the grade will use', () => {
    const facts = { ...FACTS, equity: 0.72 };

    expect(
      explainRecommendation(recommendation({ type: 'call' }, facts), { language: 'plain' }).why,
    ).toEqual(
      explainReview(review({ facts, action: { type: 'call' } }), { language: 'plain' }).why,
    );
  });

  it('does not put a poker word in the plain headline for a fold', () => {
    const { headline } = explainRecommendation(recommendation({ type: 'fold' }), {
      language: 'plain',
    });

    expect(headline.toLowerCase()).not.toContain('fold');
  });
});
