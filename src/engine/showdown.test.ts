import { parseCards, type Card } from './cards';
import { HandCategory } from './evaluator';
import { resolveShowdown } from './showdown';
import { type Player, type Pot } from './table';

function seat(index: number, cards: string, status: Player['status'] = 'active'): Player {
  const [first, second] = parseCards(cards) as [Card, Card];

  return {
    seat: index,
    id: `p${index}`,
    stack: 0,
    holeCards: [first, second],
    status,
    committedThisStreet: 0,
    committedTotal: 0,
    hasActedThisStreet: true,
    mayRaiseThisStreet: false,
  };
}

const pot = (amount: number, eligible: number[]): Pot => ({ amount, eligible });

describe('resolveShowdown', () => {
  it('gives the pot to the best hand', () => {
    const board = parseCards('Ah Kd 7c 2s 9h');
    const players = [seat(0, 'As Kc'), seat(1, 'Qh Qd')];

    const { awards } = resolveShowdown(players, [pot(600, [0, 1])], board, 0, 0);

    expect(awards).toEqual([{ seat: 0, amount: 600, potIndex: 0, oddChip: false }]);
  });

  it('splits a pot between two identical hands', () => {
    // Both play the same two pair with the same ace kicker; suits are not ranked.
    const board = parseCards('Ah Kd 7c 2s 9h');
    const players = [seat(0, 'Ac Kh'), seat(1, 'As Ks')];

    const { awards } = resolveShowdown(players, [pot(600, [0, 1])], board, 0, 0);

    expect(awards).toEqual([
      { seat: 1, amount: 300, potIndex: 0, oddChip: false },
      { seat: 0, amount: 300, potIndex: 0, oddChip: false },
    ]);
  });

  it('chops a pot every way when the board plays', () => {
    // Broadway on the board: nobody can beat it, nobody can improve on it.
    const board = parseCards('Ah Kh Qs Jd Tc');
    const players = [seat(0, '2c 3d'), seat(1, '4h 5s'), seat(2, '6c 7d')];

    const { awards, entries } = resolveShowdown(players, [pot(300, [0, 1, 2])], board, 0, 0);

    expect(awards.map((award) => award.amount)).toEqual([100, 100, 100]);
    expect(entries.every((entry) => entry.rank.category === HandCategory.Straight)).toBe(true);
  });

  it('sends an odd chip clockwise from the button when a pot cannot be split evenly', () => {
    const board = parseCards('Ah Kh Qs Jd Tc');
    const players = [seat(0, '2c 3d'), seat(1, '4h 5s'), seat(2, '6c 7d')];

    // Button on seat 2, so seat 0 is first in line for the spare chip.
    const { awards } = resolveShowdown(players, [pot(302, [0, 1, 2])], board, 2, 0);

    expect(awards).toEqual([
      { seat: 0, amount: 101, potIndex: 0, oddChip: true },
      { seat: 1, amount: 101, potIndex: 0, oddChip: true },
      { seat: 2, amount: 100, potIndex: 0, oddChip: false },
    ]);
  });

  it('awards a side pot to a different player than the main pot', () => {
    // Seat 0 is all in for the main pot with the best hand; seats 1 and 2 keep
    // betting into a side pot that seat 0 cannot win.
    const board = parseCards('Ah 7d 2c 9s 4h');
    const players = [seat(0, 'As Ad', 'allIn'), seat(1, '7h 7c'), seat(2, '9h 9d')];

    const { awards } = resolveShowdown(
      players,
      [pot(300, [0, 1, 2]), pot(400, [1, 2])],
      board,
      0,
      1,
    );

    expect(awards).toEqual([
      { seat: 0, amount: 300, potIndex: 0, oddChip: false }, // trip aces
      { seat: 2, amount: 400, potIndex: 1, oddChip: false }, // trip nines beat trip sevens
    ]);
  });

  it('lets a short all-in win only the main pot it could reach', () => {
    const board = parseCards('Kh Qd 5c 3s 2h');
    const players = [seat(0, 'Kd Kc', 'allIn'), seat(1, 'Qh Qs'), seat(2, '9c 8d')];

    const { awards } = resolveShowdown(
      players,
      [pot(150, [0, 1, 2]), pot(600, [1, 2])],
      board,
      0,
      1,
    );

    expect(awards).toContainEqual({ seat: 0, amount: 150, potIndex: 0, oddChip: false });
    expect(awards).toContainEqual({ seat: 1, amount: 600, potIndex: 1, oddChip: false });
  });

  it('ignores folded players even when they held the best hand', () => {
    const board = parseCards('Ah Kd 7c 2s 9h');
    const players = [seat(0, 'As Ac', 'folded'), seat(1, 'Kh Ks')];

    const { awards, entries } = resolveShowdown(players, [pot(400, [1])], board, 0, 1);

    expect(awards).toEqual([{ seat: 1, amount: 400, potIndex: 0, oddChip: false }]);
    expect(entries.map((entry) => entry.seat)).toEqual([1]);
  });
});

describe('reveal order and mucking', () => {
  const board = parseCards('Ah Kd 7c 2s 9h');

  it('shows the last aggressor first, then clockwise', () => {
    const players = [seat(0, '3c 3d'), seat(1, '4h 4s'), seat(2, '5c 5d')];

    const { entries } = resolveShowdown(players, [pot(300, [0, 1, 2])], board, 0, 2);

    expect(entries.map((entry) => entry.seat)).toEqual([2, 0, 1]);
  });

  it('mucks a hand that cannot beat what has already been shown', () => {
    const players = [seat(0, 'As Ac'), seat(1, '3h 4s'), seat(2, '5c 6d')];

    const { entries } = resolveShowdown(players, [pot(300, [0, 1, 2])], board, 0, 0);

    expect(entries.map((entry) => [entry.seat, entry.mucked])).toEqual([
      [0, false],
      [1, true],
      [2, true],
    ]);
  });

  it('shows a hand that ties the best one so far', () => {
    const players = [seat(0, 'Ac Kh'), seat(1, 'As Ks')];

    const { entries } = resolveShowdown(players, [pot(300, [0, 1])], board, 0, 0);

    expect(entries.every((entry) => entry.mucked)).toBe(false);
  });

  it('shows a hand that beats the one before it', () => {
    const players = [seat(0, '3c 3d'), seat(1, 'As Ac')];

    const { entries } = resolveShowdown(players, [pot(300, [0, 1])], board, 0, 0);

    expect(entries.map((entry) => entry.mucked)).toEqual([false, false]);
  });
});
