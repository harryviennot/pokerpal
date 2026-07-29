import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';

export interface Sparkbar {
  key: string;
  /** Bar height, in whatever unit the caller is charting. Never negative. */
  value: number;
  /** Shown under the first and last bar only; the middle is unlabelled. */
  label?: string;
  accessibilityLabel: string;
}

export interface SparkbarsProps {
  bars: readonly Sparkbar[];
  /** Tops the axis out. Defaults to the tallest bar, so the shape always fills. */
  max?: number;
  /** Marks bars at or below this as good — the target, not a threshold. */
  goodBelow?: number;
}

/** Bar height in points. Small on purpose: this is a shape, not a graph paper. */
const CHART_HEIGHT = 88;

/** A bar that rounds to nothing still has to be visible as "some". */
const MIN_BAR = 3;

/**
 * A run of values as bars, oldest left.
 *
 * Views and background colours, no drawing library: the shape a trend makes is
 * the whole message, and axes, gridlines and a curve would all be decoration
 * over six numbers. Each bar carries its own accessibility label, because the
 * shape is exactly what a screen reader cannot see.
 */
export function Sparkbars({ bars, max, goodBelow }: SparkbarsProps) {
  const { colors } = useTheme();

  if (bars.length === 0) {
    return null;
  }

  const ceiling = max ?? bars.reduce((tallest, bar) => Math.max(tallest, bar.value), 0);
  const first = bars[0];
  const last = bars[bars.length - 1];

  return (
    <View style={styles.chart}>
      <View style={styles.bars} accessibilityRole="summary">
        {bars.map((bar) => {
          const filled = ceiling > 0 ? Math.max(MIN_BAR, (bar.value / ceiling) * CHART_HEIGHT) : 0;
          const good = goodBelow !== undefined && bar.value <= goodBelow;

          return (
            <View key={bar.key} style={styles.column} accessibilityLabel={bar.accessibilityLabel}>
              <View
                style={[
                  styles.bar,
                  {
                    height: filled,
                    backgroundColor: good ? colors.success : colors.tint,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>

      {(first?.label || last?.label) && (
        <View style={styles.axis}>
          <Text variant="caption" tone="tertiaryLabel">
            {first?.label ?? ''}
          </Text>
          {bars.length > 1 && (
            <Text variant="caption" tone="tertiaryLabel">
              {last?.label ?? ''}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    gap: spacing.sm,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    gap: spacing.xs,
  },
  column: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bar: {
    borderRadius: radius.sm,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
