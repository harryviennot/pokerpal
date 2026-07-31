import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { type LeakTally } from '@/engine';
import { useCoachLanguage } from '@/hooks/useCoachLanguage';
import { spacing } from '@/theme';
import { formatChips } from '@/utils/format';

import { leakLabels } from './coachCopy';
import { termForLeak } from './glossary';
import { GlossaryLink } from './GlossaryLink';

export interface LeakSummaryProps {
  /** Costliest first, at most three — `topLeaks` output. */
  leaks: readonly LeakTally[];
}

/**
 * The habits the session showed, each priced in the chips it gave up.
 *
 * A hand-built row rather than `StatRow` because the habit's name has to be
 * tappable: "over-bluffing" is exactly the kind of label that means nothing to
 * the player it is being shown to.
 */
export function LeakSummary({ leaks }: LeakSummaryProps) {
  const language = useCoachLanguage();

  if (leaks.length === 0) {
    return (
      <Text variant="subheadline" tone="secondaryLabel">
        No leaks so far. Keep making the maths happy.
      </Text>
    );
  }

  return (
    <>
      {leaks.map((tally) => (
        <View key={tally.leak} style={styles.row}>
          <GlossaryLink term={termForLeak(tally.leak)} variant="subheadline">
            {`${leakLabels(language)[tally.leak]} ×${tally.count}`}
          </GlossaryLink>
          <Text variant="subheadline" tabular tone="danger">
            {`−${formatChips(tally.evLoss)}`}
          </Text>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
