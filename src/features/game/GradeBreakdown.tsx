import { StyleSheet, View } from 'react-native';

import { GRADE_LABELS, GRADE_TONES } from '@/components/coach/coachCopy';
import { Text } from '@/components/ui/Text';
import { type Grade } from '@/engine';

import { GRADE_ORDER } from './sessionReport';

export interface GradeBreakdownProps {
  counts: Record<Grade, number>;
}

/**
 * How the session's decisions graded, best verdict first.
 *
 * Every verdict is listed, zeroes included: a session with no blunders in it is
 * worth being told, and a list that changes length between sessions is harder to
 * read at a glance than one that does not.
 */
export function GradeBreakdown({ counts }: GradeBreakdownProps) {
  const total = GRADE_ORDER.reduce((sum, grade) => sum + counts[grade], 0);

  if (total === 0) {
    return (
      <Text variant="subheadline" tone="secondaryLabel">
        Nothing was graded: no hand reached a decision worth coaching.
      </Text>
    );
  }

  return (
    <>
      {GRADE_ORDER.map((grade) => (
        <View key={grade} style={styles.row}>
          <Text
            variant="subheadline"
            tone={counts[grade] > 0 ? GRADE_TONES[grade] : 'tertiaryLabel'}>
            {GRADE_LABELS[grade]}
          </Text>
          <Text variant="subheadline" tabular tone="secondaryLabel">
            {String(counts[grade])}
          </Text>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
