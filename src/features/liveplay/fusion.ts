/**
 * Frames in, a stable board out.
 *
 * The camera reads the felt ten times a second and is sometimes wrong; the
 * game state must never be. This reducer stands between them: detections
 * audition as candidates, candidates that persist get locked, and a locked
 * card is beyond the camera's reach — only an explicit user correction (a
 * store action, not a frame) can change it. The state is kept and appended
 * to; nothing here ever re-derives a board from a single frame.
 *
 * Pure and deterministic: same frames in, same board out, no clock and no I/O.
 */

import { type Card } from '@/engine';
import { type FrameDetections, type NormalizedRect } from '@/services/vision';

export interface FusionConfig {
  /** Detections below this confidence never become candidates. */
  minConfidence: number;
  /** Frames a candidate must be seen before it can lock. */
  lockHits: number;
  /** Missed frames before an unlocked candidate is written off as a misread. */
  dropMisses: number;
  /** Consecutive cardless frames that read as "the table was cleared". */
  handEndFrames: number;
}

/**
 * Tuned for a 10 Hz detection rate: a lock takes ~0.6 s of persistence, a
 * misread has to survive ~0.8 s to matter, and a hand ends after ~2 s of
 * empty felt.
 */
export const DEFAULT_FUSION: FusionConfig = {
  minConfidence: 0.6,
  lockHits: 6,
  dropMisses: 8,
  handEndFrames: 20,
};

/** A card auditioning for the board. Identity is the track key: 52 identities
 * make box tracking unnecessary. */
export interface TrackedCandidate {
  card: Card;
  /** Frames this card was seen in. Not reset by a miss. */
  hits: number;
  /** Frames it was absent from since first seen. */
  misses: number;
  bestConfidence: number;
  /** Latest box, kept for on-screen chips and flop ordering. */
  bbox: NormalizedRect;
}

export interface FusionState {
  /** The locked board, append-only within a hand. */
  board: readonly Card[];
  candidates: readonly TrackedCandidate[];
  /** Consecutive frames in which the camera saw no cards at all. */
  emptyStreak: number;
  /** Proposed hand boundary; the store consumes it and resets. */
  handEnded: boolean;
}

export function emptyFusion(): FusionState {
  return { board: [], candidates: [], emptyStreak: 0, handEnded: false };
}

export interface FuseOptions {
  /** Cards fusion may never audition — the hero's own, plus corrections. */
  dead?: readonly Card[];
  config?: Partial<FusionConfig>;
}

const BOARD_MAX = 5;
const FLOP_SIZE = 3;

/** Folds one frame into the state. The only writer of `FusionState`. */
export function fuseFrame(
  state: FusionState,
  frame: FrameDetections,
  options: FuseOptions = {},
): FusionState {
  const config: FusionConfig = { ...DEFAULT_FUSION, ...options.config };
  const dead = options.dead ?? [];

  // A confident sighting of anything — locked cards included — is a live
  // table. Only a genuinely empty felt advances the boundary clock.
  const confident = frame.cards.filter((d) => d.confidence >= config.minConfidence);
  const emptyStreak = confident.length === 0 ? state.emptyStreak + 1 : 0;

  const capacity = state.board.length === 0 ? FLOP_SIZE : state.board.length < BOARD_MAX ? 1 : 0;

  // Candidates advance: a sighting is a hit, absence is a miss, and a card
  // that is locked, dead, or arriving on a full board never auditions.
  const seen = new Map(confident.map((d) => [d.card, d]));
  const blocked = new Set<Card>([...state.board, ...dead]);

  let candidates: TrackedCandidate[] = state.candidates
    .filter((candidate) => !blocked.has(candidate.card))
    .map((candidate) => {
      const sighting = seen.get(candidate.card);

      if (!sighting) {
        return { ...candidate, misses: candidate.misses + 1 };
      }

      return {
        ...candidate,
        hits: candidate.hits + 1,
        bestConfidence: Math.max(candidate.bestConfidence, sighting.confidence),
        bbox: sighting.bbox,
      };
    })
    .filter((candidate) => candidate.misses < config.dropMisses);

  if (capacity > 0) {
    const known = new Set(candidates.map((candidate) => candidate.card));

    for (const detection of seen.values()) {
      if (!blocked.has(detection.card) && !known.has(detection.card)) {
        candidates.push({
          card: detection.card,
          hits: 1,
          misses: 0,
          bestConfidence: detection.confidence,
          bbox: detection.bbox,
        });
      }
    }
  }

  // Locking. The flop commits as a set of three so a half-read flop never
  // shows as a one-card board; turn and river lock one at a time.
  let board = state.board;
  const eligible = candidates
    .filter((candidate) => candidate.hits >= config.lockHits)
    .sort((a, b) => b.bestConfidence - a.bestConfidence);

  if (capacity > 0 && eligible.length >= capacity) {
    const locking = eligible.slice(0, capacity);

    if (board.length === 0) {
      locking.sort((a, b) => centerX(a.bbox) - centerX(b.bbox));
    }

    board = [...board, ...locking.map((candidate) => candidate.card)];

    const lockedNow = new Set(locking.map((candidate) => candidate.card));

    candidates = candidates.filter((candidate) => !lockedNow.has(candidate.card));
  }

  const handEnded = emptyStreak >= config.handEndFrames && board.length >= FLOP_SIZE;

  return { board, candidates, emptyStreak, handEnded };
}

function centerX(bbox: NormalizedRect): number {
  return bbox.x + bbox.width / 2;
}
