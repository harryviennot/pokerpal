import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';

export interface EquityBadgeProps {
  /** Already formatted: the caller owns the units, e.g. "28%". */
  label: string;
}

/**
 * The frosted badge over a hand's cards during an all-in run-out.
 *
 * Sits low on the cards and is clipped by their corner, so it reads as printed
 * on the hand rather than hovering over the felt.
 */
export function EquityBadge({ label }: EquityBadgeProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.badge, { backgroundColor: colors.frostBadge }]}>
      <Text
        variant="footnote"
        tabular
        numberOfLines={1}
        style={[styles.label, { color: colors.onFrostBadge }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.sm,
  },
  label: {
    fontWeight: '800',
    fontStyle: 'italic',
  },
});
