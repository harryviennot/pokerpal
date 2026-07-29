import { Pressable, StyleSheet, View } from 'react-native';

import { GRADE_LABELS, GRADE_TONES } from '@/components/coach/coachCopy';
import { Text } from '@/components/ui/Text';
import { type DecisionReview } from '@/engine';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';
import { formatChips } from '@/utils/format';

export interface CoachNoteProps {
  /** The decision worth talking about, or null when there is nothing to say. */
  review: DecisionReview | null;
  /** How many decisions were graded, so a single note can say what it is one of. */
  total: number;
  /** Opens the full review. The note is a summary; this is the way into the rest. */
  onPress?: () => void;
}

/**
 * The coach's verdict on one decision.
 *
 * Every number here came out of the engine. Nothing on this surface may be
 * rounded into a different claim or softened into one the math did not make —
 * the whole product rests on the grade being trustworthy.
 */
export function CoachNote({ review, total, onPress }: CoachNoteProps) {
  const { colors } = useTheme();

  if (!review) {
    return null;
  }

  const tone = GRADE_TONES[review.grade];
  const body = (
    <>
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
    </>
  );

  if (!onPress) {
    return (
      <View
        accessibilityRole="summary"
        accessibilityLabel={`${GRADE_LABELS[review.grade]}. ${review.reason}`}
        style={[styles.card, { backgroundColor: colors.secondaryBackground }]}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${GRADE_LABELS[review.grade]}. ${review.reason}`}
      accessibilityHint="Opens the session review"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.secondaryBackground },
        pressed && styles.pressed,
      ]}>
      <View style={styles.pressableRow}>
        <View style={styles.body}>{body}</View>
        <Text variant="body" tone="tertiaryLabel">
          ›
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  pressableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  body: {
    flex: 1,
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
  pressed: {
    opacity: 0.7,
  },
});
