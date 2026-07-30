import { Pressable, StyleSheet } from 'react-native';

import { CardBack } from '@/components/ui/CardBack';
import { CardFace } from '@/components/ui/CardFace';
import { MysteryCard } from '@/components/ui/MysteryCard';
import { formatRank, rankOf, suitOf, type Card } from '@/engine';
import { useTheme } from '@/hooks/useTheme';
import { radius } from '@/theme';

export type PlayingCardSize = 'small' | 'medium' | 'large' | 'xl';

export interface PlayingCardProps {
  /** Omit for an empty slot, or when the card is face down. */
  card?: Card;
  size?: PlayingCardSize;
  /** Draws the selection ring — this slot receives the next picked card. */
  focused?: boolean;
  /** Renders the back of the card. A face-down card never reveals `card`. */
  faceDown?: boolean;
  /** Greys the card out — one that is not part of the winning five at showdown. */
  dimmed?: boolean;
  /** The dark "?" placeholder shown between hands, before the board exists. */
  mystery?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/**
 * Card sizes, in points.
 *
 * `large` is the board and the odds calculator's hero slots; `xl` is the two
 * cards the player is actually holding, which the reference draws a shade bigger
 * than the board's.
 */
const DIMENSIONS: Record<PlayingCardSize, { width: number; height: number }> = {
  small: { width: 30, height: 42 },
  medium: { width: 44, height: 62 },
  large: { width: 60, height: 84 },
  xl: { width: 62, height: 88 },
};

/** How big a card of `size` is, for callers that have to lay a row of them out. */
export function cardSize(size: PlayingCardSize): { width: number; height: number } {
  return DIMENSIONS[size];
}

/**
 * A single card: face up, face down, unrevealed, or a dashed placeholder.
 *
 * Owns the frame, the state and what a screen reader is told; `CardFace`,
 * `CardBack` and `MysteryCard` own what fills it.
 */
export function PlayingCard({
  card,
  size = 'medium',
  focused = false,
  faceDown = false,
  dimmed = false,
  mystery = false,
  onPress,
  accessibilityLabel,
}: PlayingCardProps) {
  const { colors } = useTheme();
  const { width, height } = DIMENSIONS[size];
  const covered = faceDown || mystery;
  const isEmpty = card === undefined && !covered;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? describe(card, covered, dimmed, mystery)}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.base,
        { width, height, borderRadius: radius.xs },
        isEmpty && { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.separator },
        !isEmpty &&
          !covered && { backgroundColor: dimmed ? colors.cardFaceDimmed : colors.cardFace },
        focused && { borderWidth: 2, borderStyle: 'solid', borderColor: colors.tint },
        pressed && styles.pressed,
      ]}>
      {mystery && <MysteryCard radius={radius.sm} large={size === 'large' || size === 'xl'} />}
      {faceDown && !mystery && <CardBack radius={radius.sm} />}
      {card !== undefined && !covered && <CardFace card={card} size={size} dimmed={dimmed} />}
    </Pressable>
  );
}

function describe(
  card: Card | undefined,
  covered: boolean,
  dimmed: boolean,
  mystery: boolean,
): string {
  if (mystery) {
    return 'Card not dealt yet';
  }

  if (covered) {
    return 'Face-down card';
  }

  if (card === undefined) {
    return 'Empty card slot';
  }

  const name = `${formatRank(rankOf(card))} of ${suitName(card)}`;

  // A dimmed card is one outside the winning five; say so rather than hoping
  // a sighted-only style carries the meaning.
  return dimmed ? `${name}, does not play` : name;
}

function suitName(card: Card): string {
  const names = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' } as const;

  return names[suitOf(card)];
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.6,
  },
});
