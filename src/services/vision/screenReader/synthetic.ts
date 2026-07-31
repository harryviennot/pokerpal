/**
 * A poker screen, painted from nothing.
 *
 * The reader's `memoryRepo`: builds the exact input the frame worklet gets — an
 * RGB byte buffer — with cards at chosen positions and the *same* glyph
 * bitmaps that `fakeTemplates()` matches against. So the whole reader runs in
 * Jest with no Skia, no font, no camera: paint a frame, read it back, assert.
 */

import { rankIndexOf, suitIndexOf, suitOf, type Card } from '@/engine';

import { type Rect } from './geometry';
import { makeTemplate, type GlyphTemplates } from './templates';

const RANK_MASK_W = 16;
const RANK_MASK_H = 20;
const SUIT_MASK_W = 12;
const SUIT_MASK_H = 12;

/** Four-colour ink, matching `suitColor.ts` (red ♥, orange ♦, dark ♠♣). */
const SUIT_RGB: Record<string, readonly [number, number, number]> = {
  h: [215, 38, 61],
  d: [237, 62, 18],
  s: [35, 45, 75],
  c: [35, 45, 75],
};

const CARD_WHITE: readonly [number, number, number] = [255, 255, 255];
const CARD_WHITE_DARK: readonly [number, number, number] = [245, 245, 247];
const CARD_DIM: readonly [number, number, number] = [198, 201, 207];
const FELT_BLUE: readonly [number, number, number] = [30, 64, 180];

/** A coarse on/off block pattern, distinct per seed, never all-on or all-off. */
function blockMask(
  seed: number,
  w: number,
  h: number,
  blocksX: number,
  blocksY: number,
): Float32Array {
  const data = new Float32Array(w * h);
  // A cheap deterministic hash of the seed, spread across the block bits.
  const bits = (Math.imul(seed + 1, 2654435761) ^ 0x9e3779b9) >>> 0;
  const bw = w / blocksX;
  const bh = h / blocksY;

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      const index = by * blocksX + bx;
      // Force the first block on and the last off so no glyph is degenerate.
      const on = index === 0 ? 1 : index === blocksX * blocksY - 1 ? 0 : (bits >> (index % 31)) & 1;

      if (!on) {
        continue;
      }

      for (let y = Math.floor(by * bh); y < Math.floor((by + 1) * bh); y++) {
        for (let x = Math.floor(bx * bw); x < Math.floor((bx + 1) * bw); x++) {
          data[y * w + x] = 1;
        }
      }
    }
  }

  return data;
}

export function fakeRankMask(rankIndex: number): { data: Float32Array; w: number; h: number } {
  return {
    data: blockMask(rankIndex, RANK_MASK_W, RANK_MASK_H, 4, 5),
    w: RANK_MASK_W,
    h: RANK_MASK_H,
  };
}

export function fakeSuitMask(suitIndex: number): { data: Float32Array; w: number; h: number } {
  return {
    data: blockMask(suitIndex + 100, SUIT_MASK_W, SUIT_MASK_H, 3, 3),
    w: SUIT_MASK_W,
    h: SUIT_MASK_H,
  };
}

/** Templates that match frames painted by `paintFrame` — the Jest stand-in. */
export function fakeTemplates(): GlyphTemplates {
  const ranks = Array.from({ length: 13 }, (_, i) => {
    const m = fakeRankMask(i);

    return makeTemplate(m.data, m.w, m.h, RANK_MASK_W, RANK_MASK_H);
  });
  const suits = Array.from({ length: 4 }, (_, i) => {
    const m = fakeSuitMask(i);

    return makeTemplate(m.data, m.w, m.h, SUIT_MASK_W, SUIT_MASK_H);
  });

  return {
    ranks,
    suits,
    rankW: RANK_MASK_W,
    rankH: RANK_MASK_H,
    suitW: SUIT_MASK_W,
    suitH: SUIT_MASK_H,
  };
}

export interface PaintCard {
  rect: Rect;
  card: Card;
  dim?: boolean;
}

export interface PaintSpec {
  width: number;
  height: number;
  cards: readonly PaintCard[];
  background?: readonly [number, number, number];
  /** Multiplies every channel — a brighter or dimmer capture. */
  brightness?: number;
  /** Peak amplitude of deterministic additive noise. */
  noise?: number;
  scheme?: 'light' | 'dark';
}

export interface PaintedFrame {
  rgb: Uint8Array;
  width: number;
  height: number;
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : Math.round(value);
}

function fillRect(
  rgb: Uint8Array,
  width: number,
  rect: Rect,
  color: readonly [number, number, number],
): void {
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const p = (y * width + x) * 3;

      rgb[p] = color[0];
      rgb[p + 1] = color[1];
      rgb[p + 2] = color[2];
    }
  }
}

/** Stamps a 0/1 glyph mask into a pixel sub-rect, in the ink colour. */
function stampGlyph(
  rgb: Uint8Array,
  width: number,
  target: Rect,
  mask: { data: Float32Array; w: number; h: number },
  color: readonly [number, number, number],
): void {
  for (let y = 0; y < target.h; y++) {
    const my = Math.min(mask.h - 1, Math.floor((y / target.h) * mask.h));

    for (let x = 0; x < target.w; x++) {
      const mx = Math.min(mask.w - 1, Math.floor((x / target.w) * mask.w));

      if ((mask.data[my * mask.w + mx] ?? 0) < 0.5) {
        continue;
      }

      const px = target.x + x;
      const py = target.y + y;
      const p = (py * width + px) * 3;

      rgb[p] = color[0];
      rgb[p + 1] = color[1];
      rgb[p + 2] = color[2];
    }
  }
}

/** Renders one poker screen to an RGB buffer. */
export function paintFrame(spec: PaintSpec): PaintedFrame {
  const { width, height } = spec;
  const rgb = new Uint8Array(width * height * 3);
  const bg = spec.background ?? FELT_BLUE;

  for (let i = 0; i < width * height; i++) {
    rgb[i * 3] = bg[0];
    rgb[i * 3 + 1] = bg[1];
    rgb[i * 3 + 2] = bg[2];
  }

  const white = spec.scheme === 'dark' ? CARD_WHITE_DARK : CARD_WHITE;

  for (const painted of spec.cards) {
    const { rect, card } = painted;

    fillRect(rgb, width, rect, painted.dim ? CARD_DIM : white);

    const suit = suitOf(card);
    const ink = SUIT_RGB[suit] ?? SUIT_RGB.s!;
    const rank = fakeRankMask(rankIndexOf(card));
    const pip = fakeSuitMask(suitIndexOf(card));

    // Rank top-left, suit pip just below it — within the reader's rank window.
    stampGlyph(
      rgb,
      width,
      {
        x: Math.round(rect.x + rect.w * 0.06),
        y: Math.round(rect.y + rect.h * 0.04),
        w: Math.round(rect.w * 0.4),
        h: Math.round(rect.h * 0.34),
      },
      rank,
      ink,
    );
    stampGlyph(
      rgb,
      width,
      {
        x: Math.round(rect.x + rect.w * 0.08),
        y: Math.round(rect.y + rect.h * 0.4),
        w: Math.round(rect.w * 0.28),
        h: Math.round(rect.h * 0.2),
      },
      pip,
      ink,
    );
  }

  const brightness = spec.brightness ?? 1;
  const noise = spec.noise ?? 0;

  if (brightness !== 1 || noise > 0) {
    for (let i = 0; i < rgb.length; i++) {
      // Deterministic per-index noise so a painted frame is reproducible.
      const n = noise > 0 ? ((Math.imul(i + 1, 1103515245) >>> 16) % (2 * noise + 1)) - noise : 0;

      rgb[i] = clampByte((rgb[i] ?? 0) * brightness + n);
    }
  }

  return { rgb, width, height };
}
