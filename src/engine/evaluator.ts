/**
 * Seven-card hand evaluation.
 *
 * Rather than scoring all 21 five-card subsets, a hand is reduced to a 13-bit
 * rank mask, four 13-bit suit masks and a per-rank count array, and the
 * category is read straight off those. Straights come from a lookup table built
 * once at module load — 8 KB, no generated source file, no build step.
 *
 * The result is packed into a single integer so comparing two hands is one
 * numeric comparison and equal integers mean a split pot.
 */

import { rankIndexOf, suitIndexOf, type Card, type Rank } from './cards';

export const HandCategory = {
  HighCard: 0,
  Pair: 1,
  TwoPair: 2,
  ThreeOfAKind: 3,
  Straight: 4,
  Flush: 5,
  FullHouse: 6,
  FourOfAKind: 7,
  StraightFlush: 8,
} as const;

export type HandCategory = (typeof HandCategory)[keyof typeof HandCategory];

export interface HandRank {
  category: HandCategory;
  /**
   * Packed comparable score. Higher wins; equal values are an exact tie.
   * Meaningful only against other values from this module.
   */
  value: number;
  /**
   * Category-defining ranks, most significant first. For two pair that is
   * [high pair, low pair, kicker]; for a straight, just the high card.
   */
  ranks: Rank[];
}

const RANK_COUNT = 13;
const ACE_INDEX = 12;

/**
 * High rank index of the best straight for a 13-bit rank mask, or -1 for none.
 * Index 3 (a five) represents the wheel, A-2-3-4-5.
 */
const straightHighByMask = buildStraightTable();

function buildStraightTable(): Int8Array {
  const table = new Int8Array(1 << RANK_COUNT).fill(-1);
  const wheel = (1 << ACE_INDEX) | 0b1111; // A, 2, 3, 4, 5

  for (let mask = 0; mask < table.length; mask++) {
    for (let high = ACE_INDEX; high >= 4; high--) {
      const run = 0b11111 << (high - 4);

      if ((mask & run) === run) {
        table[mask] = high;
        break;
      }
    }

    if (table[mask] === -1 && (mask & wheel) === wheel) {
      table[mask] = 3;
    }
  }

  return table;
}

function pack(category: HandCategory, k1: number, k2 = 0, k3 = 0, k4 = 0, k5 = 0): number {
  return (category << 20) | (k1 << 16) | (k2 << 12) | (k3 << 8) | (k4 << 4) | k5;
}

/** Descending rank indices of the top `count` set bits in a 13-bit mask. */
function topRanks(mask: number, count: number, out: number[]): void {
  let found = 0;

  for (let rank = ACE_INDEX; rank >= 0 && found < count; rank--) {
    if ((mask & (1 << rank)) !== 0) {
      out[found++] = rank;
    }
  }

  while (found < count) {
    out[found++] = 0;
  }
}

// Reused across calls to keep the hot path allocation-free. The engine is
// single-threaded, and no reference to these escapes.
const kickers: number[] = [0, 0, 0, 0, 0];
const counts = new Int8Array(RANK_COUNT);
const suitMasks = new Int16Array(4);

/**
 * Packed score for a hand of five to seven cards. Higher is better; equal
 * values tie exactly. This is the hot path the simulator calls.
 */
export function handValue(cards: readonly Card[]): number {
  counts.fill(0);
  suitMasks.fill(0);

  let rankMask = 0;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i] as Card;
    const rank = rankIndexOf(card);
    const suit = suitIndexOf(card);

    // Casts rather than `!`: noUncheckedIndexedAccess widens typed-array reads
    // to `number | undefined`, but these indices are bounded by construction.
    rankMask |= 1 << rank;
    suitMasks[suit] = (suitMasks[suit] as number) | (1 << rank);
    counts[rank] = (counts[rank] as number) + 1;
  }

  // A hand with five of one suit can never also be quads or a full house — the
  // other two cards cannot supply enough ranks — so a flush short-circuits.
  for (let suit = 0; suit < 4; suit++) {
    const suitMask = suitMasks[suit] as number;

    if (popcount13(suitMask) >= 5) {
      const straightFlushHigh = straightHighByMask[suitMask] as number;

      if (straightFlushHigh >= 0) {
        return pack(HandCategory.StraightFlush, straightFlushHigh);
      }

      topRanks(suitMask, 5, kickers);

      return pack(
        HandCategory.Flush,
        kickers[0] as number,
        kickers[1] as number,
        kickers[2] as number,
        kickers[3] as number,
        kickers[4] as number,
      );
    }
  }

  let quad = -1;
  let trips = -1;
  let secondTrips = -1;
  let pair = -1;
  let secondPair = -1;

  for (let rank = ACE_INDEX; rank >= 0; rank--) {
    switch (counts[rank]) {
      case 4:
        quad = rank;
        break;
      case 3:
        if (trips < 0) trips = rank;
        else if (secondTrips < 0) secondTrips = rank;
        break;
      case 2:
        if (pair < 0) pair = rank;
        else if (secondPair < 0) secondPair = rank;
        break;
      default:
        break;
    }
  }

  if (quad >= 0) {
    topRanks(rankMask & ~(1 << quad), 1, kickers);

    return pack(HandCategory.FourOfAKind, quad, kickers[0] as number);
  }

  if (trips >= 0 && (secondTrips >= 0 || pair >= 0)) {
    // With two sets, the lower one plays as the pair.
    const fullHousePair = Math.max(secondTrips, pair);

    return pack(HandCategory.FullHouse, trips, fullHousePair);
  }

  const straightHigh = straightHighByMask[rankMask] as number;

  if (straightHigh >= 0) {
    return pack(HandCategory.Straight, straightHigh);
  }

  if (trips >= 0) {
    topRanks(rankMask & ~(1 << trips), 2, kickers);

    return pack(HandCategory.ThreeOfAKind, trips, kickers[0] as number, kickers[1] as number);
  }

  if (pair >= 0 && secondPair >= 0) {
    topRanks(rankMask & ~(1 << pair) & ~(1 << secondPair), 1, kickers);

    return pack(HandCategory.TwoPair, pair, secondPair, kickers[0] as number);
  }

  if (pair >= 0) {
    topRanks(rankMask & ~(1 << pair), 3, kickers);

    return pack(
      HandCategory.Pair,
      pair,
      kickers[0] as number,
      kickers[1] as number,
      kickers[2] as number,
    );
  }

  topRanks(rankMask, 5, kickers);

  return pack(
    HandCategory.HighCard,
    kickers[0] as number,
    kickers[1] as number,
    kickers[2] as number,
    kickers[3] as number,
    kickers[4] as number,
  );
}

function popcount13(mask: number): number {
  let value = mask - ((mask >> 1) & 0x5555);
  value = (value & 0x3333) + ((value >> 2) & 0x3333);
  value = (value + (value >> 4)) & 0x0f0f;

  return (value + (value >> 8)) & 0x1f;
}

export function categoryOf(value: number): HandCategory {
  return (value >> 20) as HandCategory;
}

/** How many ranks are significant for each category, in order of importance. */
const SIGNIFICANT_RANKS: Record<HandCategory, number> = {
  [HandCategory.HighCard]: 5,
  [HandCategory.Pair]: 4,
  [HandCategory.TwoPair]: 3,
  [HandCategory.ThreeOfAKind]: 3,
  [HandCategory.Straight]: 1,
  [HandCategory.Flush]: 5,
  [HandCategory.FullHouse]: 2,
  [HandCategory.FourOfAKind]: 2,
  [HandCategory.StraightFlush]: 1,
};

/**
 * Full evaluation for display. Prefer `handValue` inside simulation loops —
 * this allocates.
 */
export function evaluateHand(cards: readonly Card[]): HandRank {
  const value = handValue(cards);
  const category = categoryOf(value);
  const ranks: Rank[] = [];

  for (let i = 0; i < (SIGNIFICANT_RANKS[category] as number); i++) {
    const shift = 16 - i * 4;
    ranks.push((((value >> shift) & 0xf) + 2) as Rank);
  }

  return { category, value, ranks };
}

/** Negative when `a` loses, zero on an exact tie, positive when `a` wins. */
export function compareHands(a: readonly Card[], b: readonly Card[]): number {
  return handValue(a) - handValue(b);
}

const CATEGORY_NAMES: Record<HandCategory, string> = {
  [HandCategory.HighCard]: 'High card',
  [HandCategory.Pair]: 'Pair',
  [HandCategory.TwoPair]: 'Two pair',
  [HandCategory.ThreeOfAKind]: 'Three of a kind',
  [HandCategory.Straight]: 'Straight',
  [HandCategory.Flush]: 'Flush',
  [HandCategory.FullHouse]: 'Full house',
  [HandCategory.FourOfAKind]: 'Four of a kind',
  [HandCategory.StraightFlush]: 'Straight flush',
};

export function categoryName(category: HandCategory): string {
  return CATEGORY_NAMES[category];
}
