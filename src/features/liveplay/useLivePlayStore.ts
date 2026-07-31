/**
 * The live game the camera is watching, kept and appended to.
 *
 * Frames arrive through `ingestFrame` and fold into the fusion state; nothing
 * else in the app ever re-derives the board from a frame. Corrections are the
 * sanctioned exception to fusion's monotonicity: they act here, as explicit
 * user intent, never from vision. A card the user rejects goes on the dead
 * list so the camera cannot resurrect it within the hand.
 */

import { create } from 'zustand';

import { formatCard, type Card, type DecisionReview } from '@/engine';
import { getHandHistoryRepo, HandArchiver } from '@/services/handHistory';
import { type FrameDetections } from '@/services/vision';

import { emptyFusion, fuseFrame, type FusionState } from './fusion';
import { LIVE_BIG_BLIND, MAX_LIVE_OPPONENTS, MIN_LIVE_OPPONENTS } from './liveHandState';
import { buildObservedHand } from './observedHand';

/** Pot and bet facing hero, entered by tap, in big blinds. */
export interface PotEntry {
  pot: number;
  toCall: number;
}

export type LivePlayPhase = 'setup' | 'watching';

interface LivePlayState {
  phase: LivePlayPhase;
  heroCards: readonly [Card, Card] | null;
  opponents: number;
  heroStackBb: number;
  fusion: FusionState;
  potEntry: PotEntry | null;
  /** Cards the user rejected or corrected away this hand; dead to fusion. */
  rejected: readonly Card[];
  /** Advice issued this hand, in order, for the archived record. */
  reviews: readonly DecisionReview[];
  handsObserved: number;
  /** Set when a hand boundary fires; the screen archives and starts the next. */
  handEnded: boolean;
  /** Whether observed hands are reaching the history store. */
  saveStatus: 'ok' | 'error';

  setHeroCards: (cards: readonly [Card, Card] | null) => void;
  setOpponents: (count: number) => void;
  setHeroStackBb: (stack: number) => void;
  beginWatching: () => void;
  ingestFrame: (frame: FrameDetections) => void;
  setPotEntry: (entry: PotEntry) => void;
  clearPotEntry: () => void;
  confirmCandidate: (card: Card) => void;
  rejectCandidate: (card: Card) => void;
  correctBoardCard: (index: number, card: Card) => void;
  recordAdvice: (review: DecisionReview) => void;
  endHand: () => void;
  startNextHand: () => void;
  reset: () => void;
}

/**
 * One archiver per LivePlay visit: its lazily created session row groups the
 * hands watched in a sitting, and `reset` retires it so the next visit gets a
 * fresh session. Module state rather than store state — it is a write queue,
 * not something a component renders.
 */
let archiver: HandArchiver | null = null;

/** Resolves when every enqueued hand write has settled. Tests drain on this. */
export function drainLiveArchive(): Promise<void> {
  return archiver?.idle() ?? Promise.resolve();
}

/** A stable per-hand seed from what was observed — same hand, same record. */
function seedForHand(
  hero: readonly [Card, Card],
  board: readonly Card[],
  handNumber: number,
): number {
  const key = `${hero.map(formatCard).join('')}|${board.map(formatCard).join('')}|${handNumber}`;
  let hash = 0x811c9dc5;

  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

const initialState = {
  phase: 'setup' as LivePlayPhase,
  heroCards: null,
  opponents: 2,
  heroStackBb: 100,
  fusion: emptyFusion(),
  potEntry: null,
  rejected: [] as readonly Card[],
  reviews: [] as readonly DecisionReview[],
  handsObserved: 0,
  handEnded: false,
  saveStatus: 'ok' as const,
};

export const useLivePlayStore = create<LivePlayState>((set, get) => ({
  ...initialState,

  setHeroCards: (heroCards) => set({ heroCards }),

  setOpponents: (count) =>
    set({ opponents: Math.min(MAX_LIVE_OPPONENTS, Math.max(MIN_LIVE_OPPONENTS, count)) }),

  setHeroStackBb: (stack) => set({ heroStackBb: Math.max(1, stack) }),

  beginWatching: () => {
    if (get().heroCards) {
      set({ phase: 'watching' });
    }
  },

  ingestFrame: (frame) => {
    const state = get();

    if (state.phase !== 'watching' || state.handEnded) {
      return;
    }

    const dead = [...(state.heroCards ?? []), ...state.rejected];
    const fusion = fuseFrame(state.fusion, frame, { dead });

    if (fusion.handEnded) {
      set({ fusion, handEnded: true });

      return;
    }

    // A new street makes the old pot entry a lie; clear it rather than let
    // advice quote a bet that is no longer being faced.
    if (fusion.board.length !== state.fusion.board.length) {
      set({ fusion, potEntry: null });

      return;
    }

    set({ fusion });
  },

  setPotEntry: (potEntry) =>
    set({
      potEntry: { pot: Math.max(0, potEntry.pot), toCall: Math.max(0, potEntry.toCall) },
    }),

  clearPotEntry: () => set({ potEntry: null }),

  confirmCandidate: (card) =>
    set((state) => {
      const candidate = state.fusion.candidates.find((c) => c.card === card);

      if (!candidate || state.fusion.board.length >= 5) {
        return state;
      }

      return {
        fusion: {
          ...state.fusion,
          board: [...state.fusion.board, card],
          candidates: state.fusion.candidates.filter((c) => c.card !== card),
        },
        potEntry: null,
      };
    }),

  rejectCandidate: (card) =>
    set((state) => ({
      fusion: {
        ...state.fusion,
        candidates: state.fusion.candidates.filter((c) => c.card !== card),
      },
      rejected: [...state.rejected, card],
    })),

  correctBoardCard: (index, card) =>
    set((state) => {
      const previous = state.fusion.board[index];

      if (previous === undefined || state.fusion.board.includes(card)) {
        return state;
      }

      const board = state.fusion.board.map((existing, at) => (at === index ? card : existing));

      return {
        fusion: { ...state.fusion, board },
        rejected: [...state.rejected, previous],
        potEntry: null,
      };
    }),

  recordAdvice: (review) =>
    set((state) => {
      const last = state.reviews[state.reviews.length - 1];

      // The same spot recomputing — a re-render, a cleared and re-entered pot —
      // must not archive the same advice twice.
      if (last && last.reason === review.reason && last.facts.street === review.facts.street) {
        return state;
      }

      return { reviews: [...state.reviews, review] };
    }),

  endHand: () => set({ handEnded: true }),

  startNextHand: () => {
    const state = get();

    // Only a hand that was actually watched — hero cards entered — is worth a
    // row. The write is queued; the next hand starts immediately.
    if (state.heroCards) {
      archiver ??= new HandArchiver(
        getHandHistoryRepo,
        {
          style: 'cash',
          seed: seedForHand(state.heroCards, state.fusion.board, 1),
          heroSeat: 0,
          blinds: { smallBlind: LIVE_BIG_BLIND / 2, bigBlind: LIVE_BIG_BLIND },
          origin: 'live',
        },
        (saveStatus) => set({ saveStatus }),
      );

      archiver.recordHand(
        buildObservedHand({
          handNumber: state.handsObserved + 1,
          heroCards: state.heroCards,
          board: state.fusion.board,
          opponents: state.opponents,
          heroStackBb: state.heroStackBb,
          reviews: state.reviews,
          seed: seedForHand(state.heroCards, state.fusion.board, state.handsObserved + 1),
        }),
      );
    }

    set((current) => ({
      fusion: emptyFusion(),
      heroCards: null,
      potEntry: null,
      rejected: [],
      reviews: [],
      handEnded: false,
      phase: 'setup',
      handsObserved: current.handsObserved + 1,
    }));
  },

  reset: () => {
    archiver = null;
    set({ ...initialState, fusion: emptyFusion() });
  },
}));

/** Hero and board cards in play, for greying pickers and killing detections. */
export function liveUsedCards(state: {
  heroCards: readonly [Card, Card] | null;
  fusion: FusionState;
}): Card[] {
  return [...(state.heroCards ?? []), ...state.fusion.board];
}
