import {
  bestFive,
  evaluateHand,
  parseCards,
  type Card,
  type ReplaySeat,
  type TableSnapshot,
} from '@/engine';

import { madeHandLabel, winnerSummary, winningFive } from './winnerSummary';

function seat(index: number, id: string, overrides: Partial<ReplaySeat> = {}): ReplaySeat {
  return {
    seat: index,
    id,
    stack: 1000,
    bet: 0,
    status: 'active',
    holeCards: null,
    shown: false,
    mucked: false,
    won: 0,
    rank: null,
    bestFive: null,
    ...overrides,
  };
}

function snapshot(
  seats: ReplaySeat[],
  complete = true,
  overrides: Partial<TableSnapshot> = {},
): TableSnapshot {
  return {
    handNumber: 1,
    button: 0,
    street: 'river',
    board: [],
    seats,
    pot: 0,
    actor: null,
    complete,
    ...overrides,
  };
}

const board = parseCards('9h 4s 4d Ac Kd');
const nines = [...parseCards('9c 9d'), ...board];
const hole = (notation: string): readonly [Card, Card] =>
  parseCards(notation) as unknown as readonly [Card, Card];

describe('winnerSummary', () => {
  it('is silent while the hand is live', () => {
    expect(winnerSummary(snapshot([seat(0, 'Ava', { won: 100 })], false))).toBeNull();
  });

  it('names the winner and leaves the cards to their own plate', () => {
    const winner = seat(0, 'Ava', { won: 240, shown: true, rank: evaluateHand(nines) });

    expect(winnerSummary(snapshot([winner, seat(1, 'Ben')]))).toBe('Ava wins the hand');
  });

  it('says the same thing when everyone folded', () => {
    expect(winnerSummary(snapshot([seat(0, 'Ava', { won: 15 }), seat(1, 'Ben')]))).toBe(
      'Ava wins the hand',
    );
  });

  it('conjugates for the hero, whose seat is named You', () => {
    expect(winnerSummary(snapshot([seat(0, 'You', { won: 15 }), seat(1, 'Ben')]))).toBe(
      'You win the hand',
    );
  });

  it('announces a split pot', () => {
    const rank = evaluateHand(nines);
    const seats = [
      seat(0, 'Ava', { won: 150, shown: true, rank }),
      seat(1, 'Ben', { won: 150, shown: true, rank }),
    ];

    expect(winnerSummary(snapshot(seats))).toBe('Ava and Ben split the pot');
  });

  it('lists three winners without a comma before the last', () => {
    const seats = [0, 1, 2].map((index) =>
      seat(index, ['Ava', 'Ben', 'Cass'][index] ?? '', { won: 100 }),
    );

    expect(winnerSummary(snapshot(seats))).toBe('Ava, Ben and Cass split the pot');
  });
});

describe('madeHandLabel', () => {
  it('names the hero their live hand while the hand runs', () => {
    const hero = seat(0, 'You', { holeCards: hole('9c 9d') });
    const live = snapshot([hero], false, { board: parseCards('9h 4s 4d') });

    expect(madeHandLabel(hero, live, true)).toBe('Nines full of fours');
  });

  it('says nothing about an opponent whose cards are still face down', () => {
    const villain = seat(1, 'Ava', { holeCards: hole('9c 9d') });

    expect(madeHandLabel(villain, snapshot([villain], false), false)).toBeNull();
  });

  it('names the category of anybody who showed down, reference-style', () => {
    const shown = seat(1, 'Ava', {
      holeCards: hole('9c 9d'),
      shown: true,
      rank: evaluateHand(nines),
    });

    // "Full house", not "Nines full of fours": the long form belongs to the
    // coach, and the reference's plates carry the category alone.
    expect(madeHandLabel(shown, snapshot([shown]), false)).toBe('Full house');
  });

  it('goes quiet on a seat that folded, sat out or mucked', () => {
    const live = snapshot([], false);

    expect(madeHandLabel(seat(0, 'Ava', { status: 'folded' }), live, true)).toBeNull();
    expect(madeHandLabel(seat(0, 'Ava', { status: 'sittingOut' }), live, true)).toBeNull();
    expect(
      madeHandLabel(seat(0, 'Ava', { mucked: true, holeCards: hole('9c 9d') }), live, true),
    ).toBeNull();
  });

  it('stops naming the hero their live hand once the hand is over', () => {
    const hero = seat(0, 'You', { holeCards: hole('9c 9d') });

    expect(madeHandLabel(hero, snapshot([hero], true), true)).toBeNull();
  });
});

describe('winningFive', () => {
  it('collects the cards of every winning shown hand', () => {
    const five = bestFive(nines);
    const seats = [
      seat(0, 'Ava', { won: 240, shown: true, bestFive: five }),
      seat(1, 'Ben', { shown: true, bestFive: bestFive([...parseCards('Qs Qh'), ...board]) }),
    ];
    const winning = winningFive(snapshot(seats));

    expect(winning.size).toBe(5);

    for (const card of five) {
      expect(winning.has(card as Card)).toBe(true);
    }
  });

  it('is empty for a live hand, a fold-out or a legacy log', () => {
    expect(winningFive(snapshot([seat(0, 'Ava', { won: 100 })], false)).size).toBe(0);
    expect(winningFive(snapshot([seat(0, 'Ava', { won: 100 })])).size).toBe(0);
    expect(
      winningFive(snapshot([seat(0, 'Ava', { won: 100, shown: true, bestFive: null })])).size,
    ).toBe(0);
  });
});
