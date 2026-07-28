import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';
import { formatChips } from '@/utils/format';

export type ChipStackSize = 'small' | 'medium';

export interface ChipStackProps {
  /** Chips in the stack. Nothing renders at zero. */
  amount: number;
  /** Sits above the amount: `Pot`, a blind name, whatever the stack is. */
  label?: string;
  size?: ChipStackSize;
  accessibilityLabel?: string;
}

/** A wagered amount on the felt, drawn as a short stack of chips beside the figure. */
export function ChipStack({ amount, label, size = 'small', accessibilityLabel }: ChipStackProps) {
  const { colors } = useTheme();

  if (amount <= 0) {
    return null;
  }

  const large = size === 'medium';
  const disc = large ? 12 : 9;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? `${label ?? 'Bet'} ${formatChips(amount)}`}
      style={[styles.pill, large && styles.pillLarge, { backgroundColor: colors.feltRail }]}>
      <View style={styles.discs}>
        {[0, 1, 2].map((index) => (
          <View
            key={index}
            style={[
              {
                width: disc,
                height: disc,
                borderRadius: radius.full,
                backgroundColor: colors.chip,
                // Stacked back to front, each disc a little dimmer than the one
                // in front of it — depth without a shadow.
                opacity: 1 - index * 0.25,
                marginLeft: index === 0 ? 0 : -disc * 0.55,
              },
            ]}
          />
        ))}
      </View>
      <View>
        {label !== undefined && (
          <Text variant="caption" style={[styles.label, { color: colors.onFelt }]}>
            {label}
          </Text>
        )}
        <Text
          variant={large ? 'headline' : 'caption'}
          tabular
          style={{ color: colors.onFelt }}
          numberOfLines={1}>
          {formatChips(amount)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  pillLarge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  discs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    opacity: 0.7,
    letterSpacing: 0.4,
  },
});
