import {
  applyAction,
  createRng,
  legalActions,
  reviewHand,
  startHand,
  type Action,
  type HandState,
  type SeatIndex,
} from '@/engine';

import { createHandGrader, GRADE_ITERATIONS, tableConfigOf } from './grading';

const HERO_SEAT: SeatIndex = 0;

const SEATS = [
  { id: 'You', stack: 1_000 },
  { id: 'Ava', stack: 1_000 },
  { id: 'Ben', stack: 1_000 },
];

/**
 * A hand played out passively, so the hero has a decision on every street.
 *
 * A hand where the hero folds preflop has one verdict, which is not enough to
 * catch a chunked walk that grades in the wrong order.
 */
function playPassively(seed = 42): HandState {
  let hand = startHand(
    { seats: SEATS, button: 0, blinds: { smallBlind: 5, bigBlind: 10 }, handNumber: 1, seed },
    createRng(seed),
  );

  for (let step = 0; step < 200 && !hand.complete; step++) {
    hand = applyAction(hand, passive(hand));
  }

  return hand;
}

function passive(hand: HandState): Action {
  const legal = legalActions(hand);
  const action = legal.find((entry) => entry.type === 'check' || entry.type === 'call');

  if (!action) {
    throw new Error('A live hand must offer a check or a call.');
  }

  return { type: action.type };
}

function gradeFully(hand: HandState): ReturnType<typeof createHandGrader> {
  const grader = createHandGrader(hand, SEATS, HERO_SEAT);

  for (let step = 0; step < 100 && grader.step(); step++) {
    // One decision per step, exactly as the store's tick does it.
  }

  return grader;
}

describe('createHandGrader', () => {
  it('produces exactly what reviewHand produces', () => {
    // The whole reason the chunking is safe. `reviewDecision` draws from the Rng
    // it is handed, so this equality is the proof that the store's tick-by-tick
    // walk shares one generator and runs front to back.
    const hand = playPassively();

    expect(gradeFully(hand).reviews()).toEqual(
      reviewHand(tableConfigOf(hand, SEATS), hand.events, HERO_SEAT, {
        rng: createRng(hand.seed),
        iterations: GRADE_ITERATIONS,
      }),
    );
  });

  it('matches reviewHand across several different hands', () => {
    for (const seed of [1, 7, 20260728]) {
      const hand = playPassively(seed);

      expect(gradeFully(hand).reviews()).toEqual(
        reviewHand(tableConfigOf(hand, SEATS), hand.events, HERO_SEAT, {
          rng: createRng(hand.seed),
          iterations: GRADE_ITERATIONS,
        }),
      );
    }
  });

  it('grades one decision per step and nothing before the first', () => {
    const grader = createHandGrader(playPassively(), SEATS, HERO_SEAT);

    expect(grader.reviews()).toEqual([]);
    expect(grader.done()).toBe(false);
    expect(grader.step()).toBe(true);
    expect(grader.reviews()).toHaveLength(1);
  });

  it('reports done once, and refuses to grade past the end', () => {
    const grader = gradeFully(playPassively());
    const graded = grader.reviews().length;

    expect(graded).toBeGreaterThan(1);
    expect(grader.done()).toBe(true);
    expect(grader.step()).toBe(false);
    expect(grader.reviews()).toHaveLength(graded);
  });

  it('grades only the hero', () => {
    expect(
      gradeFully(playPassively())
        .reviews()
        .every((review) => review.seat === HERO_SEAT),
    ).toBe(true);
  });

  it('has nothing to grade for a seat that never acted', () => {
    const hand = playPassively();
    const grader = createHandGrader(hand, SEATS, 99);

    expect(grader.step()).toBe(false);
    expect(grader.done()).toBe(true);
    expect(grader.reviews()).toEqual([]);
  });
});
