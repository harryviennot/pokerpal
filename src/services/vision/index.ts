/**
 * On-device card detection.
 *
 * `types` is the contract, the `screenReader` turns camera frames into it, and
 * `scriptedSource` produces it with no camera at all. `renderTemplates` is
 * deliberately not re-exported: it is the only file that touches Skia, and
 * importing it here would drag a native module into Jest.
 */

export { DEFAULT_SCREEN_READER, type ScreenReaderConfig } from './screenReader/config';
export { type Rect } from './screenReader/geometry';
export { readScreenFrame } from './screenReader/readScreenFrame';
export {
  fakeTemplates,
  paintFrame,
  type PaintCard,
  type PaintedFrame,
  type PaintSpec,
} from './screenReader/synthetic';
export { type GlyphTemplates } from './screenReader/templates';
export {
  emptyFrames,
  flicker,
  frameOf,
  heroPair,
  heroSlotBox,
  slotBox,
  steadyFrames,
  type DetectionScript,
  type ScriptedCard,
} from './scriptedSource';
export {
  type CardZone,
  type DetectedCard,
  type FrameDetections,
  type NormalizedRect,
} from './types';
