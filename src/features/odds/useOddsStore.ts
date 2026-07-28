import { create } from 'zustand';

import { type Card, type RangePreset } from '@/engine';

/**
 * The seven positions a card can occupy. Index order is also tab order, so
 * filling a slot advances to the next empty one.
 */
export const SLOTS = ['hero1', 'hero2', 'flop1', 'flop2', 'flop3', 'turn', 'river'] as const;

export type Slot = (typeof SLOTS)[number];

export const HERO_SLOTS: readonly Slot[] = ['hero1', 'hero2'];
export const BOARD_SLOTS: readonly Slot[] = ['flop1', 'flop2', 'flop3', 'turn', 'river'];

export type SlotCards = Partial<Record<Slot, Card>>;

interface OddsState {
  cards: SlotCards;
  focusedSlot: Slot;
  opponentCount: number;
  rangePreset: RangePreset | 'random';
  /** Raw text, so the field can be empty while typing. */
  potInput: string;
  betInput: string;

  focusSlot: (slot: Slot) => void;
  setCard: (card: Card) => void;
  clearSlot: (slot: Slot) => void;
  clearAll: () => void;
  setOpponentCount: (count: number) => void;
  setRangePreset: (preset: RangePreset | 'random') => void;
  setPotInput: (value: string) => void;
  setBetInput: (value: string) => void;
}

export const MIN_OPPONENTS = 1;
export const MAX_OPPONENTS = 8;

const initialState = {
  cards: {} as SlotCards,
  focusedSlot: 'hero1' as Slot,
  opponentCount: 1,
  rangePreset: 'random' as RangePreset | 'random',
  potInput: '',
  betInput: '',
};

/**
 * Finds the next slot that still needs a card, so entering a hand is a
 * continuous run of taps rather than tap-slot-tap-rank-tap-suit each time.
 * Falls back to staying put once everything is filled.
 */
function nextEmptySlot(cards: SlotCards, after: Slot): Slot {
  const start = SLOTS.indexOf(after);

  for (let offset = 1; offset <= SLOTS.length; offset++) {
    const candidate = SLOTS[(start + offset) % SLOTS.length] as Slot;

    if (cards[candidate] === undefined) {
      return candidate;
    }
  }

  return after;
}

export const useOddsStore = create<OddsState>((set) => ({
  ...initialState,

  focusSlot: (slot) => set({ focusedSlot: slot }),

  setCard: (card) =>
    set((state) => {
      // A card already in play moves rather than duplicating.
      const cards: SlotCards = { ...state.cards };

      for (const slot of SLOTS) {
        if (cards[slot] === card) {
          delete cards[slot];
        }
      }

      cards[state.focusedSlot] = card;

      return { cards, focusedSlot: nextEmptySlot(cards, state.focusedSlot) };
    }),

  clearSlot: (slot) =>
    set((state) => {
      const cards = { ...state.cards };

      delete cards[slot];

      return { cards, focusedSlot: slot };
    }),

  clearAll: () => set({ cards: {}, focusedSlot: 'hero1' }),

  setOpponentCount: (count) =>
    set({ opponentCount: Math.min(MAX_OPPONENTS, Math.max(MIN_OPPONENTS, count)) }),

  setRangePreset: (rangePreset) => set({ rangePreset }),

  setPotInput: (potInput) => set({ potInput }),

  setBetInput: (betInput) => set({ betInput }),
}));

/** Cards currently in play, for greying out the picker. */
export function usedCards(cards: SlotCards): Card[] {
  return SLOTS.map((slot) => cards[slot]).filter((card): card is Card => card !== undefined);
}

/** Hero's hand, or null while fewer than two cards are chosen. */
export function heroHand(cards: SlotCards): readonly [Card, Card] | null {
  const first = cards.hero1;
  const second = cards.hero2;

  return first !== undefined && second !== undefined ? [first, second] : null;
}

/**
 * The board as a contiguous prefix. A turn card without a full flop is not a
 * legal board, so trailing cards are ignored until the gap is filled.
 */
export function boardCards(cards: SlotCards): Card[] {
  const board: Card[] = [];

  for (const slot of BOARD_SLOTS) {
    const card = cards[slot];

    if (card === undefined) {
      break;
    }

    board.push(card);
  }

  return board;
}

/** True when some board card is set but an earlier one is missing. */
export function hasBoardGap(cards: SlotCards): boolean {
  const filled = BOARD_SLOTS.map((slot) => cards[slot] !== undefined);
  const firstEmpty = filled.indexOf(false);

  return firstEmpty !== -1 && filled.slice(firstEmpty).includes(true);
}
