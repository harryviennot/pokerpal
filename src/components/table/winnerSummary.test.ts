import {
  bestFive,
  evaluateHand,
  parseCards,
  type Card,
  type ReplaySeat,
  type TableSnapshot,
} from '@/engine';

import { winnerSummary, winningFive } from './winnerSummary';

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

function snapshot(seats: ReplaySeat[], complete = true): TableSnapshot {
  return {
    handNumber: 1,
    button: 0,
    street: 'river',
    board: [],
    seats,
    pot: 0,
    actor: null,
    complete,
  };
}

const board = parseCards('9h 4s 4d Ac Kd');
const nines = [...parseCards('9c 9d'), ...board];

describe('winnerSummary', () => {
  it('is silent while the hand is live', () => {
    expect(winnerSummary(snapshot([seat(0, 'Ava', { won: 100 })], false))).toBeNull();
  });

  it('names the hand a showdown was won with', () => {
    const winner = seat(0, 'Ava', { won: 240, shown: true, rank: evaluateHand(nines) });

    expect(winnerSummary(snapshot([winner, seat(1, 'Ben')]))).toBe('Ava wins with a full house');
  });

  it('keeps quiet about the cards when everyone folded', () => {
    expect(winnerSummary(snapshot([seat(0, 'Ava', { won: 15 }), seat(1, 'Ben')]))).toBe('Ava wins');
  });

  it('announces a split pot', () => {
    const rank = evaluateHand(nines);
    const seats = [
      seat(0, 'Ava', { won: 150, shown: true, rank }),
      seat(1, 'Ben', { won: 150, shown: true, rank }),
    ];

    expect(winnerSummary(snapshot(seats))).toBe('Ava and Ben split the pot');
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
