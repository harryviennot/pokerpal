/**
 * Detection frames without a camera.
 *
 * The vision layer's `memoryRepo`: builders that synthesize `FrameDetections`
 * sequences for the fusion tests, the screen tests, and the in-app demo mode.
 * Pure data — the caller decides when each frame is "played".
 */

import { type Card } from '@/engine';

import {
  type CardZone,
  type DetectedCard,
  type FrameDetections,
  type NormalizedRect,
} from './types';

export type DetectionScript = readonly FrameDetections[];

/** A card in a scripted frame; confidence, box and zone are optional stage props. */
export interface ScriptedCard {
  card: Card;
  confidence?: number;
  bbox?: NormalizedRect;
  zone?: CardZone;
}

const DEFAULT_CONFIDENCE = 0.9;

/**
 * One frame showing the given cards, laid left to right in the order given
 * unless a card brings its own box.
 */
export function frameOf(cards: readonly (Card | ScriptedCard)[], timestampMs = 0): FrameDetections {
  const detections: DetectedCard[] = cards.map((entry, index) => {
    const scripted: ScriptedCard = typeof entry === 'number' ? { card: entry } : entry;

    return {
      card: scripted.card,
      confidence: scripted.confidence ?? DEFAULT_CONFIDENCE,
      bbox: scripted.bbox ?? slotBox(index),
      ...(scripted.zone === undefined ? {} : { zone: scripted.zone }),
    };
  });

  return { cards: detections, timestampMs };
}

/** The hero's two hole cards, as a fanned pair at the bottom of the frame. */
export function heroPair(cards: readonly [Card, Card]): readonly ScriptedCard[] {
  return [
    { card: cards[0], zone: 'hero', bbox: heroSlotBox(0) },
    { card: cards[1], zone: 'hero', bbox: heroSlotBox(1) },
  ];
}

/** The same cards, seen steadily for `count` frames. */
export function steadyFrames(
  cards: readonly (Card | ScriptedCard)[],
  count: number,
): DetectionScript {
  return Array.from({ length: count }, (_, index) => frameOf(cards, index));
}

/** Frames in which the camera sees no cards at all. */
export function emptyFrames(count: number): DetectionScript {
  return Array.from({ length: count }, (_, index) => frameOf([], index));
}

/**
 * Cards that flicker: seen for `on` frames, gone for `off`, and so on for
 * `cycles` rounds — glare and a hovering hand look exactly like this.
 */
export function flicker(
  cards: readonly (Card | ScriptedCard)[],
  on: number,
  off: number,
  cycles: number,
): DetectionScript {
  const script: FrameDetections[] = [];

  for (let cycle = 0; cycle < cycles; cycle++) {
    script.push(...steadyFrames(cards, on), ...emptyFrames(off));
  }

  return script.map((frame, index) => ({ ...frame, timestampMs: index }));
}

/** The default stage position of the `index`-th board card in a frame. */
export function slotBox(index: number): NormalizedRect {
  return { x: 0.1 + index * 0.16, y: 0.4, width: 0.12, height: 0.2 };
}

/** The stage position of the `index`-th hero card: a low, centred fanned pair. */
export function heroSlotBox(index: 0 | 1): NormalizedRect {
  return { x: 0.4 + index * 0.1, y: 0.74, width: 0.13, height: 0.16 };
}
