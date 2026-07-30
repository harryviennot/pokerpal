import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';

export interface HandRankPlateProps {
  /** The made hand, in sentence case; the plate shouts it. */
  label: string;
  width: number;
}

/**
 * The made-hand strip that sits behind and above a seat's name plate.
 *
 * Its bottom is deliberately covered by the plate in front of it, which is what
 * makes the two read as one block rather than two badges.
 */
export function HandRankPlate({ label, width }: HandRankPlateProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.plate, { width, backgroundColor: colors.pillDark }]}>
      <Text
        variant="caption"
        numberOfLines={1}
        style={[styles.label, { color: colors.onPillDark }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    alignItems: 'center',
    paddingTop: spacing.xs / 2,
    // Enough tail for the name plate to overlap and hide.
    paddingBottom: spacing.sm,
    marginBottom: -spacing.sm,
    borderRadius: radius.sm,
  },
  label: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
