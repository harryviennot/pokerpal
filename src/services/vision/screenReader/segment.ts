/**
 * From an RGB frame to card-shaped white blobs.
 *
 * Three steps: threshold the frame to a whiteness mask on a strided grid,
 * label the connected white regions, and keep the ones shaped like a card (a
 * single) or a fanned pair (a fan). Everything is a plain function over typed
 * arrays — no allocation the worklet cannot afford, no Map, helpers above
 * callers.
 */

import { type ScreenReaderConfig } from './config';
import { componentRect, type Component, type Rect } from './geometry';

export interface Mask {
  /** One byte per grid cell: 1 where the frame is card-white. */
  data: Uint8Array;
  gw: number;
  gh: number;
  stride: number;
}

/** BT.601-ish luma from 8-bit channels, integer. */
function lumaOf(r: number, g: number, b: number): number {
  'worklet';

  return (r * 77 + g * 150 + b * 29) >> 8;
}

/**
 * Whiteness mask on the strided grid: a cell is set when it is bright relative
 * to the frame's own exposure and close to grey (so the blue felt, red card
 * backs and purple mystery cards drop out, and both card-face whites survive).
 */
export function binarize(
  rgb: Uint8Array,
  width: number,
  height: number,
  config: ScreenReaderConfig,
): Mask {
  'worklet';

  const stride = config.gridStride;
  const gw = Math.ceil(width / stride);
  const gh = Math.ceil(height / stride);
  const cells = gw * gh;

  const luma = new Uint8Array(cells);
  const chroma = new Uint8Array(cells);
  const hist = new Int32Array(256);

  for (let gy = 0; gy < gh; gy++) {
    const y = Math.min(height - 1, gy * stride);

    for (let gx = 0; gx < gw; gx++) {
      const x = Math.min(width - 1, gx * stride);
      const p = (y * width + x) * 3;
      const r = rgb[p] ?? 0;
      const g = rgb[p + 1] ?? 0;
      const b = rgb[p + 2] ?? 0;
      const l = lumaOf(r, g, b);
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      const cell = gy * gw + gx;

      luma[cell] = l;
      chroma[cell] = mx - mn;
      hist[l] = (hist[l] ?? 0) + 1;
    }
  }

  const target = Math.floor(config.lumaPercentile * cells);
  let acc = 0;
  let percentile = 255;

  for (let i = 0; i < 256; i++) {
    acc += hist[i] ?? 0;

    if (acc >= target) {
      percentile = i;
      break;
    }
  }

  const threshold = Math.max(config.lumaFloor, Math.floor(config.lumaFraction * percentile));
  const data = new Uint8Array(cells);

  for (let i = 0; i < cells; i++) {
    data[i] = (luma[i] ?? 0) >= threshold && (chroma[i] ?? 255) < config.maxChroma ? 1 : 0;
  }

  return { data, gw, gh, stride };
}

/** Path-halving find on a plain parent array. */
function findRoot(parent: Int32Array, start: number): number {
  'worklet';

  let x = start;

  while ((parent[x] ?? x) !== x) {
    const up = parent[x] ?? x;

    parent[x] = parent[up] ?? up;
    x = parent[x] ?? x;
  }

  return x;
}

/** Eight-connected components of the mask, as bounding boxes with area. */
export function labelComponents(mask: Mask): Component[] {
  'worklet';

  const { data, gw, gh } = mask;
  const cells = gw * gh;
  const labels = new Int32Array(cells);
  // Upper bound on labels: one per cell. parent[0] is the "no label" sentinel.
  const parent = new Int32Array(cells + 1);
  let next = 1;

  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const i = gy * gw + gx;

      if (!data[i]) {
        continue;
      }

      const left = gx > 0 ? (labels[i - 1] ?? 0) : 0;
      const up = gy > 0 ? (labels[i - gw] ?? 0) : 0;
      const ul = gx > 0 && gy > 0 ? (labels[i - gw - 1] ?? 0) : 0;
      const ur = gx < gw - 1 && gy > 0 ? (labels[i - gw + 1] ?? 0) : 0;

      let best = 0;

      for (const n of [left, up, ul, ur]) {
        if (n > 0) {
          best = best === 0 ? n : Math.min(best, n);
        }
      }

      if (best === 0) {
        labels[i] = next;
        parent[next] = next;
        next += 1;
        continue;
      }

      labels[i] = best;

      for (const n of [left, up, ul, ur]) {
        if (n > 0 && n !== best) {
          const ra = findRoot(parent, best);
          const rb = findRoot(parent, n);

          if (ra !== rb) {
            parent[Math.max(ra, rb)] = Math.min(ra, rb);
          }
        }
      }
    }
  }

  // Gather bounds per root in label-indexed arrays; compact at the end.
  const minX = new Int32Array(next).fill(0x7fffffff);
  const minY = new Int32Array(next).fill(0x7fffffff);
  const maxX = new Int32Array(next).fill(-1);
  const maxY = new Int32Array(next).fill(-1);
  const area = new Int32Array(next);

  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const l = labels[gy * gw + gx] ?? 0;

      if (!l) {
        continue;
      }

      const r = findRoot(parent, l);

      if (gx < (minX[r] ?? 0)) minX[r] = gx;
      if (gy < (minY[r] ?? 0)) minY[r] = gy;
      if (gx > (maxX[r] ?? 0)) maxX[r] = gx;
      if (gy > (maxY[r] ?? 0)) maxY[r] = gy;
      area[r] = (area[r] ?? 0) + 1;
    }
  }

  const components: Component[] = [];

  for (let l = 1; l < next; l++) {
    if (findRoot(parent, l) !== l || (area[l] ?? 0) === 0) {
      continue;
    }

    components.push({
      minX: minX[l] ?? 0,
      minY: minY[l] ?? 0,
      maxX: maxX[l] ?? 0,
      maxY: maxY[l] ?? 0,
      area: area[l] ?? 0,
    });
  }

  return components;
}

/** Card-shaped singles and wide fanned-pair blobs, everything else dropped. */
export function filterComponents(
  components: readonly Component[],
  gw: number,
  gh: number,
  config: ScreenReaderConfig,
): { singles: Rect[]; fans: Rect[] } {
  'worklet';

  const frameArea = gw * gh;
  const singles: Rect[] = [];
  const fans: Rect[] = [];

  for (const component of components) {
    const rect = componentRect(component);
    const bboxArea = rect.w * rect.h;
    const areaFrac = bboxArea / frameArea;

    if (areaFrac < config.minCardAreaFrac || areaFrac > config.maxCardAreaFrac) {
      continue;
    }

    const fill = component.area / bboxArea;
    const aspect = rect.w / rect.h;

    if (
      aspect >= config.cardAspectMin &&
      aspect <= config.cardAspectMax &&
      fill >= config.minFill
    ) {
      singles.push(rect);
    } else if (
      aspect >= config.fanAspectMin &&
      aspect <= config.fanAspectMax &&
      fill >= config.fanMinFill
    ) {
      fans.push(rect);
    }
  }

  return { singles, fans };
}

/**
 * Splits a fanned-pair blob into two card rects at the column where the two
 * overlapping cards seam — the local minimum of white coverage across the
 * middle of the blob. Falls back to the midpoint when there is no clear seam.
 */
export function splitHeroFan(fan: Rect, mask: Mask): [Rect, Rect] {
  'worklet';

  const from = fan.x + Math.floor(fan.w * 0.3);
  const to = fan.x + Math.ceil(fan.w * 0.7);
  let bestCol = fan.x + Math.floor(fan.w / 2);
  let bestCount = Infinity;

  for (let gx = from; gx <= to; gx++) {
    let count = 0;

    for (let gy = fan.y; gy <= fan.y + fan.h; gy++) {
      count += mask.data[gy * mask.gw + gx] ?? 0;
    }

    if (count < bestCount) {
      bestCount = count;
      bestCol = gx;
    }
  }

  const left: Rect = { x: fan.x, y: fan.y, w: Math.max(1, bestCol - fan.x), h: fan.h };
  const right: Rect = { x: bestCol, y: fan.y, w: Math.max(1, fan.x + fan.w - bestCol), h: fan.h };

  return [left, right];
}
