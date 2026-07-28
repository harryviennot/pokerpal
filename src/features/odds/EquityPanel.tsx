import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { drawLabel, type DrawInfo } from '@/engine';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';
import { formatPercent } from '@/utils/format';

import { type EquityState } from './useEquity';

export interface EquityPanelProps {
  state: EquityState;
  draws: DrawInfo | null;
}

/** Hero's equity, the win/tie/lose split, and any draws detected. */
export function EquityPanel({ state, draws }: EquityPanelProps) {
  const { colors } = useTheme();
  const { result, status, progress, error } = state;

  if (status === 'error') {
    return (
      <Text variant="subheadline" tone="danger">
        {error}
      </Text>
    );
  }

  if (!result) {
    return (
      <Text variant="subheadline" tone="secondaryLabel">
        Working out the odds…
      </Text>
    );
  }

  const converging = status === 'running';

  return (
    <View style={styles.wrapper}>
      <View style={styles.headline}>
        <Text variant="largeTitle" tabular>
          {formatPercent(result.equity)}
        </Text>
        <Text variant="footnote" tone="secondaryLabel">
          {result.exact
            ? 'Exact — every runout counted'
            : converging
              ? `Sampling… ${Math.round(progress * 100)}%`
              : `${result.iterations.toLocaleString()} simulations`}
        </Text>
      </View>

      {converging && (
        <View style={[styles.track, { backgroundColor: colors.tertiaryBackground }]}>
          <View
            style={[styles.fill, { backgroundColor: colors.tint, width: `${progress * 100}%` }]}
          />
        </View>
      )}

      <View style={styles.splits}>
        <Split label="Win" value={result.win} tone="success" />
        <Split label="Tie" value={result.tie} tone="secondaryLabel" />
        <Split label="Lose" value={result.lose} tone="danger" />
      </View>

      {draws && draws.draws.length > 0 && (
        <View style={styles.draws}>
          {draws.draws.map((draw) => (
            <View key={draw} style={[styles.chip, { backgroundColor: colors.tertiaryBackground }]}>
              <Text variant="footnote">{drawLabel(draw)}</Text>
            </View>
          ))}
          {draws.outCount > 0 && (
            <View style={[styles.chip, { backgroundColor: colors.tertiaryBackground }]}>
              <Text variant="footnote" tabular>
                {draws.outCount} outs
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function Split({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'success' | 'danger' | 'secondaryLabel';
}) {
  return (
    <View style={styles.split}>
      <Text variant="title3" tone={tone} tabular>
        {formatPercent(value)}
      </Text>
      <Text variant="caption" tone="secondaryLabel">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.md,
  },
  headline: {
    gap: spacing.xs / 2,
  },
  track: {
    height: 3,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
  },
  splits: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  split: {
    gap: spacing.xs / 2,
  },
  draws: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
  },
});
