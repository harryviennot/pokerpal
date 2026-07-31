/**
 * Which card slot is the board, which is the hero, which to ignore.
 *
 * Geometry alone decides, because the scene is our own: the community cards
 * are a horizontal row across the vertical middle, the hero's pair is a low
 * central fan, and everything else — opponent showdowns near the edges, stray
 * pills — is `other` and never read.
 */

import { type CardZone } from '../types';
import { type ScreenReaderConfig } from './config';
import { rectCentreX, rectCentreY, type Rect } from './geometry';
import { splitHeroFan, type Mask } from './segment';

export interface ZonedRegion {
  /** One card slot, in grid coordinates. */
  rect: Rect;
  zone: CardZone;
}

/** True when the rect's centre sits in the hero band, low and central. */
function isHeroSingle(rect: Rect, gw: number, gh: number, config: ScreenReaderConfig): boolean {
  'worklet';

  const cy = rectCentreY(rect) / gh;
  const cx = rectCentreX(rect) / gw;

  return cy >= config.heroBandMin && cx >= config.heroCentreMin && cx <= config.heroCentreMax;
}

/** The largest set of rects sharing a y-centre, in left-to-right order. */
function alignedRow(rects: readonly Rect[], config: ScreenReaderConfig): Rect[] {
  'worklet';

  if (rects.length === 0) {
    return [];
  }

  let best: Rect[] = [];

  for (const anchor of rects) {
    const anchorCy = rectCentreY(anchor);
    const tolerance = anchor.h * config.rowYTolerance;
    const group = rects.filter((rect) => Math.abs(rectCentreY(rect) - anchorCy) <= tolerance);

    if (group.length > best.length) {
      best = group;
    }
  }

  return [...best].sort((a, b) => rectCentreX(a) - rectCentreX(b));
}

/**
 * Assigns every filtered blob a zone. Hero first (fan blob, or a low central
 * pair of singles), then the board row from what remains in the middle band,
 * then everything left over as `other`.
 */
export function classifyZones(
  singles: readonly Rect[],
  fans: readonly Rect[],
  mask: Mask,
  config: ScreenReaderConfig,
): ZonedRegion[] {
  'worklet';

  const { gw, gh } = mask;
  const regions: ZonedRegion[] = [];

  // Hero from a fan blob low in the frame — the common case.
  let heroClaimed = false;

  for (const fan of fans) {
    if (rectCentreY(fan) / gh >= config.heroBandMin) {
      const [left, right] = splitHeroFan(fan, mask);

      regions.push({ rect: left, zone: 'hero' }, { rect: right, zone: 'hero' });
      heroClaimed = true;
    } else {
      regions.push({ rect: fan, zone: 'other' });
    }
  }

  // Hero from two low central singles, when the reader split the pair itself.
  const heroSingles = singles.filter((rect) => isHeroSingle(rect, gw, gh, config));
  const boardCandidates: Rect[] = [];

  for (const rect of singles) {
    if (!heroClaimed && heroSingles.length === 2 && heroSingles.includes(rect)) {
      regions.push({ rect, zone: 'hero' });
      continue;
    }

    if (isHeroSingle(rect, gw, gh, config)) {
      // A lone low-central single with no partner is not a board card either.
      regions.push({ rect, zone: 'other' });
      continue;
    }

    boardCandidates.push(rect);
  }

  // The board row: mid-band singles that share a y-centre. In our scene the
  // only mid-band white cards are the community cards, so the largest aligned
  // mid-band cluster is the board.
  const midBand = boardCandidates.filter((rect) => {
    const cy = rectCentreY(rect) / gh;

    return cy >= config.boardBandMin && cy <= config.boardBandMax;
  });

  const rowCards = alignedRow(midBand, config);

  for (const rect of boardCandidates) {
    regions.push({ rect, zone: rowCards.includes(rect) ? 'board' : 'other' });
  }

  return regions;
}
