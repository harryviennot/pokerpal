import { useState } from 'react';
import { type LayoutChangeEvent } from 'react-native';

import { type SeatIndex } from '@/engine';
import { spacing } from '@/theme';

import { SEAT_HEIGHT, SEAT_WIDTH } from './TableSeat';

export interface TableSize {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * How far a seat's chips sit in front of it, in points.
 *
 * A fixed step towards the middle rather than a fraction of the radius: scaling
 * the ellipse moves the near seats barely at all and the far ones into the pot,
 * so no single fraction clears both the name plates and the middle.
 */
export const BET_OFFSET = 64;

/** Clearance between the edge of the table and the nearest seat box. */
const RAIL = spacing.md;

/**
 * Measures the table and hands out positions on its ellipse.
 *
 * Geometry comes from the measured size rather than fixed points so a
 * two-handed table and a nine-handed one lay out from the same rule. Callers
 * keep seats mounted and hide them until `measured` — layout never fires under
 * Jest, and unmounted seats would vanish from the accessibility tree.
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

/**
 * Where a seat sits on the ellipse, as the top-left corner of a seat-sized box.
 *
 * The hero is pinned to the bottom and the rest run round from there, so the
 * table always reads from the player's own chair.
 */
export function seatSpot(
  seat: SeatIndex,
  heroSeat: SeatIndex,
  count: number,
  size: TableSize,
): Point {
  const step = (seat - heroSeat + count) % count;
  // Screen y grows downwards, so a quarter turn is the bottom of the table and
  // subtracting the step walks seats up the right-hand side first.
  const angle = Math.PI / 2 - (2 * Math.PI * step) / count;
  // Inset by half a seat plus the rail, so a whole seat — cards included — sits
  // on the felt rather than hanging over the edge of the screen.
  const rx = size.width / 2 - SEAT_WIDTH / 2 - RAIL;
  const ry = size.height / 2 - SEAT_HEIGHT / 2 - RAIL;

  return {
    x: size.width / 2 + rx * Math.cos(angle) - SEAT_WIDTH / 2,
    y: size.height / 2 + ry * Math.sin(angle) - SEAT_HEIGHT / 2,
  };
}

/** Steps a seat-sized box `distance` points straight at the middle of the table. */
export function betSpot(from: Point, size: TableSize, distance: number = BET_OFFSET): Point {
  const dx = size.width / 2 - SEAT_WIDTH / 2 - from.x;
  const dy = size.height / 2 - SEAT_HEIGHT / 2 - from.y;
  const length = Math.hypot(dx, dy);

  if (length === 0) {
    return from;
  }

  const step = Math.min(distance, length);

  return { x: from.x + (dx / length) * step, y: from.y + (dy / length) * step };
}
