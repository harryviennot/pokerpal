import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { type DecisionReview } from '@/engine';
import { useCoachLanguage } from '@/hooks/useCoachLanguage';
import { spacing } from '@/theme';

import { gradeLabels, GRADE_TONES, streetLabels } from './coachCopy';
import { DecisionExplanation } from './DecisionExplanation';
import { explainReview } from './explain';
import { termForGrade } from './glossary';
import { GlossaryLink } from './GlossaryLink';

export interface DecisionRowProps {
  review: DecisionReview;
  /**
   * The blind the hand was played at, so a cost can be quoted in the unit the
   * grade is measured in. Omit across a session whose stakes climbed — one
   * big-blind figure spanning several levels would be wrong.
   */
  bigBlind?: number;
}

/** One graded decision: where it happened, the verdict, and why. */
export function DecisionRow({ review, bigBlind }: DecisionRowProps) {
  const language = useCoachLanguage();
  const grade = gradeLabels(language)[review.grade];
  const street = streetLabels(language)[review.facts.street];
  const explanation = explainReview(review, { language, bigBlind });

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${street}: ${grade}. ${explanation.what}`}
      style={styles.row}>
      <View style={styles.header}>
        <View style={styles.verdict}>
          <Text variant="caption" tone="secondaryLabel">
            {street}
          </Text>
          {/* The verdict is the word that sent people to the glossary in the
              first place, so it is the one that has to be tappable. */}
          <GlossaryLink
            term={termForGrade(review.grade)}
            variant="footnote"
            tone={GRADE_TONES[review.grade]}
            style={styles.grade}>
            {grade.toUpperCase()}
          </GlossaryLink>
        </View>
      </View>

      <DecisionExplanation explanation={explanation} />
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
