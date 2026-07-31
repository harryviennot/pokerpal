/**
 * On-device card detection.
 *
 * `types` is the contract, `decodeDetections` turns model tensors into it, and
 * `scriptedSource` produces it with no camera at all. The TFLite wrapper in
 * `cardModel` is the only file here that touches a native module, and it is
 * deliberately not re-exported: importing it outside the frame processor would
 * drag native code into Jest.
 */

export { buildClassTable, DEFAULT_CLASS_NAMES } from './classMap';
export {
  decodeDetections,
  DEFAULT_DECODE,
  iou,
  type DecodeConfig,
  type TensorLayout,
} from './decodeDetections';
export {
  emptyFrames,
  flicker,
  frameOf,
  slotBox,
  steadyFrames,
  type DetectionScript,
  type ScriptedCard,
} from './scriptedSource';
export { type DetectedCard, type FrameDetections, type NormalizedRect } from './types';
