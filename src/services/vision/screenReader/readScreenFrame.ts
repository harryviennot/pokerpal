/**
 * One RGB frame in, detected cards out — the reader's composition point.
 *
 * Segment the frame into card blobs, zone them into board / hero / other, read
 * the rank and suit of each board and hero card, and emit one `DetectedCard`
 * per identity with a normalized box and its zone. Everything above this
 * (fusion, the store) already speaks `DetectedCard`, so nothing downstream
 * knows the model was replaced by a screen reader.
 *
 * Worklet-safe; runs on the camera frame thread.
 */

import { DEFAULT_SCREEN_READER, type ScreenReaderConfig } from './config';
import { type Rect } from './geometry';
import { readCardFace } from './glyphs';
import { binarize, filterComponents, labelComponents } from './segment';
import { type GlyphTemplates } from './templates';
import { classifyZones } from './zones';
import { type DetectedCard } from '../types';

/** Scales a grid-space rect back to full-resolution pixels. */
function toPixels(rect: Rect, stride: number): Rect {
  'worklet';

  return { x: rect.x * stride, y: rect.y * stride, w: rect.w * stride, h: rect.h * stride };
}

export function readScreenFrame(
  rgb: Uint8Array,
  width: number,
  height: number,
  templates: GlyphTemplates,
  config: ScreenReaderConfig = DEFAULT_SCREEN_READER,
): DetectedCard[] {
  'worklet';

  const mask = binarize(rgb, width, height, config);
  const { singles, fans } = filterComponents(labelComponents(mask), mask.gw, mask.gh, config);
  const regions = classifyZones(singles, fans, mask, config);

  const byCard = new Map<number, DetectedCard>();

  for (const region of regions) {
    if (region.zone !== 'board' && region.zone !== 'hero') {
      continue;
    }

    const px = toPixels(region.rect, mask.stride);
    const read = readCardFace(rgb, width, height, px, templates, config);

    if (!read) {
      continue;
    }

    const detection: DetectedCard = {
      card: read.card,
      confidence: read.confidence,
      bbox: { x: px.x / width, y: px.y / height, width: px.w / width, height: px.h / height },
      zone: region.zone,
    };

    // One entry per identity: the stronger read wins. A card seen in two zones
    // in one frame is impossible in a real hand; keeping the best is safe.
    const existing = byCard.get(read.card);

    if (!existing || detection.confidence > existing.confidence) {
      byCard.set(read.card, detection);
    }
  }

  return [...byCard.values()];
}
