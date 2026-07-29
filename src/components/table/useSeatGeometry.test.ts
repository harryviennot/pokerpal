import { SEAT_HEIGHT, SEAT_WIDTH } from './TableSeat';
import { betSpot, seatSpot, type TableSize } from './useSeatGeometry';

const SIZE: TableSize = { width: 360, height: 640 };

describe('seatSpot', () => {
  it('pins the hero to the bottom centre', () => {
    const spot = seatSpot(2, 2, 6, SIZE);

    expect(spot.x).toBeCloseTo(SIZE.width / 2 - SEAT_WIDTH / 2);
    expect(spot.y).toBeGreaterThan(SIZE.height * 0.7);
  });

  it('walks the remaining seats around the ellipse from the hero', () => {
    const count = 6;
    const heroSeat = 0;
    const spots = Array.from({ length: count }, (_, seat) => seatSpot(seat, heroSeat, count, SIZE));
    const centreX = SIZE.width / 2 - SEAT_WIDTH / 2;

    // Seats 1 and 2 climb the right side, 3 sits at the top, 4 and 5 come
    // down the left — the table reads from the player's own chair.
    expect(spots[1]!.x).toBeGreaterThan(centreX);
    expect(spots[2]!.x).toBeGreaterThan(centreX);
    expect(spots[3]!.x).toBeCloseTo(centreX);
    expect(spots[3]!.y).toBeLessThan(SIZE.height * 0.3);
    expect(spots[4]!.x).toBeLessThan(centreX);
    expect(spots[5]!.x).toBeLessThan(centreX);
  });

  it('keeps every seat box fully inside the table', () => {
    for (const count of [2, 6, 9]) {
      for (let seat = 0; seat < count; seat++) {
        const spot = seatSpot(seat, 0, count, SIZE);

        expect(spot.x).toBeGreaterThanOrEqual(0);
        expect(spot.y).toBeGreaterThanOrEqual(0);
        expect(spot.x + SEAT_WIDTH).toBeLessThanOrEqual(SIZE.width);
        expect(spot.y + SEAT_HEIGHT).toBeLessThanOrEqual(SIZE.height);
      }
    }
  });
});

describe('betSpot', () => {
  it('steps a bet from the seat towards the middle', () => {
    const seat = seatSpot(0, 0, 6, SIZE);
    const bet = betSpot(seat, SIZE);
    const middle = { x: SIZE.width / 2 - SEAT_WIDTH / 2, y: SIZE.height / 2 - SEAT_HEIGHT / 2 };

    const seatDistance = Math.hypot(seat.x - middle.x, seat.y - middle.y);
    const betDistance = Math.hypot(bet.x - middle.x, bet.y - middle.y);

    expect(betDistance).toBeLessThan(seatDistance);
  });

  it('never overshoots the middle', () => {
    const nearMiddle = {
      x: SIZE.width / 2 - SEAT_WIDTH / 2 - 5,
      y: SIZE.height / 2 - SEAT_HEIGHT / 2,
    };
    const bet = betSpot(nearMiddle, SIZE, 500);

    expect(bet.x).toBeCloseTo(SIZE.width / 2 - SEAT_WIDTH / 2);
    expect(bet.y).toBeCloseTo(SIZE.height / 2 - SEAT_HEIGHT / 2);
  });
});
