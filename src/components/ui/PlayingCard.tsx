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
  /** Fades the card out — a folded seat, or a hand that lost at showdown. */
  dimmed?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

const DIMENSIONS: Record<PlayingCardSize, { width: number; height: number }> = {
  small: { width: 30, height: 42 },
  medium: { width: 44, height: 62 },
  large: { width: 56, height: 78 },
};

const RANK_VARIANT = { small: 'footnote', medium: 'title3', large: 'title2' } as const;
const SUIT_VARIANT = { small: 'caption', medium: 'footnote', large: 'headline' } as const;

/** A single card: face up, face down, or a dashed placeholder when empty. */
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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? describe(card, faceDown)}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.base,
        { width, height, borderRadius: radius.sm },
        isEmpty && { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.separator },
        !isEmpty && { backgroundColor: faceDown ? colors.cardBack : colors.cardFace },
        focused && { borderWidth: 2, borderStyle: 'solid', borderColor: colors.tint },
        dimmed && styles.dimmed,
        pressed && styles.pressed,
      ]}>
      {faceDown && <View style={[styles.backPattern, { borderColor: colors.chip }]} />}
      {card !== undefined && !faceDown && (
        <View style={styles.face}>
          <Text
            variant={RANK_VARIANT[size]}
            style={{ color: suitColor(card, colors.suitRed, colors.suitBlack) }}>
            {formatRank(rankOf(card))}
          </Text>
          <Text
            variant={SUIT_VARIANT[size]}
            style={{ color: suitColor(card, colors.suitRed, colors.suitBlack) }}>
            {suitSymbol(suitOf(card))}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function describe(card: Card | undefined, faceDown: boolean): string {
  if (faceDown) {
    return 'Face-down card';
  }

  if (card === undefined) {
    return 'Empty card slot';
  }

  return `${formatRank(rankOf(card))} of ${suitName(card)}`;
}

function suitColor(card: Card, red: string, black: string): string {
  return isRedSuit(suitOf(card)) ? red : black;
}

function suitName(card: Card): string {
  const names = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' } as const;

  return names[suitOf(card)];
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  face: {
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  // A single inset hairline reads as a card back at any size without turning
  // into decoration that competes with the faces beside it.
  backPattern: {
    position: 'absolute',
    inset: 4,
    borderWidth: 1,
    borderRadius: radius.sm - 4,
    opacity: 0.35,
  },
  dimmed: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.6,
  },
});
