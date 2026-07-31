import { parseCard } from '@/engine';

import { DEFAULT_SCREEN_READER } from './config';
import { type Rect } from './geometry';
import { binarize, filterComponents, labelComponents, splitHeroFan } from './segment';
import { paintFrame, type PaintCard } from './synthetic';

const W = 200;
const H = 356;
const config = DEFAULT_SCREEN_READER;

function boardCard(index: number, card: string): PaintCard {
  return { rect: { x: 27 + index * 30, y: 164, w: 26, h: 37 }, card: parseCard(card) };
}

/** A grid cell's mask value, from a pixel coordinate. */
function maskAt(mask: ReturnType<typeof binarize>, px: number, py: number): number {
  const gx = Math.floor(px / mask.stride);
  const gy = Math.floor(py / mask.stride);

  return mask.data[gy * mask.gw + gx] ?? 0;
}

describe('binarize', () => {
  it('marks the card white and the felt not', () => {
    const frame = paintFrame({ width: W, height: H, cards: [boardCard(0, 'Kd')] });
    const mask = binarize(frame.rgb, W, H, config);

    // Inside the card body (away from the top-left glyphs), and out on felt.
    expect(maskAt(mask, 40, 190)).toBe(1);
    expect(maskAt(mask, 5, 5)).toBe(0);
  });

  it('keeps a dark-scheme card face (#F5F5F7) white', () => {
    const frame = paintFrame({ width: W, height: H, cards: [boardCard(0, 'Kd')], scheme: 'dark' });
    const mask = binarize(frame.rgb, W, H, config);

    expect(maskAt(mask, 40, 190)).toBe(1);
  });

  it('still finds the card when the capture is dim', () => {
    const frame = paintFrame({ width: W, height: H, cards: [boardCard(0, 'Kd')], brightness: 0.7 });
    const mask = binarize(frame.rgb, W, H, config);

    expect(maskAt(mask, 40, 190)).toBe(1);
  });

  it('excludes a red card back (high chroma) from the mask', () => {
    // A saturated red rectangle where a card would be.
    const rgb = new Uint8Array(W * H * 3);

    for (let y = 160; y < 200; y++) {
      for (let x = 30; x < 56; x++) {
        const p = (y * W + x) * 3;

        rgb[p] = 239;
        rgb[p + 1] = 68;
        rgb[p + 2] = 99;
      }
    }

    const mask = binarize(rgb, W, H, config);

    expect(maskAt(mask, 40, 180)).toBe(0);
  });
});

describe('labelComponents', () => {
  it('separates two disjoint white rectangles into two components', () => {
    const frame = paintFrame({
      width: W,
      height: H,
      cards: [boardCard(0, 'Kd'), boardCard(3, 'As')],
    });
    const components = labelComponents(binarize(frame.rgb, W, H, config));

    expect(components).toHaveLength(2);
  });
});

describe('filterComponents', () => {
  it('classifies a card-aspect blob as a single and a wide blob as a fan', () => {
    const frame = paintFrame({
      width: W,
      height: H,
      cards: [boardCard(0, 'Kd'), { rect: { x: 90, y: 270, w: 48, h: 40 }, card: parseCard('9c') }],
    });
    const mask = binarize(frame.rgb, W, H, config);
    const { singles, fans } = filterComponents(labelComponents(mask), mask.gw, mask.gh, config);

    expect(singles).toHaveLength(1);
    expect(fans).toHaveLength(1);
  });

  it('drops specks below the minimum card area', () => {
    const rgb = new Uint8Array(W * H * 3);
    const p = (10 * W + 10) * 3;

    rgb[p] = 255;
    rgb[p + 1] = 255;
    rgb[p + 2] = 255;

    const mask = binarize(rgb, W, H, config);
    const { singles, fans } = filterComponents(labelComponents(mask), mask.gw, mask.gh, config);

    expect(singles).toHaveLength(0);
    expect(fans).toHaveLength(0);
  });
});

describe('splitHeroFan', () => {
  it('splits a fan at its low-coverage seam into two halves', () => {
    // A wide blob with a one-column felt gap slightly left of centre.
    const rgb = new Uint8Array(W * H * 3);
    const fan: Rect = { x: 30, y: 60, w: 46, h: 20 }; // grid coords
    const stride = config.gridStride;

    for (let gy = fan.y; gy < fan.y + fan.h; gy++) {
      for (let gx = fan.x; gx < fan.x + fan.w; gx++) {
        if (gx === fan.x + 20) {
          continue; // the seam column
        }

        const px = gx * stride;
        const py = gy * stride;
        const pp = (py * W + px) * 3;

        rgb[pp] = 255;
        rgb[pp + 1] = 255;
        rgb[pp + 2] = 255;
      }
    }

    const mask = binarize(rgb, W, H, config);
    const [left, right] = splitHeroFan(fan, mask);

    expect(left.x).toBe(fan.x);
    expect(right.x).toBeGreaterThan(fan.x + 15);
    expect(right.x).toBeLessThan(fan.x + 25);
    expect(left.w + right.w).toBeGreaterThanOrEqual(fan.w - 1);
  });
});
