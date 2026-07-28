import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { formatRank, isRedSuit, rankOf, suitOf, suitSymbol, type Card } from '@/engine';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';

export type PlayingCardSize = 'medium' | 'large';

export interface PlayingCardProps {
  /** Omit for an empty slot. */
  card?: Card;
  size?: PlayingCardSize;
  /** Draws the selection ring — this slot receives the next picked card. */
  focused?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

const DIMENSIONS: Record<PlayingCardSize, { width: number; height: number }> = {
  medium: { width: 44, height: 62 },
  large: { width: 56, height: 78 },
};

/** A single card face, or a dashed placeholder when empty. */
export function PlayingCard({
  card,
  size = 'medium',
  focused = false,
  onPress,
  accessibilityLabel,
}: PlayingCardProps) {
  const { colors } = useTheme();
  const { width, height } = DIMENSIONS[size];
  const isEmpty = card === undefined;

  const label =
    accessibilityLabel ??
    (isEmpty ? 'Empty card slot' : `${formatRank(rankOf(card))} of ${suitName(card)}`);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.base,
        { width, height, borderRadius: radius.sm },
        isEmpty
          ? { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.separator }
          : { backgroundColor: colors.cardFace },
        focused && { borderWidth: 2, borderStyle: 'solid', borderColor: colors.tint },
        pressed && styles.pressed,
      ]}>
      {!isEmpty && (
        <View style={styles.face}>
          <Text
            variant={size === 'large' ? 'title2' : 'title3'}
            style={{ color: suitColor(card, colors.suitRed, colors.suitBlack) }}>
            {formatRank(rankOf(card))}
          </Text>
          <Text
            variant={size === 'large' ? 'headline' : 'footnote'}
            style={{ color: suitColor(card, colors.suitRed, colors.suitBlack) }}>
            {suitSymbol(suitOf(card))}
          </Text>
        </View>
      )}
    </Pressable>
  );
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
  pressed: {
    opacity: 0.6,
  },
});
