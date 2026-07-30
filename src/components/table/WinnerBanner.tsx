import { StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, ZoomIn } from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing, springs } from '@/theme';

export interface WinnerBannerProps {
  /** The line to show, from `winnerSummary`. Renders nothing when null. */
  summary: string | null;
}

const arrive = ZoomIn.springify()
  .damping(springs.notify.damping)
  .stiffness(springs.notify.stiffness)
  .mass(springs.notify.mass)
  .reduceMotion(ReduceMotion.System);

/**
 * The result caption on the felt, just under the board: "Ava wins the hand".
 *
 * A tight scrim pill rather than a banner — it lands on the artwork for a couple
 * of seconds and must not read as a permanent piece of the table.
 */
export function WinnerBanner({ summary }: WinnerBannerProps) {
  const { colors } = useTheme();

  if (summary === null) {
    return null;
  }

  return (
    <View style={styles.row} pointerEvents="none">
      <Animated.View
        entering={arrive}
        style={[styles.caption, { backgroundColor: colors.captionScrim }]}>
        <Text variant="footnote" numberOfLines={1} style={[styles.text, { color: colors.onFelt }]}>
          {summary}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
  },
  caption: {
    paddingVertical: spacing.xs / 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  text: {
    fontWeight: '700',
  },
});
