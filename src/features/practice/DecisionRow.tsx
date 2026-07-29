import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { type DecisionReview } from '@/engine';
import { spacing } from '@/theme';
import { formatChips } from '@/utils/format';

import { GRADE_LABELS, GRADE_TONES, STREET_LABELS } from './coachCopy';

export interface DecisionRowProps {
  review: DecisionReview;
}

/** One graded decision: where it happened, the verdict, and the coach's line. */
export function DecisionRow({ review }: DecisionRowProps) {
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${STREET_LABELS[review.facts.street]}: ${GRADE_LABELS[review.grade]}. ${review.reason}`}
      style={styles.row}>
      <View style={styles.header}>
        <View style={styles.verdict}>
          <Text variant="caption" tone="secondaryLabel">
            {STREET_LABELS[review.facts.street]}
          </Text>
          <Text variant="footnote" tone={GRADE_TONES[review.grade]} style={styles.grade}>
            {GRADE_LABELS[review.grade].toUpperCase()}
          </Text>
        </View>
        {review.evLoss >= 1 && (
          <Text variant="caption" tone="secondaryLabel" tabular>
            −{formatChips(review.evLoss)} chips
          </Text>
        )}
      </View>
      <Text variant="subheadline">{review.reason}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verdict: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  grade: {
    letterSpacing: 0.6,
    fontWeight: '600',
  },
});
