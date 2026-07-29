import { StyleSheet, View } from 'react-native';

import { ChipStack } from '@/components/ui/ChipStack';

import { SEAT_HEIGHT, SEAT_WIDTH } from './TableSeat';

export interface TableBetProps {
  /** Chips in front of the seat this street. Renders nothing at zero. */
  amount: number;
}

/**
 * One seat's live bet on the felt. A thin wrapper today; the chip's travel
 * toward the pot lands here so the seat layout never has to know about it.
 */
export function TableBet({ amount }: TableBetProps) {
  if (amount <= 0) {
    return null;
  }

  return (
    <View style={styles.bet} pointerEvents="none">
      <ChipStack amount={amount} />
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
