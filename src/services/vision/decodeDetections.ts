/**
 * Raw model output to `DetectedCard[]`.
 *
 * Written against the YOLO single-stage export shape: one channel-major tensor
 * of `[4 box values + one score per class] × anchors`, boxes as center/size in
 * input-image pixels. Both the real frame processor and the fixture tests call
 * this same function — it is the contract a replacement model must meet.
 *
 * Worklet-safe on purpose: plain loops, no captured state, no allocation beyond
 * the result. It runs inside the camera's frame worklet at 10 Hz.
 */

import { type Card } from '@/engine';

import { type DetectedCard, type NormalizedRect } from './types';

export interface TensorLayout {
  /** Anchor (candidate box) count — the tensor's minor dimension. */
  anchors: number;
  /** Model input edge in pixels; boxes are normalized by it. Square inputs. */
  inputSize: number;
  /** Class index to card, from `buildClassTable`. */
  classes: readonly Card[];
}

export interface DecodeConfig {
  /** Candidates below this score never leave the decoder. */
  minConfidence: number;
  /** Boxes of the same identity overlapping past this are one detection. */
  iouThreshold: number;
}

export const DEFAULT_DECODE: DecodeConfig = {
  minConfidence: 0.35,
  iouThreshold: 0.5,
};

// The worklet transform turns these declarations into assignments, and a
// worklet captures what its helpers are worth at definition time — so the
// helpers must be defined before the function that calls them.

/** Intersection over union of two normalized boxes, 0 to 1. */
export function iou(a: NormalizedRect, b: NormalizedRect): number {
  'worklet';

  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);

  const overlap = Math.max(0, right - left) * Math.max(0, bottom - top);

  if (overlap === 0) {
    return 0;
  }

  return overlap / (a.width * a.height + b.width * b.height - overlap);
}

function clamp01(value: number): number {
  'worklet';

  return Math.min(1, Math.max(0, value));
}

/**
 * Decodes one output tensor. Returns at most one entry per card identity —
 * the highest-scoring box wins, which is what a 52-identity domain allows and
 * what fusion upstream depends on.
 */
export function decodeDetections(
  output: Float32Array,
  layout: TensorLayout,
  config: DecodeConfig = DEFAULT_DECODE,
): DetectedCard[] {
  'worklet';

  const { anchors, inputSize, classes } = layout;
  const classCount = classes.length;

  const kept: DetectedCard[] = [];

  for (let anchor = 0; anchor < anchors; anchor++) {
    let bestClass = -1;
    let bestScore = 0;

    for (let cls = 0; cls < classCount; cls++) {
      const score = output[(4 + cls) * anchors + anchor] ?? 0;

      if (score > bestScore) {
        bestScore = score;
        bestClass = cls;
      }
    }

    if (bestClass < 0 || bestScore < config.minConfidence) {
      continue;
    }

    const cx = output[0 * anchors + anchor] ?? 0;
    const cy = output[1 * anchors + anchor] ?? 0;
    const w = output[2 * anchors + anchor] ?? 0;
    const h = output[3 * anchors + anchor] ?? 0;

    const bbox: NormalizedRect = {
      x: clamp01((cx - w / 2) / inputSize),
      y: clamp01((cy - h / 2) / inputSize),
      width: clamp01(w / inputSize),
      height: clamp01(h / inputSize),
    };

    const card = classes[bestClass];

    if (card === undefined) {
      continue;
    }

    // One box per identity: keep the strongest, drop the rest. This covers
    // classic NMS too — two boxes on one physical card carry one identity.
    let replaced = false;

    for (let i = 0; i < kept.length; i++) {
      const existing = kept[i];

      if (existing === undefined || existing.card !== card) {
        continue;
      }

      if (bestScore > existing.confidence) {
        kept[i] = { card, confidence: bestScore, bbox };
      }

      replaced = true;
      break;
    }

    if (!replaced) {
      kept.push({ card, confidence: bestScore, bbox });
    }
  }

  // Cross-identity NMS: overlapping boxes of different identities are the model
  // reading one physical card two ways — keep the stronger read only.
  const result: DetectedCard[] = [];

  for (let i = 0; i < kept.length; i++) {
    const candidate = kept[i];

    if (candidate === undefined) {
      continue;
    }

    let suppressed = false;

    for (let j = 0; j < kept.length; j++) {
      const other = kept[j];

      if (j === i || other === undefined) {
        continue;
      }

      if (
        other.confidence > candidate.confidence &&
        iou(candidate.bbox, other.bbox) > config.iouThreshold
      ) {
        suppressed = true;
        break;
      }
    }

    if (!suppressed) {
      result.push(candidate);
    }
  }

  return result;
}
