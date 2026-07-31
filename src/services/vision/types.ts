/**
 * What the camera saw in one frame, in card terms.
 *
 * The contract between the detection layer and everything above it. The real
 * producer is a frame processor running a TFLite model; the test producer is
 * `scriptedSource`. Consumers cannot tell them apart, which is the point: all
 * fusion and store logic is exercised in Jest with no camera in the room.
 */

import { type Card } from '@/engine';

/** A box in frame coordinates, every value 0 to 1 of the frame's extent. */
export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedCard {
  card: Card;
  /** Model confidence, 0 to 1. */
  confidence: number;
  bbox: NormalizedRect;
}

/** One processed frame. `cards` holds at most one entry per card identity. */
export interface FrameDetections {
  cards: readonly DetectedCard[];
  /** Milliseconds, from the producer's clock. Fusion counts frames, not time. */
  timestampMs: number;
}
