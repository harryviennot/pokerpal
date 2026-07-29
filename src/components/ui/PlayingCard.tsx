import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { formatRank, isRedSuit, rankOf, suitOf, suitSymbol, type Card } from '@/engine';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';

export type PlayingCardSize = 'small' | 'medium' | 'large';

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
  onPress?: () => void;
  accessibilityLabel?: string;
}

const DIMENSIONS: Record<PlayingCardSize, { width: number; height: number }> = {
  small: { width: 30, height: 42 },
  medium: { width: 44, height: 62 },
  large: { width: 60, height: 84 },
};

const RANK_VARIANT = { small: 'footnote', medium: 'title3', large: 'title1' } as const;
const SUIT_VARIANT = { small: 'footnote', medium: 'title3', large: 'title2' } as const;

/**
 * A single card: face up, face down, or a dashed placeholder when empty.
 *
 * The face is the two-index design from the table art: the rank in the top
 * left corner and one large suit pip in the bottom right, nothing else.
 */
export function PlayingCard({
  card,
  size = 'medium',
  focused = false,
  faceDown = false,
  dimmed = false,
  onPress,
  accessibilityLabel,
}: PlayingCardProps) {
  const { colors } = useTheme();
  const { width, height } = DIMENSIONS[size];
  const isEmpty = card === undefined && !faceDown;
  const face = dimmed ? colors.cardFaceDimmed : colors.cardFace;
  const glyph = {
    color: suitColor(card, colors.suitRed, colors.suitBlack),
    opacity: dimmed ? 0.55 : 1,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? describe(card, faceDown, dimmed)}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.base,
        { width, height, borderRadius: radius.sm },
        isEmpty && { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.separator },
        !isEmpty && { backgroundColor: faceDown ? colors.cardBack : face },
        focused && { borderWidth: 2, borderStyle: 'solid', borderColor: colors.tint },
        pressed && styles.pressed,
      ]}>
      {faceDown && (
        <>
          <View style={[styles.backBorder, { borderColor: colors.cardBackAccent }]} />
          <View style={[styles.backLozenge, { backgroundColor: colors.cardBackAccent }]} />
        </>
      )}
      {card !== undefined && !faceDown && (
        <>
          <Text variant={RANK_VARIANT[size]} style={[styles.rank, glyph]}>
            {formatRank(rankOf(card))}
          </Text>
          <Text variant={SUIT_VARIANT[size]} style={[styles.suit, glyph]}>
            {suitSymbol(suitOf(card))}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function describe(card: Card | undefined, faceDown: boolean, dimmed: boolean): string {
  if (faceDown) {
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

function suitColor(card: Card | undefined, red: string, black: string): string {
  return card !== undefined && isRedSuit(suitOf(card)) ? red : black;
}

function suitName(card: Card): string {
  const names = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' } as const;

  return names[suitOf(card)];
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  rank: {
    position: 'absolute',
    top: spacing.xs / 2,
    left: spacing.xs,
    fontWeight: '700',
  },
  suit: {
    position: 'absolute',
    bottom: spacing.xs / 2,
    right: spacing.xs,
  },
  // The back: an inset border and a small lozenge, legible at every size
  // without becoming artwork that competes with the faces beside it.
  backBorder: {
    position: 'absolute',
    inset: 3,
    borderWidth: 1.5,
    borderRadius: radius.sm - 3,
    opacity: 0.9,
  },
  backLozenge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 10,
    height: 10,
    marginTop: -5,
    marginLeft: -5,
    borderRadius: radius.sm / 4,
    transform: [{ rotate: '45deg' }],
    opacity: 0.9,
  },
  pressed: {
    opacity: 0.6,
  },
});
