import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { type StoredHandSummary } from '@/services/handHistory';
import { spacing } from '@/theme';
import { formatChips, formatWhen } from '@/utils/format';

export interface HandHistoryRowProps {
  hand: StoredHandSummary;
}

/** One stored hand: when it was played, what it paid, what the coach saw. */
export function HandHistoryRow({ hand }: HandHistoryRowProps) {
  return (
    <View style={styles.row}>
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
    </View>
  );
}

function describeCoaching(hand: StoredHandSummary): string {
  if (hand.decisionsGraded === 0) {
    return 'nothing to grade';
  }

  const decisions = `${hand.decisionsGraded} graded`;

  return hand.evLost >= 1 ? `${decisions}, −${formatChips(hand.evLost)} given up` : decisions;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  details: {
    gap: 2,
    flexShrink: 1,
  },
});
