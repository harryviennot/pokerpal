import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { radius } from '@/theme';
import { formatChips } from '@/utils/format';

export type ChipStackSize = 'small' | 'medium';

export interface ChipStackProps {
  /** Chips in the stack. Nothing renders at zero. */
  amount: number;
  /** Names the amount for accessibility: `Pot`, a blind name, whatever it is. */
  label?: string;
  size?: ChipStackSize;
  accessibilityLabel?: string;
}

const DISC: Record<ChipStackSize, number> = { small: 18, medium: 24 };

/**
 * A wagered amount on the felt: one chip with the amount under it, the way
 * the table art draws a bet in front of a seat.
 */
export function ChipStack({ amount, label, size = 'small', accessibilityLabel }: ChipStackProps) {
  const { colors } = useTheme();

  if (amount <= 0) {
    return null;
  }

  const disc = DISC[size];

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? `${label ?? 'Bet'} ${formatChips(amount)}`}
      style={styles.stack}>
      <View
        style={[
          styles.disc,
          { width: disc, height: disc, backgroundColor: colors.chip, borderColor: colors.suitRed },
        ]}>
        <View style={[styles.discCenter, { backgroundColor: colors.cardFace }]} />
      </View>
      <Text
        variant={size === 'medium' ? 'headline' : 'footnote'}
        tabular
        style={[styles.amount, { color: colors.onFelt }]}
        numberOfLines={1}>
        {formatChips(amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    alignItems: 'center',
    gap: 2,
  },
  // A poker chip read from above: a ring of edge color around a lighter center.
  disc: {
    borderRadius: radius.full,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discCenter: {
    width: '55%',
    height: '55%',
    borderRadius: radius.full,
  },
  amount: {
    fontWeight: '700',
  },
});
