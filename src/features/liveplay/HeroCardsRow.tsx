import { Pressable, StyleSheet, View } from 'react-native';

import { PlayingCard } from '@/components/ui/PlayingCard';
import { Text } from '@/components/ui/Text';
import { formatCardPretty, type Card } from '@/engine';
import { spacing } from '@/theme';

import { type HeroSource } from './useLivePlayStore';

export interface HeroCardsRowProps {
  cards: readonly [Card, Card] | null;
  source: HeroSource | null;
  /** How many of the hero's cards the camera is still confirming. */
  pending: number;
  /** Tap a slot to say what the card really is. */
  onCorrect: (index: 0 | 1) => void;
}

/**
 * The player's own two cards, read off the table by the camera.
 *
 * Entering them by hand is the fallback, not the ritual: until the pair locks
 * this says so, and afterwards each slot is one tap from a correction.
 */
export function HeroCardsRow({ cards, source, pending, onCorrect }: HeroCardsRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.cards}>
        {([0, 1] as const).map((index) => {
          const card = cards?.[index];

          return (
            <Pressable
              key={index}
              accessibilityRole="button"
              accessibilityLabel={
                card === undefined
                  ? `Your ${index === 0 ? 'first' : 'second'} card, not read yet. Tap to enter it.`
                  : `Your ${formatCardPretty(card)}. Tap to correct.`
              }
              onPress={() => onCorrect(index)}>
              <PlayingCard card={card} size="medium" />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.label}>
        <Text variant="subheadline">Your hand</Text>
        <Text variant="caption" tone="secondaryLabel">
          {cards === null
            ? pending > 0
              ? 'Reading your cards…'
              : 'Point the camera at the table'
            : source === 'vision'
              ? 'Read from the table'
              : 'Entered by you'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cards: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  label: {
    flexShrink: 1,
  },
});
