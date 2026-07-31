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

import { type Card, type DecisionReview } from '@/engine';
import { type FrameDetections } from '@/services/vision';

import { emptyFusion, fuseFrame, type FusionState } from './fusion';
import { MAX_LIVE_OPPONENTS, MIN_LIVE_OPPONENTS } from './liveHandState';

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

  recordAdvice: (review) => set((state) => ({ reviews: [...state.reviews, review] })),

  endHand: () => set({ handEnded: true }),

  startNextHand: () =>
    set((state) => ({
      fusion: emptyFusion(),
      heroCards: null,
      potEntry: null,
      rejected: [],
      reviews: [],
      handEnded: false,
      phase: 'setup',
      handsObserved: state.handsObserved + 1,
    })),

  reset: () => set({ ...initialState, fusion: emptyFusion() }),
}));

/** Hero and board cards in play, for greying pickers and killing detections. */
export function liveUsedCards(state: {
  heroCards: readonly [Card, Card] | null;
  fusion: FusionState;
}): Card[] {
  return [...(state.heroCards ?? []), ...state.fusion.board];
}
