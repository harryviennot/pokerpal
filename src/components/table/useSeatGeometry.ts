import { useState } from 'react';
import { type LayoutChangeEvent } from 'react-native';

import { type SeatIndex } from '@/engine';

import {
  BUTTON_SIZE,
  HERO_SEAT_HEIGHT,
  HERO_SEAT_WIDTH,
  PILL_HEIGHT,
  SEAT_HEIGHT,
  SEAT_WIDTH,
} from './seatMetrics';
import { slotFor, type Point } from './seatSlots';

export interface TableSize {
  width: number;
  height: number;
}

export type { Point };

/**
 * Measures the felt and turns the slot tables into pixels.
 *
 * Every position is a fraction of the capsule's box (see `seatSlots`), so this
 * only ever scales and centres. Callers keep seats mounted and hide them until
 * `measured` — layout never fires under Jest, and unmounted seats would vanish
 * from the accessibility tree.
 */
export function useSeatGeometry(): {
  size: TableSize;
  measured: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
} {
  const [size, setSize] = useState<TableSize>({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;

    setSize({ width, height });
  };

  return { size, measured: size.width > 0 && size.height > 0, onLayout };
}

/** The footprint of a seat's box, which the hero's larger cards widen. */
export function seatBox(hero: boolean): TableSize {
  return hero
    ? { width: HERO_SEAT_WIDTH, height: HERO_SEAT_HEIGHT }
    : { width: SEAT_WIDTH, height: SEAT_HEIGHT };
}

/**
 * The top-left corner of a seat's box on a felt of `size`.
 *
 * Slots anchor the *name plate's centre*, because the plate is the one part
 * every seat has and the only part whose position the reference pins exactly.
 * The box hangs above it — cards, made-hand plate — so the seat lays its
 * contents out from the bottom up.
 */
export function seatSpot(
  seat: SeatIndex,
  heroSeat: SeatIndex,
  count: number,
  size: TableSize,
): Point {
  const slot = slotFor(seat, heroSeat, count).seat;
  const box = seatBox(seat === heroSeat);

  return clamp(
    {
      x: slot.x * size.width - box.width / 2,
      y: slot.y * size.height - box.height + PILL_HEIGHT / 2,
    },
    box,
    size,
  );
}

/**
 * The top-left corner of a seat's chips, in a box the size of an opponent seat.
 *
 * Always a step in from the seat towards the middle of the felt, so a bet reads
 * as chips pushed forward rather than a second badge on the plate.
 */
export function betSpot(
  seat: SeatIndex,
  heroSeat: SeatIndex,
  count: number,
  size: TableSize,
): Point {
  return centre(
    slotFor(seat, heroSeat, count).bet,
    { width: SEAT_WIDTH, height: SEAT_HEIGHT },
    size,
  );
}

/**
 * Which long edge of the capsule a seat leans against.
 *
 * Seats put their portrait on the outboard side, so nothing ever covers the
 * middle of the felt. The hero, dead centre at the bottom, counts as left.
 */
export function seatSide(seat: SeatIndex, heroSeat: SeatIndex, count: number): 'left' | 'right' {
  return slotFor(seat, heroSeat, count).seat.x > 0.5 ? 'right' : 'left';
}

/** The top-left corner of the dealer button when `seat` has it. */
export function buttonSpot(
  seat: SeatIndex,
  heroSeat: SeatIndex,
  count: number,
  size: TableSize,
): Point {
  const box = { width: BUTTON_SIZE, height: BUTTON_SIZE };

  return centre(slotFor(seat, heroSeat, count).button, box, size);
}

/** Puts a box's centre on a fractional point, clamped onto the felt. */
function centre(at: Point, box: TableSize, size: TableSize): Point {
  return clamp(
    { x: at.x * size.width - box.width / 2, y: at.y * size.height - box.height / 2 },
    box,
    size,
  );
}

/**
 * Keeps a box on the felt.
 *
 * The plates deliberately sit flush against the capsule's edge, so rounding or
 * an unusually narrow felt would otherwise push one off the side.
 */
function clamp(at: Point, box: TableSize, size: TableSize): Point {
  return {
    x: Math.min(Math.max(at.x, 0), Math.max(0, size.width - box.width)),
    y: Math.min(Math.max(at.y, 0), Math.max(0, size.height - box.height)),
  };
}
