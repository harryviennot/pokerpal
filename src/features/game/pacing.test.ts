import {
  applyAction,
  createRng,
  HandCategory,
  MANIAC,
  parseCard,
  ROCK,
  SHARK,
  startHand,
  type BotProfile,
  type HandEvent,
  type HandState,
  type SeatIndex,
} from '@/engine';

import {
  AUTO_NEXT_HAND_MS,
  AUTO_NEXT_SHOWDOWN_MS,
  DECISION_CLOCK_MS,
  LEVEL_LENGTH_MS,
  nextHandDelayFor,
  PRESELECT_BEAT_MS,
  revealDelayFor,
  thinkDelayFor,
} from './pacing';

const CONFIG = {
  seats: [
    { id: 'You', stack: 1_000 },
    { id: 'Ava', stack: 1_000 },
    { id: 'Ben', stack: 1_000 },
  ],
  button: 0,
  blinds: { smallBlind: 5, bigBlind: 10 },
  handNumber: 1,
  seed: 7,
};

/** Preflop, facing the big blind: a fold-or-play spot, and nothing more. */
function ordinarySpot(): HandState {
  return startHand(CONFIG, createRng(7));
}

/** Preflop, facing half a stack: the shape of a decision worth pausing on. */
function bigSpot(): HandState {
  return applyAction(ordinarySpot(), { type: 'raise', to: 500 });
}

function seatOf(hand: HandState): SeatIndex {
  if (hand.toAct === null) {
    throw new Error('The fixture must be waiting on a seat.');
  }

  return hand.toAct;
}

function delays(profile: BotProfile | null, hand: HandState, count: number): number[] {
  return Array.from({ length: count }, (_, seed) =>
    thinkDelayFor(profile, hand, seatOf(hand), createRng(seed)),
  );
}

describe('thinkDelayFor', () => {
  it('stays inside 500 to 7 000 ms for every archetype and spot', () => {
    for (const profile of [ROCK, MANIAC, SHARK, null]) {
      for (const hand of [ordinarySpot(), bigSpot()]) {
        for (const delay of delays(profile, hand, 200)) {
          expect(delay).toBeGreaterThanOrEqual(500);
          expect(delay).toBeLessThanOrEqual(7_000);
          expect(Number.isInteger(delay)).toBe(true);
        }
      }
    }
  });

  it('keeps an unflavoured ordinary decision in the 800 to 2 600 ms band', () => {
    for (const delay of delays(null, ordinarySpot(), 200)) {
      expect(delay).toBeGreaterThanOrEqual(800);
      expect(delay).toBeLessThanOrEqual(2_600);
    }
  });

  it('is the same number twice for the same seed', () => {
    const hand = ordinarySpot();
    const seat = seatOf(hand);

    expect(thinkDelayFor(ROCK, hand, seat, createRng(99))).toBe(
      thinkDelayFor(ROCK, hand, seat, createRng(99)),
    );
  });

  it('draws the same amount from the stream whichever branch it takes', () => {
    // A fixed cost per decision keeps the pacing stream aligned across a session
    // however the hands play out, so a seeded test of the pump stays stable.
    const spend = (hand: HandState): number => {
      const rng = createRng(3);

      thinkDelayFor(ROCK, hand, seatOf(hand), rng);

      return rng.nextUint32();
    };

    expect(spend(ordinarySpot())).toBe(spend(bigSpot()));
  });

  it('has a maniac snap where a rock deliberates, on the same spot', () => {
    const hand = ordinarySpot();
    const maniac = delays(MANIAC, hand, 60);
    const rock = delays(ROCK, hand, 60);

    maniac.forEach((fast, index) => expect(fast).toBeLessThan(rock[index] ?? 0));
    expect(mean(maniac)).toBeLessThan(1_500);
    expect(mean(rock)).toBeGreaterThan(mean(maniac));
  });

  it('has a shark deliberate at least as long as a maniac', () => {
    const hand = ordinarySpot();

    expect(mean(delays(SHARK, hand, 60))).toBeGreaterThan(mean(delays(MANIAC, hand, 60)));
  });

  it('takes a long look at a big decision sometimes, and not always', () => {
    const long = delays(ROCK, bigSpot(), 200).filter((delay) => delay >= 4_000);

    expect(long.length).toBeGreaterThan(0);
    expect(long.length).toBeLessThan(200);
    long.forEach((delay) => expect(delay).toBeLessThanOrEqual(7_000));
  });

  it('never takes a long look at an ordinary one', () => {
    delays(ROCK, ordinarySpot(), 200).forEach((delay) => expect(delay).toBeLessThan(4_000));
  });

  it('treats a seat that is not at the table as no decision at all', () => {
    const hand = ordinarySpot();

    expect(thinkDelayFor(ROCK, hand, 99, createRng(1))).toBeLessThan(4_000);
  });
});

const ACE = parseCard('As');
const KING = parseCard('Kd');

describe('revealDelayFor', () => {
  it('holds a street and a pot longer than a chip going in', () => {
    const street: HandEvent = { type: 'streetDealt', street: 'flop', cards: [], burned: ACE };
    const action: HandEvent = {
      type: 'actionTaken',
      seat: 1,
      action: { type: 'check' },
      allIn: false,
    };
    const pot: HandEvent = {
      type: 'potAwarded',
      seat: 1,
      amount: 30,
      potIndex: 0,
      oddChip: false,
    };

    expect(revealDelayFor(street)).toBe(900);
    expect(revealDelayFor(action)).toBe(250);
    expect(revealDelayFor(pot)).toBe(600);
  });

  it('deals the table in quickly and holds each revealed hand over a second', () => {
    expect(
      revealDelayFor({ type: 'blindPosted', seat: 1, kind: 'bigBlind', amount: 10, allIn: false }),
    ).toBe(120);
    expect(revealDelayFor({ type: 'holeCardsDealt', seat: 1, cards: [ACE, KING] })).toBe(120);
    expect(
      revealDelayFor({
        type: 'showdownHand',
        seat: 1,
        cards: [ACE, KING],
        rank: { category: HandCategory.HighCard, value: 0, ranks: [] },
      }),
    ).toBe(1_100);
  });

  it('costs nothing to open the log', () => {
    expect(revealDelayFor({ type: 'handStart', handNumber: 1, seed: 1, button: 0, deck: [] })).toBe(
      0,
    );
  });
});

describe('pacing constants', () => {
  it('gives the player a beat to read the result, and a clock they can beat', () => {
    expect(AUTO_NEXT_HAND_MS).toBe(4_000);
    expect(AUTO_NEXT_SHOWDOWN_MS).toBe(8_000);
    expect(PRESELECT_BEAT_MS).toBe(400);
    expect(DECISION_CLOCK_MS).toBe(20_000);
    expect(LEVEL_LENGTH_MS).toBe(180_000);
  });
});

describe('nextHandDelayFor', () => {
  it('lingers twice as long on a showdown as on a hand everyone folded', () => {
    // Two folds end the hand with no cards shown; check-down to the river shows
    // them. The linger is what gives revealed hands time to be read.
    const folded = play(ordinarySpot(), [{ type: 'fold' }, { type: 'fold' }]);
    const shown = play(ordinarySpot(), [
      { type: 'call' },
      { type: 'call' },
      { type: 'check' },
      { type: 'check' },
      { type: 'check' },
      { type: 'check' },
      { type: 'check' },
      { type: 'check' },
      { type: 'check' },
      { type: 'check' },
      { type: 'check' },
      { type: 'check' },
    ]);

    expect(folded.complete).toBe(true);
    expect(shown.complete).toBe(true);
    expect(shown.events.some((event) => event.type === 'showdownHand')).toBe(true);
    expect(nextHandDelayFor(folded.events)).toBe(AUTO_NEXT_HAND_MS);
    expect(nextHandDelayFor(shown.events)).toBe(AUTO_NEXT_SHOWDOWN_MS);
  });
});

function play(state: HandState, script: readonly Parameters<typeof applyAction>[1][]): HandState {
  return script.reduce((current, action) => applyAction(current, action), state);
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
