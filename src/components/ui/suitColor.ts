import { type Suit } from '@/engine';
import { type Theme } from '@/hooks/useTheme';

/**
 * The four-colour deck: hearts red, diamonds orange, spades and clubs the same
 * near-black navy.
 *
 * Shared rather than inlined at each glyph, because a card face and a suit picker
 * disagreeing about what colour a diamond is reads as a bug in the cards.
 */
export function suitColor(suit: Suit, colors: Theme['colors']): string {
  if (suit === 'h') {
    return colors.suitRed;
  }

  return suit === 'd' ? colors.suitOrange : colors.suitBlack;
}
