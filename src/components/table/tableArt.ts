/**
 * Geometry for the table artwork, `assets/images/table-arena.png`.
 *
 * The art is a 1024x1536 RGBA image whose only opaque pixels are the capsule
 * itself plus its soft drop shadow; everything outside is fully transparent.
 * That means the image can be composited straight onto the backdrop — no
 * clipping, no mask — as long as it is *positioned* so its capsule lands on the
 * rect the layout wants. Doing that arithmetic is all this module is for, and it
 * is pure so it can be checked against the measured pixels in a test.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Where the opaque capsule sits inside the artwork, as fractions of the image.
 *
 * Measured from the PNG's alpha channel: the pixels with alpha above 250 span
 * x=249, y=156, 525x1175 of the 1024x1536 image. The widest opaque row is
 * exactly 525 pixels, which confirms a true capsule — its corner radius is half
 * its width.
 */
export const ARENA_CAPSULE = {
  x: 249 / 1024,
  y: 156 / 1536,
  width: 525 / 1024,
  height: 1175 / 1536,
} as const;

/**
 * The capsule's corner radius as a fraction of its own height.
 *
 * Half the capsule's width in the artwork — 262.5 of 1175 tall. Expressed
 * against the height so it survives the stretch in `capsuleRect`: the drawn
 * capsule is wider than the art's, which turns the circular caps into ellipses
 * of exactly this depth.
 */
export const CAPSULE_CAP_DEPTH = 262.5 / 1175;

/**
 * The table's shape on screen, width over height.
 *
 * Sampled from the reference design (373.6 x 576.8 points on a 402-point
 * screen), not from the artwork, which is a taller capsule than any phone has
 * room for. Drawing at this ratio stretches the art's circular caps into
 * shallower ellipses, which is what the reference table's corners look like.
 */
export const TABLE_ASPECT = 373.6 / 576.8;

/**
 * The frame to draw the whole image in so its capsule lands exactly on `capsule`.
 *
 * The result is deliberately larger than the capsule and starts at negative
 * coordinates: the surrounding transparency and the drop shadow have to hang
 * outside, so the container needs `overflow: 'visible'`.
 */
export function arenaFrame(capsule: Size): Rect {
  const width = capsule.width / ARENA_CAPSULE.width;
  const height = capsule.height / ARENA_CAPSULE.height;

  return {
    left: -ARENA_CAPSULE.x * width,
    top: -ARENA_CAPSULE.y * height,
    width,
    height,
  };
}

/**
 * The biggest reference-shaped capsule that fits in `box`, centred, inset by
 * `margin` on every side.
 *
 * Width-driven on a phone and height-driven on the tracker's fixed-ratio felt,
 * from one rule: fit the shape, then centre what is left over.
 */
export function capsuleRect(box: Size, margin: number): Rect {
  const width = Math.max(
    0,
    Math.min(box.width - margin * 2, (box.height - margin * 2) * TABLE_ASPECT),
  );
  const height = width / TABLE_ASPECT;

  return { left: (box.width - width) / 2, top: (box.height - height) / 2, width, height };
}

/**
 * Half the capsule's width at `depth`, as a fraction of its width.
 *
 * `depth` runs 0 at the top edge to 1 at the bottom. Returns 0.5 along the
 * straight sides and follows the elliptical cap through the rounded ends, so
 * seat placement can prove it keeps its boxes on the felt rather than hanging
 * over a corner.
 */
export function capsuleHalfWidth(depth: number): number {
  const fromEnd = Math.min(depth, 1 - depth);

  if (fromEnd <= 0) {
    return 0;
  }

  if (fromEnd >= CAPSULE_CAP_DEPTH) {
    return 0.5;
  }

  const remaining = (CAPSULE_CAP_DEPTH - fromEnd) / CAPSULE_CAP_DEPTH;

  return 0.5 * Math.sqrt(1 - remaining * remaining);
}
