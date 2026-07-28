import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import {
  formatRank,
  isRedSuit,
  makeCard,
  RANKS,
  SUITS,
  suitSymbol,
  type Card,
  type Rank,
  type Suit,
} from '@/engine';
import { useTheme } from '@/hooks/useTheme';
import { MIN_TOUCH_TARGET, radius, spacing } from '@/theme';

export interface CardPickerProps {
  /** Cards already in play — shown greyed and not selectable. */
  used: readonly Card[];
  onPick: (card: Card) => void;
}

/**
 * Tap a rank, then a suit (PRD §A). Suits for an unavailable card are disabled
 * rather than hidden, so the grid never reflows under the user's finger.
 */
export function CardPicker({ used, onPick }: CardPickerProps) {
  const { colors } = useTheme();
  const [pendingRank, setPendingRank] = useState<Rank | null>(null);

  const isUsed = (rank: Rank, suit: Suit): boolean => used.includes(makeCard(rank, suit));
  const rankExhausted = (rank: Rank): boolean => SUITS.every((suit) => isUsed(rank, suit));

  const handleRank = (rank: Rank): void => {
    void Haptics.selectionAsync();
    setPendingRank((current) => (current === rank ? null : rank));
  };

  const handleSuit = (suit: Suit): void => {
    if (pendingRank === null) {
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPick(makeCard(pendingRank, suit));
    setPendingRank(null);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.rankGrid}>
        {RANKS.map((rank) => {
          const exhausted = rankExhausted(rank);
          const selected = pendingRank === rank;

          return (
            <Pressable
              key={rank}
              accessibilityRole="button"
              accessibilityLabel={`Rank ${formatRank(rank)}`}
              accessibilityState={{ selected, disabled: exhausted }}
              disabled={exhausted}
              onPress={() => handleRank(rank)}
              style={({ pressed }) => [
                styles.rank,
                {
                  backgroundColor: selected ? colors.tint : colors.tertiaryBackground,
                  borderRadius: radius.sm,
                },
                exhausted && styles.disabled,
                pressed && styles.pressed,
              ]}>
              <Text
                variant="headline"
                style={{
                  color: selected ? '#FFFFFF' : exhausted ? colors.tertiaryLabel : colors.label,
                }}>
                {formatRank(rank)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.suitRow}>
        {SUITS.map((suit) => {
          const waiting = pendingRank === null;
          const unavailable = !waiting && isUsed(pendingRank, suit);
          const disabled = waiting || unavailable;

          return (
            <Pressable
              key={suit}
              accessibilityRole="button"
              accessibilityLabel={`Suit ${suitName(suit)}`}
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={() => handleSuit(suit)}
              style={({ pressed }) => [
                styles.suit,
                { backgroundColor: colors.tertiaryBackground, borderRadius: radius.sm },
                disabled && styles.disabled,
                pressed && styles.pressed,
              ]}>
              <Text
                variant="title3"
                style={{
                  color: disabled
                    ? colors.tertiaryLabel
                    : isRedSuit(suit)
                      ? colors.suitRed
                      : colors.suitBlack,
                }}>
                {suitSymbol(suit)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text variant="footnote" tone="secondaryLabel" style={styles.hint}>
        {pendingRank === null
          ? 'Tap a rank, then a suit.'
          : `Pick a suit for the ${formatRank(pendingRank)}.`}
      </Text>
    </View>
  );
}

function suitName(suit: Suit): string {
  const names = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' } as const;

  return names[suit];
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  rankGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  rank: {
    flexGrow: 1,
    flexBasis: 40,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suitRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  suit: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.6,
  },
  hint: {
    textAlign: 'center',
  },
});
