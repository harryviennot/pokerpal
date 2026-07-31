/**
 * The small shapes the screen reader passes around.
 *
 * Coordinates are integers in whatever grid the producer used — segmentation
 * and zoning work in the strided grid, `readScreenFrame` scales to pixels and
 * normalizes at the boundary.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A labelled blob of white pixels, in grid coordinates. */
export interface Component {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** White cell count inside the bbox. */
  area: number;
}

export function componentRect(component: Component): Rect {
  'worklet';

  return {
    x: component.minX,
    y: component.minY,
    w: component.maxX - component.minX + 1,
    h: component.maxY - component.minY + 1,
  };
}

export function rectCentreX(rect: Rect): number {
  'worklet';

  return rect.x + rect.w / 2;
}

export function rectCentreY(rect: Rect): number {
  'worklet';

  return rect.y + rect.h / 2;
}
