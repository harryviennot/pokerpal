import { StyleSheet, View } from 'react-native';
import Animated, { FadeOut, ReduceMotion, ZoomIn } from 'react-native-reanimated';

import { ChipStack } from '@/components/ui/ChipStack';
import { springs } from '@/theme';

import { SEAT_HEIGHT, SEAT_WIDTH } from './TableSeat';

export interface TableBetProps {
  /** Chips in front of the seat this street. Renders nothing at zero. */
  amount: number;
}

const enter = ZoomIn.springify()
  .damping(springs.chip.damping)
  .stiffness(springs.chip.stiffness)
  .mass(springs.chip.mass)
  .reduceMotion(ReduceMotion.System);

// The street's bets leave for the middle as the pot collects them; a short
// fade reads as that without a bespoke flight path.
const exit = FadeOut.duration(150).reduceMotion(ReduceMotion.System);

/** One seat's live bet on the felt, springing in and fading out to the pot. */
export function TableBet({ amount }: TableBetProps) {
  if (amount <= 0) {
    return null;
  }

  return (
    <View style={styles.bet} pointerEvents="none">
      <Animated.View entering={enter} exiting={exit}>
        <ChipStack amount={amount} />
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
});
