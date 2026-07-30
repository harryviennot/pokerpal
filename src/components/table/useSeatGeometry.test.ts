import { PILL_HEIGHT, SEAT_WIDTH } from './seatMetrics';
import { MAX_SEATS, MIN_SEATS, slotFor } from './seatSlots';
import { capsuleHalfWidth } from './tableArt';
import { betSpot, buttonSpot, seatBox, seatSpot, type TableSize } from './useSeatGeometry';

/** A phone-sized capsule: the reference table is 370 x 571 points on an iPhone. */
const SIZE: TableSize = { width: 370, height: 571 };

const COUNTS = [2, 3, 4, 5, 6, 7, 8, 9] as const;

const centreX = (box: TableSize): number => SIZE.width / 2 - box.width / 2;

/** The plate is the bottom of a seat's box, and the part that must stay on the felt. */
function plate(seat: number, heroSeat: number, count: number) {
  const spot = seatSpot(seat, heroSeat, count, SIZE);
  const box = seatBox(seat === heroSeat);

  return {
    left: spot.x,
    right: spot.x + box.width,
    top: spot.y + box.height - PILL_HEIGHT,
    bottom: spot.y + box.height,
  };
}

describe('seatSpot', () => {
  it('pins the hero to the bottom centre', () => {
    const spot = seatSpot(2, 2, 6, SIZE);

    expect(spot.x).toBeCloseTo(centreX(seatBox(true)));
    expect(plate(2, 2, 6).bottom).toBeGreaterThan(SIZE.height * 0.9);
  });

  it('puts the lone opponent of a heads-up table on the upper left', () => {
    // Straight off the reference: heads-up draws the opponent up the left-hand
    // edge rather than opposite the hero.
    const spot = seatSpot(1, 0, 2, SIZE);

    expect(spot.x).toBeLessThan(centreX(seatBox(false)));
    expect(plate(1, 0, 2).bottom).toBeLessThan(SIZE.height / 2);
  });

  it('walks seats clockwise from the hero, left-hand side first', () => {
    // Action moves to the player's left, which is the screen's left when the
    // table is drawn from the hero's chair. Every table starts that way and
    // comes back down the right — heads-up excepted, where there is only a
    // first opponent.
    for (const count of COUNTS) {
      expect(seatSpot(1, 0, count, SIZE).x).toBeLessThan(centreX(seatBox(false)));

      if (count > 2) {
        expect(seatSpot(count - 1, 0, count, SIZE).x).toBeGreaterThan(centreX(seatBox(false)));
      }
    }
  });

  it('mirrors the two sides of every table', () => {
    for (const count of COUNTS.filter((seats) => seats > 2)) {
      for (let step = 1; step < count; step++) {
        const left = slotFor(step, 0, count).seat;
        const right = slotFor(count - step, 0, count).seat;

        expect(left.x).toBeCloseTo(1 - right.x, 12);
        expect(left.y).toBeCloseTo(right.y, 12);
      }
    }
  });

  it('steps opponents down the sides rather than stacking them', () => {
    // Nine-handed is the densest table: four a side, and no two plates may
    // share a band of the felt.
    const bands = [1, 2, 3, 4].map((step) => plate(step, 0, MAX_SEATS));

    for (let i = 1; i < bands.length; i++) {
      expect(bands[i]!.bottom).toBeLessThan(bands[i - 1]!.top);
    }
  });

  it('keeps every opponent plate inside the capsule outline', () => {
    // The hero is excluded on purpose: their plate straddles the bottom rail in
    // the reference, tucked under their own cards. Every other plate has to sit
    // on felt, which is what the capsule's narrowing ends make non-obvious.
    for (const count of COUNTS) {
      for (let seat = 1; seat < count; seat++) {
        const box = plate(seat, 0, count);

        // The capsule narrows through its rounded ends, so a plate has to clear
        // the outline at both of its own horizontal edges.
        for (const y of [box.top, box.bottom]) {
          const half = capsuleHalfWidth(y / SIZE.height) * SIZE.width;

          expect(box.left).toBeGreaterThanOrEqual(SIZE.width / 2 - half - 1e-6);
          expect(box.right).toBeLessThanOrEqual(SIZE.width / 2 + half + 1e-6);
        }
      }
    }
  });

  it('keeps every seat box inside the felt at any player count', () => {
    for (const count of COUNTS) {
      for (let seat = 0; seat < count; seat++) {
        const spot = seatSpot(seat, 0, count, SIZE);
        const box = seatBox(seat === 0);

        expect(spot.x).toBeGreaterThanOrEqual(0);
        expect(spot.y).toBeGreaterThanOrEqual(0);
        expect(spot.x + box.width).toBeLessThanOrEqual(SIZE.width + 1e-6);
        expect(spot.y + box.height).toBeLessThanOrEqual(SIZE.height + 1e-6);
      }
    }
  });

  it('gives each chair its own slot, so a busted seat leaves a gap', () => {
    // `count` is every chair, sitting-out ones included: hiding a seat must not
    // shuffle everybody else round the felt.
    expect(seatSpot(2, 0, 3, SIZE)).not.toEqual(seatSpot(1, 0, 3, SIZE));
    expect(seatSpot(2, 0, 3, SIZE)).toEqual(seatSpot(2, 0, 3, SIZE));
  });

  it('clamps a player count the engine could never deal', () => {
    for (const count of [0, 1, MIN_SEATS - 1, MAX_SEATS + 3]) {
      const spot = seatSpot(0, 0, count, SIZE);

      expect(Number.isFinite(spot.x)).toBe(true);
      expect(Number.isFinite(spot.y)).toBe(true);
    }
  });
});

describe('betSpot', () => {
  it('steps every seat towards the middle of the felt', () => {
    const middle = { x: 0.5, y: 0.5 };

    for (const count of COUNTS) {
      for (let seat = 0; seat < count; seat++) {
        const slot = slotFor(seat, 0, count);
        const seatAway = Math.hypot(slot.seat.x - middle.x, slot.seat.y - middle.y);
        const betAway = Math.hypot(slot.bet.x - middle.x, slot.bet.y - middle.y);

        expect(betAway).toBeLessThan(seatAway);
      }
    }
  });

  it('keeps the chips clear of the cards they were bet with', () => {
    const bet = betSpot(0, 0, 3, SIZE);

    expect(bet.y).toBeLessThan(plate(0, 0, 3).top);
  });

  it('mirrors the bets of mirrored seats', () => {
    const left = betSpot(1, 0, 3, SIZE);
    const right = betSpot(2, 0, 3, SIZE);

    expect(left.x + right.x).toBeCloseTo(SIZE.width - SEAT_WIDTH, 6);
    expect(left.y).toBeCloseTo(right.y, 6);
  });
});

describe('buttonSpot', () => {
  it('sits on the felt beside the seat that holds it', () => {
    for (const count of COUNTS) {
      for (let seat = 0; seat < count; seat++) {
        const spot = buttonSpot(seat, 0, count, SIZE);

        expect(spot.x).toBeGreaterThanOrEqual(0);
        expect(spot.y).toBeGreaterThanOrEqual(0);
        expect(spot.x).toBeLessThanOrEqual(SIZE.width);
        expect(spot.y).toBeLessThanOrEqual(SIZE.height);
      }
    }
  });
});
