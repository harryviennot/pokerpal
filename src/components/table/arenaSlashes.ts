/**
 * The arena backdrop's geometry: the diagonal slashes and the lightning bolts.
 *
 * SVG path data rather than Skia objects. The shapes never change once the screen
 * is measured, so building them costs one string concatenation instead of a
 * native path per frame, and nothing here needs a Skia runtime — which is also
 * what lets the table render under Jest.
 */

/**
 * How far a slash leans right as it climbs, in x per y.
 *
 * Measured off the reference: a band crossing x=280 on one row crosses x=130
 * three hundred and twenty rows further down.
 */
export const SHEAR = 0.47;

/** Which tone a band is painted in. */
export type Lane = 'wash' | 'flare' | 'shadow';

/** One band of the repeating pattern; offset and width are fractions of the width. */
interface Band {
  offset: number;
  width: number;
  lane: Lane;
}

/** Distance between repeats of the pattern, as a fraction of the width. */
const PERIOD = 0.55;

/**
 * The pattern, sampled across a reference row: broad pale washes, a bright flare,
 * and two deep-blue slashes cutting the other way.
 */
const BANDS: readonly Band[] = [
  { offset: 0, width: 0.05, lane: 'wash' },
  { offset: 0.09, width: 0.03, lane: 'shadow' },
  { offset: 0.17, width: 0.06, lane: 'flare' },
  { offset: 0.28, width: 0.14, lane: 'wash' },
  { offset: 0.46, width: 0.04, lane: 'shadow' },
];

/** A lightning bolt in a unit box, y downwards. */
const BOLT: readonly { x: number; y: number }[] = [
  { x: 0.62, y: 0 },
  { x: 0, y: 0.56 },
  { x: 0.4, y: 0.56 },
  { x: 0.2, y: 1 },
  { x: 1, y: 0.4 },
  { x: 0.56, y: 0.4 },
  { x: 0.9, y: 0 },
];

/** Where the bolts strike, as fractions of the backdrop. */
const BOLTS = [
  { x: 0.01, y: 0.04, width: 0.19, height: 0.24 },
  { x: 0.63, y: 0.68, width: 0.26, height: 0.26 },
];

/** Every slash of every tone, one path per tone. */
export function slashPaths(width: number, height: number): Record<Lane, string> {
  const lanes: Record<Lane, string[]> = { wash: [], flare: [], shadow: [] };

  if (width <= 0 || height <= 0) {
    return { wash: '', flare: '', shadow: '' };
  }

  // A slash drifts left by `SHEAR * height` on its way down, so the pattern has
  // to start off the right-hand edge by that much to cover the bottom corner.
  const tiles = Math.ceil((1 + (SHEAR * height) / width) / PERIOD) + 1;
  const drift = SHEAR * height;

  for (let tile = -1; tile <= tiles; tile++) {
    for (const band of BANDS) {
      const left = (tile * PERIOD + band.offset) * width;
      const right = left + band.width * width;

      lanes[band.lane].push(
        polygon([
          { x: left, y: 0 },
          { x: right, y: 0 },
          { x: right - drift, y: height },
          { x: left - drift, y: height },
        ]),
      );
    }
  }

  return {
    wash: lanes.wash.join(' '),
    flare: lanes.flare.join(' '),
    shadow: lanes.shadow.join(' '),
  };
}

/** Both bolts, as one path. */
export function boltPaths(width: number, height: number): string {
  return BOLTS.map((bolt) =>
    polygon(
      BOLT.map((point) => ({
        x: (bolt.x + point.x * bolt.width) * width,
        y: (bolt.y + point.y * bolt.height) * height,
      })),
    ),
  ).join(' ');
}

/** One closed contour of SVG path data, rounded so the string stays short. */
function polygon(points: readonly { x: number; y: number }[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .concat('Z')
    .join(' ');
}
