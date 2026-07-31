/**
 * The TFLite card detector — the only file in the app that touches
 * react-native-fast-tflite. Everything else consumes `FrameDetections`.
 *
 * The model file in `assets/models` is a placeholder; loading it throws, the
 * caller reports `unavailable`, and LivePlay runs its demo feed instead. Drop
 * a real export in locally for device testing (see the assets README).
 */

import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';

import { buildClassTable, DEFAULT_CLASS_NAMES } from './classMap';
import { type TensorLayout } from './decodeDetections';

/** The detector's square input edge, in pixels. Static-shape export. */
export const MODEL_INPUT_SIZE = 320;

export interface CardModel {
  model: TensorflowModel;
  layout: TensorLayout;
}

/**
 * Loads the bundled detector, Core ML-accelerated where the device offers it.
 * Rejects when the bundled file is not a real model — the caller's fallback
 * path, not an app error.
 */
export async function loadCardModel(): Promise<CardModel> {
  const model = await loadTensorflowModel(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../../../assets/models/cards.tflite') as number,
    ['core-ml'],
  );

  const outputShape = model.outputs[0]?.shape ?? [];
  const anchors = outputShape[outputShape.length - 1] ?? 0;

  if (anchors <= 0) {
    throw new Error('Card model has no anchor dimension; not a YOLO-style export.');
  }

  return {
    model,
    layout: {
      anchors,
      inputSize: MODEL_INPUT_SIZE,
      classes: buildClassTable(DEFAULT_CLASS_NAMES),
    },
  };
}
