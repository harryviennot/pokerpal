import { StyleSheet, View } from 'react-native';
import Animated, { FadeOut, ReduceMotion, ZoomIn } from 'react-native-reanimated';

import { ChipStack } from '@/components/ui/ChipStack';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing, springs } from '@/theme';

import { SEAT_HEIGHT, SEAT_WIDTH } from './seatMetrics';

export interface TableBetProps {
  /** Chips in front of the seat this street. Renders nothing at zero. */
  amount: number;
  /** Badges the bet: this seat has put its whole stack in. */
  allIn?: boolean;
}

const enter = ZoomIn.springify()
  .damping(springs.chip.damping)
  .stiffness(springs.chip.stiffness)
  .mass(springs.chip.mass)
  .reduceMotion(ReduceMotion.System);

// The street's bets leave for the middle as the pot collects them; a short
// fade reads as that without a bespoke flight path.
const exit = FadeOut.duration(150).reduceMotion(ReduceMotion.System);

/**
 * One seat's live bet on the felt, springing in and fading out to the pot.
 *
 * An all-in bet swaps the chip for a badge, because the amount alone does not
 * say the thing that matters: there is nothing left behind it.
 */
export function TableBet({ amount, allIn = false }: TableBetProps) {
  const { colors } = useTheme();

  if (amount <= 0) {
    return null;
  }

  return (
    <View style={styles.bet} pointerEvents="none">
      <Animated.View entering={enter} exiting={exit} style={styles.stack}>
        <ChipStack amount={amount} />
        {allIn && (
          <View style={[styles.badge, { backgroundColor: colors.allInBadge }]}>
            <Text variant="caption" style={[styles.label, { color: colors.onPillDark }]}>
              All in
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Same footprint as a seat, so a bet centres on the spot the geometry hands
  // out without knowing how wide the chip drawing is.
  bet: {
    width: SEAT_WIDTH,
    height: SEAT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: {
    alignItems: 'center',
  },
  // Drawn over the chip it replaces, so the amount below it does not move.
  badge: {
    position: 'absolute',
    top: 0,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  label: {
    fontWeight: '800',
    fontStyle: 'italic',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
