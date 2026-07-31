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
import { type DetectedCard, type FrameDetections, type NormalizedRect } from '@/services/vision';

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

/**
 * The hero's own two cards, tracked separately from the board.
 *
 * A separate channel because the rules differ: the pair locks together or not
 * at all, it locks once per hand, and its sightings persist for the whole hand
 * rather than arriving street by street.
 */
export interface HeroTrack {
  /** The locked pair, left to right. Immutable to vision once set. */
  cards: readonly [Card, Card] | null;
  candidates: readonly TrackedCandidate[];
}

export interface FusionState {
  /** The locked board, append-only within a hand. */
  board: readonly Card[];
  candidates: readonly TrackedCandidate[];
  hero: HeroTrack;
  /** Consecutive frames in which the camera saw no *board* cards at all. */
  emptyStreak: number;
  /** Proposed hand boundary; the store consumes it and resets. */
  handEnded: boolean;
}

const EMPTY_HERO: HeroTrack = { cards: null, candidates: [] };

export function emptyFusion(): FusionState {
  return { board: [], candidates: [], hero: EMPTY_HERO, emptyStreak: 0, handEnded: false };
}

export interface FuseOptions {
  /** Cards fusion may never audition — the hero's own, plus corrections. */
  dead?: readonly Card[];
  config?: Partial<FusionConfig>;
}

const BOARD_MAX = 5;
const FLOP_SIZE = 3;
const HERO_SIZE = 2;

/**
 * Advances a candidate set by one frame: a sighting is a hit, absence is a
 * miss, blocked identities never audition, and a candidate written off as a
 * misread is dropped. Shared by both channels — the rules for *becoming*
 * confirmed are the same everywhere; only what happens on confirmation differs.
 */
function advanceCandidates(
  previous: readonly TrackedCandidate[],
  seen: Map<Card, DetectedCard>,
  blocked: Set<Card>,
  admitNew: boolean,
  config: FusionConfig,
): TrackedCandidate[] {
  const candidates = previous
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

  if (admitNew) {
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

  return candidates;
}

/** Folds one frame into the state. The only writer of `FusionState`. */
export function fuseFrame(
  state: FusionState,
  frame: FrameDetections,
  options: FuseOptions = {},
): FusionState {
  const config: FusionConfig = { ...DEFAULT_FUSION, ...options.config };
  const dead = options.dead ?? [];

  const confidentAll = frame.cards.filter((d) => d.confidence >= config.minConfidence);
  // Zone routing. `other` is discarded outright; a detection with no zone is a
  // board card, which is what every pre-zone script and fixture means.
  const confident = confidentAll.filter((d) => d.zone === undefined || d.zone === 'board');
  const heroSeen = confidentAll.filter((d) => d.zone === 'hero');

  // Only an empty *board* advances the boundary clock. The hero's cards are on
  // screen for the whole hand, so counting them would keep a hand from ever
  // ending — and a locked board card sighting still means a live table.
  const emptyStreak = confident.length === 0 ? state.emptyStreak + 1 : 0;

  const capacity = state.board.length === 0 ? FLOP_SIZE : state.board.length < BOARD_MAX ? 1 : 0;

  // A card that is locked anywhere — board or hero — or explicitly dead never
  // auditions in either channel.
  const seen = new Map(confident.map((d) => [d.card, d]));
  const blocked = new Set<Card>([...state.board, ...(state.hero.cards ?? []), ...dead]);

  let candidates = advanceCandidates(state.candidates, seen, blocked, capacity > 0, config);

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

  // The hero channel. Once the pair is locked it is inert for the hand: the
  // cards stay on screen, and re-reading them could only ever change a truth
  // the player is already acting on.
  let hero = state.hero;

  if (hero.cards === null) {
    const heroMap = new Map(heroSeen.map((d) => [d.card, d]));
    let heroCandidates = advanceCandidates(hero.candidates, heroMap, blocked, true, config);
    const ready = heroCandidates
      .filter((candidate) => candidate.hits >= config.lockHits)
      .sort((a, b) => b.bestConfidence - a.bestConfidence);

    // Two together or nothing: one confirmed card is half a hand, and half a
    // hand cannot be graded.
    if (ready.length >= HERO_SIZE) {
      const pair = ready.slice(0, HERO_SIZE).sort((a, b) => centerX(a.bbox) - centerX(b.bbox));

      hero = { cards: [pair[0]!.card, pair[1]!.card], candidates: [] };
    } else if (heroCandidates.length === 0 && hero.candidates.length === 0) {
      heroCandidates = hero.candidates as TrackedCandidate[];
      hero = { cards: null, candidates: heroCandidates };
    } else {
      hero = { cards: null, candidates: heroCandidates };
    }
  }

  const handEnded = emptyStreak >= config.handEndFrames && board.length >= FLOP_SIZE;

  // The steady state — locked board, nothing auditioning — keeps its array
  // references, so store selectors over `board` and `candidates` see the same
  // values frame after frame and React stays idle at 10 Hz.
  if (candidates.length === 0 && state.candidates.length === 0) {
    candidates = state.candidates as TrackedCandidate[];
  }

  if (hero.cards === state.hero.cards && hero.candidates === state.hero.candidates) {
    hero = state.hero;
  }

  return { board, candidates, hero, emptyStreak, handEnded };
}

function centerX(bbox: NormalizedRect): number {
  return bbox.x + bbox.width / 2;
}
