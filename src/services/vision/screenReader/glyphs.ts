/**
 * Reading one card face: which rank, which suit.
 *
 * The corner tells us everything. The renderer puts the rank at the top-left
 * and a small suit pip directly beneath it, so each is read from its own fixed
 * sub-window of the card, tight-cropped to its ink, contrast-normalized and
 * cross-correlated against the templates. Positional windows rather than gap
 * detection: either glyph can break into pieces of its own, and a card is
 * always drawn to the same proportions.
 *
 * Suit shape decides; the pip's colour is only a tiebreak, because our own
 * four-colour deck shares a hue between ♠ and ♣, and ♥ and ♦ are both warm.
 *
 * Worklet-safe: helpers above callers, no captured state.
 */

import { makeCard, RANKS, SUITS, type Card } from '@/engine';

import { type ScreenReaderConfig } from './config';
import { type Rect } from './geometry';
import { makeCroppedTemplate, ncc, type GlyphTemplates } from './templates';

export interface CardRead {
  card: Card;
  /** 0 to 1. Below the fusion gate (~0.6) the read is discarded. */
  confidence: number;
}

function lumaOf(r: number, g: number, b: number): number {
  'worklet';

  return (r * 77 + g * 150 + b * 29) >> 8;
}

/** A glyph pixel: saturated (a suit colour) or dark (a dark suit / rank). */
function isInk(r: number, g: number, b: number, config: ScreenReaderConfig): boolean {
  'worklet';

  const chroma = Math.max(r, g, b) - Math.min(r, g, b);

  return chroma >= config.maxChroma || lumaOf(r, g, b) <= config.inkLuma;
}

interface InkPatch {
  data: Float32Array;
  w: number;
  h: number;
  /** Mean colour of the ink, for the suit tiebreak. */
  r: number;
  g: number;
  b: number;
}

/** The ink inside one window of the card, tight-cropped, or null when empty. */
function inkPatch(
  rgb: Uint8Array,
  frameW: number,
  frameH: number,
  window: Rect,
  config: ScreenReaderConfig,
): InkPatch | null {
  'worklet';

  const mask = new Uint8Array(window.w * window.h);
  let minX = window.w;
  let minY = window.h;
  let maxX = -1;
  let maxY = -1;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  for (let y = 0; y < window.h; y++) {
    const py = Math.min(frameH - 1, window.y + y);

    for (let x = 0; x < window.w; x++) {
      const px = Math.min(frameW - 1, window.x + x);
      const p = (py * frameW + px) * 3;
      const r = rgb[p] ?? 0;
      const g = rgb[p + 1] ?? 0;
      const b = rgb[p + 2] ?? 0;

      if (!isInk(r, g, b, config)) {
        continue;
      }

      mask[y * window.w + x] = 1;
      sumR += r;
      sumG += g;
      sumB += b;
      count += 1;

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || count === 0) {
    return null;
  }

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const data = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      data[y * w + x] = mask[(minY + y) * window.w + (minX + x)] ?? 0;
    }
  }

  return { data, w, h, r: sumR / count, g: sumG / count, b: sumB / count };
}

/** Best and runner-up NCC of a normalized patch against a template set. */
function score(
  patch: Float32Array,
  templates: readonly Float32Array[],
): { index: number; best: number; second: number } {
  'worklet';

  let index = 0;
  let best = -Infinity;
  let second = -Infinity;

  for (let i = 0; i < templates.length; i++) {
    const s = ncc(patch, templates[i] ?? patch);

    if (s > best) {
      second = best;
      best = s;
      index = i;
    } else if (s > second) {
      second = s;
    }
  }

  return { index, best, second };
}

function confidenceOf(best: number, second: number, minMargin: number): number {
  'worklet';

  const margin = Math.min(1, Math.max(0, (best - second) / minMargin));
  const strength = Math.min(1, Math.max(0, best));

  return margin * strength;
}

/** The suit indices a mean ink colour allows (shape breaks the remaining tie). */
function allowedSuits(r: number, g: number, b: number, config: ScreenReaderConfig): number[] {
  'worklet';

  if (lumaOf(r, g, b) <= config.suitDarkLuma) {
    return [0, 3]; // dark: clubs, spades
  }

  return b > g ? [2] : [1]; // red → hearts, orange → diamonds
}

/**
 * Reads the card in `cardRect` (pixel coordinates), or null when a glyph is
 * missing (occlusion, blur) or the read is too ambiguous to trust.
 */
export function readCardFace(
  rgb: Uint8Array,
  frameW: number,
  frameH: number,
  cardRect: Rect,
  templates: GlyphTemplates,
  config: ScreenReaderConfig,
): CardRead | null {
  'worklet';

  const winW = Math.max(1, Math.round(cardRect.w * config.rankWinW));
  const rankWin: Rect = {
    x: cardRect.x,
    y: cardRect.y,
    w: winW,
    h: Math.max(1, Math.round(cardRect.h * config.rankWinH)),
  };
  const pipTop = Math.round(cardRect.h * config.pipTop);
  const pipWin: Rect = {
    x: cardRect.x,
    y: cardRect.y + pipTop,
    w: winW,
    h: Math.max(1, Math.round(cardRect.h * config.pipBottom) - pipTop),
  };

  const rankPatch = inkPatch(rgb, frameW, frameH, rankWin, config);
  const pipPatch = inkPatch(rgb, frameW, frameH, pipWin, config);

  if (!rankPatch || !pipPatch) {
    return null;
  }

  const rankNorm = makeCroppedTemplate(
    rankPatch.data,
    rankPatch.w,
    rankPatch.h,
    config.rankTplW,
    config.rankTplH,
  );
  const rank = score(rankNorm, templates.ranks);

  const suitNorm = makeCroppedTemplate(
    pipPatch.data,
    pipPatch.w,
    pipPatch.h,
    config.suitTplW,
    config.suitTplH,
  );
  const suit = score(suitNorm, templates.suits);

  let suitIndex = suit.index;
  let suitBest = suit.best;
  let suitSecond = suit.second;

  // Colour veto only when shape is nearly a tie. The winner is then the best
  // shape *within the colour's suits*, and the margin is measured against the
  // runner-up in that same set — never against a suit the colour ruled out.
  if (suit.best - suit.second < config.minMargin) {
    const allowed = allowedSuits(pipPatch.r, pipPatch.g, pipPatch.b, config);

    let best = -Infinity;
    let second = -Infinity;
    let chosen = suit.index;

    for (const i of allowed) {
      const s = ncc(suitNorm, templates.suits[i] ?? suitNorm);

      if (s > best) {
        second = best;
        best = s;
        chosen = i;
      } else if (s > second) {
        second = s;
      }
    }

    suitIndex = chosen;
    suitBest = best;
    // A single-suit colour (♥ or ♦) is decisive; give it a clean margin.
    suitSecond = second === -Infinity ? 0 : second;
  }

  const confidence = Math.min(
    confidenceOf(rank.best, rank.second, config.minMargin),
    confidenceOf(suitBest, suitSecond, config.minMargin),
  );

  if (confidence <= 0) {
    return null;
  }

  const rankValue = RANKS[rank.index];
  const suitValue = SUITS[suitIndex];

  if (rankValue === undefined || suitValue === undefined) {
    return null;
  }

  return { card: makeCard(rankValue, suitValue), confidence };
}
