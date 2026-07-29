import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { type DecisionReview, type Grade } from '@/engine';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';
import { formatChips } from '@/utils/format';

export interface CoachNoteProps {
  /** The decision worth talking about, or null when there is nothing to say. */
  review: DecisionReview | null;
  /** How many decisions were graded, so a single note can say what it is one of. */
  total: number;
}

const GRADE_LABELS: Record<Grade, string> = {
  correct: 'Correct',
  marginal: 'Marginal',
  mistake: 'Mistake',
  blunder: 'Blunder',
};

type Tone = 'success' | 'warning' | 'danger' | 'secondaryLabel';

const GRADE_TONES: Record<Grade, Tone> = {
  correct: 'success',
  marginal: 'warning',
  mistake: 'danger',
  blunder: 'danger',
};

/**
 * The coach's verdict on one decision.
 *
 * Every number here came out of the engine. Nothing on this surface may be
 * rounded into a different claim or softened into one the math did not make —
 * the whole product rests on the grade being trustworthy.
 */
export function CoachNote({ review, total }: CoachNoteProps) {
  const { colors } = useTheme();

  if (!review) {
    return null;
  }

  const tone = GRADE_TONES[review.grade];

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${GRADE_LABELS[review.grade]}. ${review.reason}`}
      style={[styles.card, { backgroundColor: colors.secondaryBackground }]}>
      <View style={styles.header}>
        <Text variant="footnote" tone={tone} style={styles.grade}>
          {GRADE_LABELS[review.grade].toUpperCase()}
        </Text>
        {review.evLoss >= 1 && (
          <Text variant="caption" tone="secondaryLabel" tabular>
            −{formatChips(review.evLoss)} chips
          </Text>
        )}
      </View>

      <Text variant="subheadline">{review.reason}</Text>

      {total > 1 && (
        <Text variant="caption" tone="tertiaryLabel">
          Your costliest of {total} decisions this hand
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  grade: {
    letterSpacing: 0.6,
    fontWeight: '600',
  },
});
