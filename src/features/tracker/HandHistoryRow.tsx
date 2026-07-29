import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { type StoredHandSummary } from '@/services/handHistory';
import { MIN_TOUCH_TARGET, spacing } from '@/theme';
import { formatChips, formatWhen } from '@/utils/format';

export interface HandHistoryRowProps {
  hand: StoredHandSummary;
  /** Opens the hand. The row does not know where that is — the list does. */
  onPress: () => void;
}

/** One stored hand: when it was played, what it paid, what the coach saw. */
export function HandHistoryRow({ hand, onPress }: HandHistoryRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Hand ${hand.handNumber}, ${describeNet(hand)}`}
      accessibilityHint="Opens the hand to replay it"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.details}>
        <Text variant="subheadline">Hand #{hand.handNumber}</Text>
        <Text variant="caption" tone="secondaryLabel">
          {formatWhen(hand.playedAt)} · {describeCoaching(hand)}
        </Text>
      </View>
      <Text
        variant="subheadline"
        tabular
        tone={hand.heroNet > 0 ? 'success' : hand.heroNet < 0 ? 'danger' : 'secondaryLabel'}>
        {hand.heroNet > 0 ? '+' : ''}
        {formatChips(hand.heroNet)}
      </Text>
      <Text variant="body" tone="tertiaryLabel">
        ›
      </Text>
    </Pressable>
  );
}

function describeCoaching(hand: StoredHandSummary): string {
  if (hand.decisionsGraded === 0) {
    return 'nothing to grade';
  }

  const decisions = `${hand.decisionsGraded} graded`;

  return hand.evLost >= 1 ? `${decisions}, −${formatChips(hand.evLost)} given up` : decisions;
}

/** The result as a sentence, for a screen reader that cannot see the tone. */
function describeNet(hand: StoredHandSummary): string {
  if (hand.heroNet === 0) {
    return 'broke even';
  }

  return hand.heroNet > 0
    ? `won ${formatChips(hand.heroNet)} chips`
    : `lost ${formatChips(Math.abs(hand.heroNet))} chips`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH_TARGET,
    gap: spacing.md,
  },
  details: {
    gap: 2,
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
