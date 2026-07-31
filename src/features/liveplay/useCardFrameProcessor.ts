/**
 * The camera-to-detections bridge: the only worklet code in the feature.
 *
 * Each frame arrives RGB at the model's input size (the camera pipeline does
 * the resize), runs through TFLite synchronously on the frame thread, decodes
 * to `FrameDetections`, and is posted to the React side — where a 10 Hz gate
 * keeps fusion fed at the rate its confirmation windows are tuned for.
 *
 * When the model cannot load (the checked-in file is a placeholder), the
 * status reads `unavailable` and the caller shows the demo feed instead.
 */

import { useEffect, useRef, useState } from 'react';
import { useFrameOutput, type CameraFrameOutput } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

import { decodeDetections, type FrameDetections } from '@/services/vision';
import { loadCardModel, MODEL_INPUT_SIZE, type CardModel } from '@/services/vision/cardModel';

export type DetectorStatus = 'loading' | 'ready' | 'unavailable';

/** Fusion's confirmation windows are tuned for this cadence. */
const POST_INTERVAL_MS = 100;

export function useCardFrameProcessor(post: (frame: FrameDetections) => void): {
  status: DetectorStatus;
  frameOutput: CameraFrameOutput;
} {
  const [card, setCard] = useState<CardModel | null>(null);
  const [status, setStatus] = useState<DetectorStatus>('loading');
  const lastPostAt = useRef(0);

  useEffect(() => {
    let cancelled = false;

    loadCardModel()
      .then((loaded) => {
        if (!cancelled) {
          setCard(loaded);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('unavailable');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // The receiving gate runs on the React side, where state is cheap; the
  // worklet stays stateless. Stamped here too — the React clock is the one
  // the gate compares against, and the frame's own timestamp unit is the
  // camera pipeline's business. Inference between posts is bounded by
  // `dropFramesWhileBusy` and tuned in the device pass, not here.
  const gatedPost = (cards: FrameDetections['cards']): void => {
    const now = Date.now();

    if (now - lastPostAt.current < POST_INTERVAL_MS) {
      return;
    }

    lastPostAt.current = now;
    post({ cards, timestampMs: now });
  };

  const model = card?.model ?? null;
  const layout = card?.layout ?? null;

  const frameOutput = useFrameOutput({
    targetResolution: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE },
    pixelFormat: 'rgb',
    dropFramesWhileBusy: true,
    onFrame: (frame) => {
      'worklet';

      try {
        if (model === null || layout === null || !frame.isValid) {
          return;
        }

        const outputs = model.runSync([frame.getPixelBuffer()]);
        const raw = outputs[0];

        if (raw === undefined) {
          return;
        }

        const detections = decodeDetections(new Float32Array(raw), layout);

        scheduleOnRN(gatedPost, detections);
      } finally {
        frame.dispose();
      }
    },
  });

  return { status, frameOutput };
}
