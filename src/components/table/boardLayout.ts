/**
 * How wide the board is allowed to get.
 *
 * The five community cards are the widest single row on the felt, and the felt is
 * not one size: a phone gives the capsule around 340 points across, the
 * tracker's fixed-ratio replay felt barely 260. Rather than let a river overhang
 * the rail, the board steps down a card size.
 */

import { cardSize, type PlayingCardSize } from '@/components/ui/PlayingCard';
import { spacing } from '@/theme';

/** Cards on a full board. */
export const BOARD_CARDS = 5;

/** Gap between board cards, and the clearance kept either side of the row. */
export const BOARD_GAP = spacing.xs;
const BOARD_INSET = spacing.base;

/** Largest to smallest, which is the order the board tries them in. */
const CANDIDATES: readonly PlayingCardSize[] = ['large', 'medium', 'small'];

/** How wide a full board of `size` cards is, gaps included. */
export function boardWidth(size: PlayingCardSize): number {
  return BOARD_CARDS * cardSize(size).width + (BOARD_CARDS - 1) * BOARD_GAP;
}

/**
 * The biggest card size whose full board fits across a felt `feltWidth` wide.
 *
 * Sized for a full board even on the flop, so the cards do not shrink under the
 * player as the turn and river arrive.
 */
export function boardCardSize(feltWidth: number): PlayingCardSize {
  const room = feltWidth - BOARD_INSET * 2;

  return CANDIDATES.find((size) => boardWidth(size) <= room) ?? 'small';
}
