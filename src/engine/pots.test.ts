import { awardPot, buildPots, findUncalledBet, type Contribution } from './pots';
import { createRng } from './rng';
import { type SeatIndex } from './table';

function contribution(seat: SeatIndex, committedTotal: number, eligible = true): Contribution {
  return { seat, committedTotal, eligible };
}

describe('buildPots', () => {
  it('makes a single pot when everyone matched', () => {
    const pots = buildPots([contribution(0, 100), contribution(1, 100), contribution(2, 100)]);

    expect(pots).toEqual([{ amount: 300, eligible: [0, 1, 2] }]);
  });

  it('returns nothing when no chips went in', () => {
    expect(buildPots([contribution(0, 0), contribution(1, 0)])).toEqual([]);
  });

  it('layers a side pot above a short all-in', () => {
    // Seat 0 is all in for 50; seats 1 and 2 keep betting to 200.
    const pots = buildPots([contribution(0, 50), contribution(1, 200), contribution(2, 200)]);

    expect(pots).toEqual([
      { amount: 150, eligible: [0, 1, 2] },
      { amount: 300, eligible: [1, 2] },
    ]);
  });

  it('layers three all-ins at distinct levels', () => {
    const pots = buildPots([
      contribution(0, 25),
      contribution(1, 60),
      contribution(2, 150),
      contribution(3, 150),
    ]);

    expect(pots).toEqual([
      { amount: 100, eligible: [0, 1, 2, 3] }, // 25 x 4
      { amount: 105, eligible: [1, 2, 3] }, //    35 x 3
      { amount: 180, eligible: [2, 3] }, //       90 x 2
    ]);
  });

  it('keeps a folded player money in the pot but not their claim', () => {
    const pots = buildPots([
      contribution(0, 100, false), // folded on the turn after committing
      contribution(1, 100),
      contribution(2, 100),
    ]);

    expect(pots).toEqual([{ amount: 300, eligible: [1, 2] }]);
  });

  it('excludes a folded short stack from the layer it created', () => {
    const pots = buildPots([
      contribution(0, 40, false),
      contribution(1, 120),
      contribution(2, 120),
    ]);

    // One pot, not two: the short stack folded, so both layers are claimable
    // by the same two seats and a side pot would be a distinction without one.
    expect(pots).toEqual([{ amount: 280, eligible: [1, 2] }]);
  });

  it('merges adjacent layers that have the same claimants', () => {
    // Two folded players at different levels must not manufacture two pots
    // when the same two seats can claim both.
    const pots = buildPots([
      contribution(0, 30, false),
      contribution(1, 70, false),
      contribution(2, 200),
      contribution(3, 200),
    ]);

    expect(pots).toHaveLength(1);
    expect(pots[0]).toEqual({ amount: 500, eligible: [2, 3] });
  });

  it('folds an unclaimable layer down into the pot below it', () => {
    // Only reachable if an uncalled bet was not returned first; the merge is
    // what guarantees chips are never stranded when it happens anyway.
    const pots = buildPots([contribution(0, 50), contribution(1, 90, false)]);

    expect(pots).toEqual([{ amount: 140, eligible: [0] }]);
  });

  it('conserves chips for any commitment vector', () => {
    const rng = createRng(20260728);

    for (let trial = 0; trial < 2000; trial++) {
      const seatCount = 2 + rng.nextInt(8);
      const contributions = Array.from({ length: seatCount }, (_, seat) =>
        contribution(seat, rng.nextInt(500), rng.nextInt(4) > 0),
      );
      const committed = contributions.reduce((sum, c) => sum + c.committedTotal, 0);
      const pots = buildPots(contributions);

      expect(pots.reduce((sum, pot) => sum + pot.amount, 0)).toBe(committed);
      expect(pots.every((pot) => pot.amount > 0)).toBe(true);
    }
  });
});

describe('findUncalledBet', () => {
  it('returns the excess of an unmatched bet', () => {
    expect(findUncalledBet([contribution(0, 300), contribution(1, 100)])).toEqual({
      seat: 0,
      amount: 200,
    });
  });

  it('returns null when the top bet was matched', () => {
    expect(findUncalledBet([contribution(0, 300), contribution(1, 300)])).toBeNull();
  });

  it('returns the whole bet when nobody else put chips in', () => {
    expect(findUncalledBet([contribution(0, 80), contribution(1, 0)])).toEqual({
      seat: 0,
      amount: 80,
    });
  });

  it('ignores whether the top contributor folded', () => {
    // A player who bet and then folded to a raise still cannot be unmatched,
    // but the shape must not depend on eligibility.
    expect(findUncalledBet([contribution(0, 500, false), contribution(1, 200)])).toEqual({
      seat: 0,
      amount: 300,
    });
  });

  it('returns null on an empty pot', () => {
    expect(findUncalledBet([contribution(0, 0), contribution(1, 0)])).toBeNull();
  });
});

describe('awardPot', () => {
  const pot = (amount: number, eligible: SeatIndex[]) => ({ amount, eligible });

  it('gives the whole pot to a lone winner', () => {
    expect(awardPot(pot(450, [2]), [2], 0, 0, 6)).toEqual([
      { seat: 2, amount: 450, potIndex: 0, oddChip: false },
    ]);
  });

  it('splits an even pot exactly', () => {
    const awards = awardPot(pot(400, [1, 3]), [1, 3], 1, 0, 6);

    expect(awards).toEqual([
      { seat: 1, amount: 200, potIndex: 1, oddChip: false },
      { seat: 3, amount: 200, potIndex: 1, oddChip: false },
    ]);
  });

  it('gives the odd chip to the winner nearest the left of the button', () => {
    // Button on seat 4, so of the winners 1 and 3, seat 1 is closer clockwise.
    const awards = awardPot(pot(101, [1, 3]), [3, 1], 0, 4, 6);

    expect(awards).toEqual([
      { seat: 1, amount: 51, potIndex: 0, oddChip: true },
      { seat: 3, amount: 50, potIndex: 0, oddChip: false },
    ]);
  });

  it('hands out several odd chips in seat order from the button', () => {
    // 302 split three ways is 100 each with two left over.
    const awards = awardPot(pot(302, [0, 2, 5]), [5, 0, 2], 0, 5, 6);

    expect(awards).toEqual([
      { seat: 0, amount: 101, potIndex: 0, oddChip: true },
      { seat: 2, amount: 101, potIndex: 0, oddChip: true },
      { seat: 5, amount: 100, potIndex: 0, oddChip: false },
    ]);
  });

  it('treats the button seat itself as last in line for an odd chip', () => {
    const awards = awardPot(pot(3, [0, 1]), [0, 1], 0, 0, 2);

    expect(awards).toEqual([
      { seat: 1, amount: 2, potIndex: 0, oddChip: true },
      { seat: 0, amount: 1, potIndex: 0, oddChip: false },
    ]);
  });

  it('never creates or destroys a chip', () => {
    const rng = createRng(7);

    for (let trial = 0; trial < 500; trial++) {
      const seatCount = 2 + rng.nextInt(8);
      const winners = [...new Set(Array.from({ length: 3 }, () => rng.nextInt(seatCount)))];
      const amount = rng.nextInt(1000) + 1;
      const awards = awardPot(pot(amount, winners), winners, 0, rng.nextInt(seatCount), seatCount);

      expect(awards.reduce((sum, award) => sum + award.amount, 0)).toBe(amount);
    }
  });

  it('rejects a pot with no winner', () => {
    expect(() => awardPot(pot(100, []), [], 0, 0, 6)).toThrow(RangeError);
  });
});
