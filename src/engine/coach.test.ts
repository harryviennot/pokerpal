import { gradeHand, playHand, HERO_SEAT } from '@/fixtures/playedHand';

import { allCards, parseCards, type Card } from './cards';
import {
  decisionPoints,
  reviewDecision,
  reviewHand,
  type CoachOptions,
  type DecisionReview,
  type Grade,
} from './coach';
import { type HandEvent, type LoggedAction, type SeatIndex } from './events';
import { applyAction, dealHand, startHand } from './hand';
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

const coach = () => ({ rng: createRng(99), iterations: 3_000 });

/**
 * Deals a stated spot rather than hunting for one.
 *
 * Hole cards go round-robin from the seat left of the button, then a burn card
 * before each street, so a deck that produces a wanted hand has to be built in
 * that order rather than written out flat — which is exactly the mistake that
 * makes a stacked-deck test quietly grade the wrong hand.
 */
function stacked(
  hands: { hero: string; villain: string; other: string; board?: string },
  config: TableConfig = CONFIG,
): HandState {
  const hero = parseCards(hands.hero);
  const villain = parseCards(hands.villain);
  const other = parseCards(hands.other);
  const board = hands.board ? parseCards(hands.board) : [];

  // Deal order for a three-handed table with the button on seat 0 is 1, 2, 0.
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

  return dealHand(config, [...deck, ...spare]);
}

function play(state: HandState, script: readonly Action[]): HandState {
  return script.reduce((current, action) => applyAction(current, action), state);
}

describe('reviewDecision', () => {
  it('says nothing about a hand that is over', () => {
    const done = play(startHand(CONFIG, createRng(1)), [{ type: 'fold' }, { type: 'fold' }]);

    expect(reviewDecision(done, { type: 'fold' }, coach())).toBeNull();
  });

  it('grades a call with the odds as correct', () => {
    // Hero holds aces; the deal order is hero, villain, other, hero, villain...
    const state = stacked({ hero: 'As Ah', villain: 'Kd Kh', other: '7c 7d' });
    const review = reviewDecision(state, { type: 'call' }, coach());

    expect(review?.facts.equity).toBeGreaterThan(0.7);
    expect(review?.grade).toBe('correct');
    expect(review?.evLoss).toBe(0);
    expect(review?.leak).toBeNull();
  });

  it('treats folding a monster preflop as a serious error, not a rounding one', () => {
    const state = stacked({ hero: 'As Ah', villain: 'Kd Kh', other: '7c 7d' });
    const review = reviewDecision(state, { type: 'fold' }, coach());

    // On showdown-only EV this is worth under a blind, which is exactly why
    // severity is weighted by the betting still to come. The claim here is the
    // one that survives that weighting changing: it is not a small mistake.
    expect(['mistake', 'blunder']).toContain(review?.grade);
    expect(review?.evLoss).toBeGreaterThan(2 * CONFIG.blinds.bigBlind);
    expect(review?.best.type).not.toBe('fold');
  });

  it('weights the same error more heavily the earlier it is made', () => {
    const hands = { hero: 'As Ah', villain: 'Kd Kh', other: '7c 7d', board: '2c 5d 9s' } as const;
    const preflop = reviewDecision(stacked(hands), { type: 'fold' }, coach());
    const flop = reviewDecision(
      play(stacked(hands), [
        { type: 'call' },
        { type: 'call' },
        { type: 'check' },
        { type: 'check' },
        { type: 'bet', to: 20 },
      ]),
      { type: 'fold' },
      coach(),
    );

    expect(preflop?.facts.street).toBe('preflop');
    expect(flop?.facts.street).toBe('flop');
    expect(preflop?.evLoss).toBeGreaterThan(0);
    expect(flop?.evLoss).toBeGreaterThan(0);
  });

  it('reports the price and the equity in the terms a player reads', () => {
    const state = stacked({ hero: 'As Ah', villain: 'Kd Kh', other: '7c 7d' });
    const review = reviewDecision(state, { type: 'call' }, coach());

    expect(review?.reason).toMatch(/^Called \d+% of pot with \d+% equity/);
    expect(review?.reason).toMatch(/needing \d+%/);
  });

  it('measures the pot odds it is grading against', () => {
    const state = stacked({ hero: 'As Ah', villain: 'Kd Kh', other: '7c 7d' });
    const review = reviewDecision(state, { type: 'call' }, coach());

    // Hero is on the button, which posts nothing: 10 to call into 15.
    expect(review?.facts.toCall).toBe(10);
    expect(review?.facts.pot).toBe(15);
    expect(review?.facts.requiredEquity).toBeCloseTo(10 / 25, 5);
    expect(review?.facts.spr).toBeCloseTo(1000 / 15, 2);
  });

  it('tags chasing without the odds', () => {
    // Hero holds seven-deuce; villain and the board give hero almost nothing.
    const preflop = stacked({
      hero: '7c 2d',
      villain: 'As Ad',
      other: 'Kd Kh',
      board: 'Ah 9s 3c',
    });
    const flop = play(preflop, [
      { type: 'call' },
      { type: 'call' },
      { type: 'check' },
      { type: 'check' },
      { type: 'bet', to: 200 },
    ]);
    const review = reviewDecision(flop, { type: 'call' }, coach());

    expect(review?.facts.equity).toBeLessThan(review?.facts.requiredEquity ?? 1);
    expect(review?.grade).not.toBe('correct');
    expect(review?.leak).toBe('chasingWithoutOdds');
  });

  it('counts the outs of a live draw in what it reports', () => {
    // Hero holds two hearts and the flop brings two more.
    const preflop = stacked({
      hero: 'Ah Kh',
      villain: '7c 2d',
      other: 'Qs Js',
      board: '9h 3h 2c',
    });
    const flop = play(preflop, [
      { type: 'call' },
      { type: 'call' },
      { type: 'check' },
      { type: 'check' },
    ]);

    const review = reviewDecision(flop, { type: 'check' }, coach());

    expect(review?.facts.street).toBe('flop');
    expect(review?.reason).toMatch(/no draw|\d+ outs/);
  });

  it('never reports a negative loss', () => {
    const state = stacked({ hero: 'As Ah', villain: 'Kd Kh', other: '7c 7d' });

    for (const action of [{ type: 'fold' }, { type: 'call' }] as const) {
      expect(reviewDecision(state, action, coach())?.evLoss).toBeGreaterThanOrEqual(0);
    }
  });

  it('grades the same decision the same way twice', () => {
    const state = stacked({ hero: 'As Ah', villain: 'Kd Kh', other: '7c 7d' });
    const first = reviewDecision(state, { type: 'call' }, { rng: createRng(4), iterations: 500 });
    const second = reviewDecision(state, { type: 'call' }, { rng: createRng(4), iterations: 500 });

    expect(second).toEqual(first);
  });
});

describe('reviewHand', () => {
  it('grades every decision the seat made and no others', () => {
    const played = play(startHand(CONFIG, createRng(8)), [
      { type: 'call' },
      { type: 'call' },
      { type: 'check' },
      { type: 'check' },
      { type: 'check' },
      { type: 'bet', to: 40 },
      { type: 'fold' },
      { type: 'fold' },
    ]);

    const reviews = reviewHand(CONFIG, played.events, 0, coach());

    expect(reviews.length).toBeGreaterThan(0);
    expect(reviews.every((review) => review.seat === 0)).toBe(true);
    expect(reviews.every((review) => GRADES.includes(review.grade))).toBe(true);
  });

  it('grades against the state the player actually faced', () => {
    const played = play(startHand(CONFIG, createRng(8)), [
      { type: 'call' },
      { type: 'call' },
      { type: 'check' },
    ]);
    const reviews = reviewHand(CONFIG, played.events, 0, coach());
    const first = reviews[0];

    // Hero's first decision was preflop, on the button, facing the big blind.
    expect(first?.facts.street).toBe('preflop');
    expect(first?.facts.toCall).toBe(10);
  });

  it('returns nothing for a log with no opening event', () => {
    expect(reviewHand(CONFIG, [], 0, coach())).toEqual([]);
  });

  it('returns nothing for a seat that never acted', () => {
    const played = play(startHand(CONFIG, createRng(8)), [{ type: 'fold' }, { type: 'fold' }]);

    expect(reviewHand(CONFIG, played.events, 2, coach())).toEqual([]);
  });
});

describe('decisionPoints', () => {
  it('returns every state the seat faced, in the order they faced them', () => {
    const played = playHand();
    const points = decisionPoints(FIXTURE_CONFIG, played.events, HERO_SEAT);

    // The fixture checks and calls to showdown, so hero acts once per street.
    expect(points.map((point) => point.state.street)).toEqual(['preflop', 'flop', 'turn', 'river']);
    expect(points.map((point) => point.action.type)).toEqual(['call', 'check', 'check', 'check']);
    expect(points.every((point) => point.state.toAct === HERO_SEAT)).toBe(true);
  });

  it('is empty for a seat that never acted, and for a log with no opening event', () => {
    const played = play(startHand(CONFIG, createRng(8)), [{ type: 'fold' }, { type: 'fold' }]);

    expect(decisionPoints(CONFIG, played.events, 2)).toEqual([]);
    expect(decisionPoints(CONFIG, [], 0)).toEqual([]);
  });

  it('grades the same way one point at a time as reviewHand does in one pass', () => {
    // The contract the store leans on: it walks these front to back, one per
    // event-loop tick, sharing a single Rng. Any other order is other verdicts.
    const played = playHand();
    // One Rng for the whole walk, not one per point: the samples a decision draws
    // depend on how many were drawn before it, so a fresh Rng per tick is a
    // different coach, not a chunked one.
    const shared = FIXTURE_COACH();
    const chunked = decisionPoints(FIXTURE_CONFIG, played.events, HERO_SEAT).flatMap((point) => {
      const review = reviewDecision(point.state, point.action, shared);

      return review ? [review] : [];
    });

    expect(chunked).toEqual(reviewHand(FIXTURE_CONFIG, played.events, HERO_SEAT, FIXTURE_COACH()));
  });
});

describe('reviewHand after the decisionPoints extraction', () => {
  it('returns exactly what the single-pass implementation returned', () => {
    const played = playHand();

    expect(reviewHand(FIXTURE_CONFIG, played.events, HERO_SEAT, FIXTURE_COACH())).toEqual(
      singlePassReviewHand(FIXTURE_CONFIG, played.events, HERO_SEAT, FIXTURE_COACH()),
    );
  });

  it('still produces the verdicts captured before the extraction', () => {
    // Captured by running the pre-extraction code against this fixture. The
    // equities are the load-bearing part: they come off the shared Rng, so they
    // pin the order the decisions were graded in, which is the one thing the
    // extraction could have changed and the shape of the result cannot show.
    expect(
      gradeHand(playHand()).map((review) => [
        review.facts.street,
        review.action.type,
        review.grade,
        review.evLoss,
        review.facts.equity,
      ]),
    ).toEqual([
      ['preflop', 'call', 'correct', 0, 0.4666666666666666],
      ['flop', 'check', 'correct', 0, 0.42],
      ['turn', 'check', 'correct', 0, 0.17],
      ['river', 'check', 'correct', 0, 0.04],
    ]);
  });
});

/** The table `@/fixtures/playedHand` deals from, so a review can be re-run here. */
const FIXTURE_CONFIG: TableConfig = {
  seats: [
    { id: 'You', stack: 1000 },
    { id: 'Ava', stack: 1000 },
    { id: 'Ben', stack: 1000 },
  ],
  button: 0,
  blinds: { smallBlind: 5, bigBlind: 10 },
  handNumber: 1,
  seed: 42,
};

/** The fixture's own sampling: light, and a fresh Rng so runs are comparable. */
const FIXTURE_COACH = (): CoachOptions => ({ iterations: 50, rng: createRng(42) });

/**
 * `reviewHand` as it stood before `decisionPoints` was extracted: one pass over
 * the log, grading in place.
 *
 * Kept here so the extraction has something to be equal to. The risk it guards
 * is invisible in the result's shape — `reviewDecision` draws from the shared
 * Rng, so collecting the states first and grading them afterwards is only safe
 * while the grading order is unchanged.
 */
function singlePassReviewHand(
  config: TableConfig,
  events: readonly HandEvent[],
  seat: SeatIndex,
  options: CoachOptions,
): DecisionReview[] {
  const opening = events.find((event) => event.type === 'handStart');

  if (!opening || opening.type !== 'handStart') {
    return [];
  }

  const reviews: DecisionReview[] = [];
  let state = dealHand(config, opening.deck);

  for (const event of events) {
    if (event.type !== 'actionTaken') {
      continue;
    }

    const action = loggedToAction(event.action);

    if (event.seat === seat) {
      const review = reviewDecision(state, action, options);

      if (review) {
        reviews.push(review);
      }
    }

    state = applyAction(state, action);
  }

  return reviews;
}

function loggedToAction(logged: LoggedAction): Action {
  switch (logged.type) {
    case 'bet':
      return { type: 'bet', to: logged.to };
    case 'raise':
      return { type: 'raise', to: logged.to };
    case 'call':
      return { type: 'call' };
    case 'check':
      return { type: 'check' };
    default:
      return { type: 'fold' };
  }
}

const GRADES: readonly Grade[] = ['correct', 'marginal', 'mistake', 'blunder'];
