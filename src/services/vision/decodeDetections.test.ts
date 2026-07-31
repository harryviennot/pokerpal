import { parseCard } from '@/engine';

import { buildClassTable, DEFAULT_CLASS_NAMES } from './classMap';
import { decodeDetections, iou, type TensorLayout } from './decodeDetections';
import { type NormalizedRect } from './types';

const CLASSES = buildClassTable(DEFAULT_CLASS_NAMES);
const INPUT = 320;

interface FixtureBox {
  anchor: number;
  /** Center/size in input pixels, the YOLO export convention. */
  cx: number;
  cy: number;
  w: number;
  h: number;
  className: string;
  score: number;
}

/** A channel-major `[4 + classes] × anchors` tensor with the given boxes lit. */
function tensorOf(anchors: number, boxes: readonly FixtureBox[]): Float32Array {
  const output = new Float32Array((4 + CLASSES.length) * anchors);

  for (const box of boxes) {
    const cls = DEFAULT_CLASS_NAMES.indexOf(box.className);

    expect(cls).toBeGreaterThanOrEqual(0);

    output[0 * anchors + box.anchor] = box.cx;
    output[1 * anchors + box.anchor] = box.cy;
    output[2 * anchors + box.anchor] = box.w;
    output[3 * anchors + box.anchor] = box.h;
    output[(4 + cls) * anchors + box.anchor] = box.score;
  }

  return output;
}

const layout: TensorLayout = { anchors: 8, inputSize: INPUT, classes: CLASSES };

describe('decodeDetections', () => {
  it('decodes a confident box to the card and a normalized rect', () => {
    const output = tensorOf(8, [
      { anchor: 2, cx: 160, cy: 160, w: 64, h: 96, className: 'AS', score: 0.92 },
    ]);

    const detections = decodeDetections(output, layout);

    expect(detections).toHaveLength(1);
    expect(detections[0]?.card).toBe(parseCard('As'));
    expect(detections[0]?.confidence).toBeCloseTo(0.92);
    expect(detections[0]?.bbox).toEqual<NormalizedRect>({
      x: (160 - 32) / INPUT,
      y: (160 - 48) / INPUT,
      width: 64 / INPUT,
      height: 96 / INPUT,
    });
  });

  it('drops boxes below the confidence gate', () => {
    const output = tensorOf(8, [
      { anchor: 0, cx: 100, cy: 100, w: 50, h: 70, className: 'KD', score: 0.2 },
    ]);

    expect(decodeDetections(output, layout)).toHaveLength(0);
  });

  it('keeps only the strongest box per card identity', () => {
    const output = tensorOf(8, [
      { anchor: 0, cx: 100, cy: 100, w: 50, h: 70, className: 'QH', score: 0.6 },
      { anchor: 1, cx: 104, cy: 102, w: 50, h: 70, className: 'QH', score: 0.85 },
    ]);

    const detections = decodeDetections(output, layout);

    expect(detections).toHaveLength(1);
    expect(detections[0]?.confidence).toBeCloseTo(0.85);
  });

  it('suppresses the weaker of two identities read off one physical card', () => {
    // Same spot on the table read as 7♥ and 7♦ — the classic misread pair.
    const output = tensorOf(8, [
      { anchor: 0, cx: 100, cy: 100, w: 50, h: 70, className: '7H', score: 0.9 },
      { anchor: 1, cx: 102, cy: 101, w: 50, h: 70, className: '7D', score: 0.55 },
    ]);

    const detections = decodeDetections(output, layout);

    expect(detections).toHaveLength(1);
    expect(detections[0]?.card).toBe(parseCard('7h'));
  });

  it('keeps distinct cards sitting apart on the felt', () => {
    const output = tensorOf(8, [
      { anchor: 0, cx: 60, cy: 160, w: 50, h: 70, className: 'AH', score: 0.9 },
      { anchor: 1, cx: 160, cy: 160, w: 50, h: 70, className: 'KH', score: 0.88 },
      { anchor: 2, cx: 260, cy: 160, w: 50, h: 70, className: 'QH', score: 0.86 },
    ]);

    expect(decodeDetections(output, layout)).toHaveLength(3);
  });

  it('reads an empty tensor as an empty frame', () => {
    expect(decodeDetections(new Float32Array((4 + 52) * 8), layout)).toHaveLength(0);
  });
});

describe('iou', () => {
  const unit: NormalizedRect = { x: 0, y: 0, width: 0.2, height: 0.2 };

  it('is 1 for identical boxes and 0 for disjoint ones', () => {
    expect(iou(unit, unit)).toBe(1);
    expect(iou(unit, { x: 0.5, y: 0.5, width: 0.2, height: 0.2 })).toBe(0);
  });

  it('is the overlap share for partial overlap', () => {
    const shifted: NormalizedRect = { x: 0.1, y: 0, width: 0.2, height: 0.2 };

    // Overlap 0.1×0.2; union 2×0.04 − 0.02.
    expect(iou(unit, shifted)).toBeCloseTo(0.02 / 0.06);
  });
});
