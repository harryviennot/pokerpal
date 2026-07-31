import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { spacing } from '@/theme';
import { formatPercent } from '@/utils/format';

export interface EquityReadoutProps {
  /** Hero equity 0 to 1, or null while it is being worked out. */
  equity: number | null;
  outCount: number;
  drawName: string | null;
  /** Equity the entered price demands, or null without a bet to face. */
  requiredEquity: number | null;
  opponents: number;
}

/** The Tier 1 line: equity, outs and — once a price exists — what it demands. */
export function EquityReadout({
  equity,
  outCount,
  drawName,
  requiredEquity,
  opponents,
}: EquityReadoutProps) {
  return (
    <View style={styles.row}>
      <View style={styles.stat}>
        <Text variant="title3" tabular>
          {equity === null ? '—' : formatPercent(equity)}
        </Text>
        <Text variant="caption" tone="secondaryLabel">
          vs {opponents} {opponents === 1 ? 'player' : 'players'}
        </Text>
      </View>

      {outCount > 0 ? (
        <View style={styles.stat}>
          <Text variant="title3" tabular>
            {outCount}
          </Text>
          <Text variant="caption" tone="secondaryLabel">
            {drawName ?? 'outs'}
          </Text>
        </View>
      ) : null}

      {requiredEquity !== null ? (
        <View style={styles.stat}>
          <Text variant="title3" tabular>
            {formatPercent(requiredEquity)}
          </Text>
          <Text variant="caption" tone="secondaryLabel">
            needed to call
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  stat: {
    alignItems: 'flex-start',
  },
});
