import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { radius } from '@/theme';

import { BUTTON_SIZE } from './seatMetrics';

/**
 * The dealer button, a disc on the felt beside whoever has it.
 *
 * On the felt rather than pinned to a plate: it belongs to the table, and moving
 * it round the middle is how a player reads position at a glance.
 */
export function DealerButton() {
  const { colors } = useTheme();

  return (
    <View
      accessibilityLabel="Dealer button"
      style={[styles.disc, { backgroundColor: colors.chip, shadowColor: colors.rim }]}>
      <Text variant="caption" style={[styles.mark, { color: colors.suitBlack }]}>
        D
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  mark: {
    fontWeight: '800',
    fontStyle: 'italic',
  },
});
