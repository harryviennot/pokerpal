/**
 * The camera-to-detections bridge: the only worklet code in the feature.
 *
 * Each frame arrives RGB at the reader's working resolution (the camera
 * pipeline does the scaling), runs through the screen reader synchronously on
 * the frame thread, and is posted to the React side — where a 10 Hz gate keeps
 * fusion fed at the rate its confirmation windows are tuned for.
 *
 * The glyph templates are rendered once at startup on the JS thread and
 * captured by the worklet as plain typed arrays. When they cannot be rendered
 * (no Skia), the status reads `unavailable` and the caller shows the demo feed.
 */

import { useMemo, useRef, useState } from 'react';
import { useFrameOutput, type CameraFrameOutput } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

import { readScreenFrame, type FrameDetections, type GlyphTemplates } from '@/services/vision';
import { renderGlyphTemplates } from '@/services/vision/screenReader/renderTemplates';

export type DetectorStatus = 'ready' | 'unavailable';

/** Fusion's confirmation windows are tuned for this cadence. */
const POST_INTERVAL_MS = 100;

/**
 * Portrait working resolution. Wide enough that a board card lands ~35-45 px
 * across and a rank glyph ~12-16 px — the floor for a reliable correlation
 * after resampling — and no wider, because segmentation cost scales with it.
 * A device-tuning constant: the first thing to move if frames are dropped.
 */
const PROCESS_WIDTH = 640;
const PROCESS_HEIGHT = 1138;

export function useCardFrameProcessor(post: (frame: FrameDetections) => void): {
  status: DetectorStatus;
  frameOutput: CameraFrameOutput;
} {
  // Rendered once per mount, lazily: seventeen small glyphs, synchronous, and
  // the worklet needs the result on the very first frame — so it is computed
  // here rather than in an effect, which would spend a render on `null`.
  const [templates] = useState<GlyphTemplates | null>(renderGlyphTemplates);
  const status: DetectorStatus = templates ? 'ready' : 'unavailable';
  const lastPostAt = useRef(0);

  // The receiving gate runs on the React side, where state is cheap; the
  // worklet stays stateless. Stamped here too — the React clock is the one the
  // gate compares against, and the frame's own timestamp unit is the camera
  // pipeline's business. Work between posts is bounded by
  // `dropFramesWhileBusy` and tuned in the device pass, not here.
  const gatedPost = (cards: FrameDetections['cards']): void => {
    const now = Date.now();

    if (now - lastPostAt.current < POST_INTERVAL_MS) {
      return;
    }

    lastPostAt.current = now;
    post({ cards, timestampMs: now });
  };

  // Pinned so the worklet closure captures one object for the mount's life
  // rather than a fresh one every render.
  const pinned = useMemo(() => templates, [templates]);

  const frameOutput = useFrameOutput({
    targetResolution: { width: PROCESS_WIDTH, height: PROCESS_HEIGHT },
    pixelFormat: 'rgb',
    dropFramesWhileBusy: true,
    onFrame: (frame) => {
      'worklet';

      try {
        if (pinned === null || !frame.isValid) {
          return;
        }

        const pixels = new Uint8Array(frame.getPixelBuffer());
        const detections = readScreenFrame(pixels, frame.width, frame.height, pinned);

        scheduleOnRN(gatedPost, detections);
      } finally {
        frame.dispose();
      }
    },
  });

  return { status, frameOutput };
}
