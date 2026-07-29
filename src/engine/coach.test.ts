import { allCards, parseCards, type Card } from './cards';
import { reviewDecision, reviewHand, type Grade } from './coach';
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

const GRADES: readonly Grade[] = ['correct', 'marginal', 'mistake', 'blunder'];
