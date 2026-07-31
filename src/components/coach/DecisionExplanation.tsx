import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { spacing } from '@/theme';

import { type Explanation } from './explain';

export interface DecisionExplanationProps {
  explanation: Explanation;
}

/**
 * A verdict said out loud: what you did, why it was judged that way, what it
 * cost, and what to do instead.
 *
 * Four parts in a fixed order, in whichever register is selected. The order is
 * the point — a player who reads only the first line still learns something, and
 * one who reads to the end has a concrete thing to change.
 */
export function DecisionExplanation({ explanation }: DecisionExplanationProps) {
  return (
    <View style={styles.body}>
      <Text variant="subheadline">{explanation.what}</Text>

      <View style={styles.why}>
        {explanation.why.map((line) => (
          <Text key={line} variant="footnote" tone="secondaryLabel">
            {line}
          </Text>
        ))}
      </View>

      {explanation.cost !== null && (
        <Text variant="footnote" tone="secondaryLabel">
          {explanation.cost}
        </Text>
      )}

      {explanation.instead !== null && (
        <Text variant="footnote" tone="tint">
          {explanation.instead}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.xs,
  },
  why: {
    gap: spacing.xs / 2,
  },
});
