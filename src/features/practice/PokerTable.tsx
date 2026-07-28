import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { ChipStack } from '@/components/ui/ChipStack';
import { PlayingCard } from '@/components/ui/PlayingCard';
import { Text } from '@/components/ui/Text';
import { snapshotPot, type SeatIndex, type TableSnapshot } from '@/engine';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/theme';

import { SEAT_HEIGHT, SEAT_WIDTH, TableSeat } from './TableSeat';

export interface PokerTableProps {
  snapshot: TableSnapshot;
  /** The seat drawn at the bottom, with its cards face up. */
  heroSeat: SeatIndex;
}

/** How far in from the felt's edge the chips sit, as a fraction of the radius. */
const BET_RADIUS = 0.58;

/**
 * The felt: seats around a racetrack, the board and the pot in the middle.
 *
 * The one custom canvas in the app, and the only screen that positions anything
 * by hand. Geometry comes from the measured size rather than fixed points so a
 * two-handed table and a nine-handed one lay out from the same rule.
 */
export function PokerTable({ snapshot, heroSeat }: PokerTableProps) {
  const { colors } = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;

    setSize({ width, height });
  };

  const count = snapshot.seats.length;
  // Seats are always in the tree — hiding them until the first layout pass
  // would keep them out of the accessibility tree too — but they only become
  // visible once there is a table to place them on.
  const measured = size.width > 0 && size.height > 0;

  return (
    <View style={styles.container} onLayout={onLayout}>
      <View
        style={[
          styles.felt,
          {
            backgroundColor: colors.felt,
            borderColor: colors.feltRail,
            borderRadius: Math.min(size.width, size.height) / 2,
          },
        ]}
      />

      <View style={styles.middle} pointerEvents="none">
        <ChipStack amount={snapshotPot(snapshot)} label="POT" size="medium" />
        <View style={styles.board}>
          {snapshot.board.map((card) => (
            <PlayingCard key={card} card={card} size="medium" />
          ))}
        </View>
        {snapshot.board.length === 0 && (
          <Text variant="footnote" style={[styles.waiting, { color: colors.onFelt }]}>
            Preflop
          </Text>
        )}
      </View>

      <View style={[styles.seats, !measured && styles.unmeasured]}>
        {snapshot.seats.map((seat) => {
          const seatSpot = spot(seat.seat, heroSeat, count, size, 1);
          const betSpot = spot(seat.seat, heroSeat, count, size, BET_RADIUS);

          return (
            <View key={seat.seat}>
              <View style={[styles.absolute, { left: seatSpot.x, top: seatSpot.y }]}>
                <TableSeat
                  seat={seat}
                  onButton={seat.seat === snapshot.button}
                  active={seat.seat === snapshot.actor}
                  revealed={seat.seat === heroSeat}
                />
              </View>
              {seat.bet > 0 && (
                <View style={[styles.absolute, styles.bet, { left: betSpot.x, top: betSpot.y }]}>
                  <ChipStack amount={seat.bet} />
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Where a seat sits on the ellipse, as the top-left corner of a seat-sized box.
 *
 * The hero is pinned to the bottom and the rest run round from there, so the
 * table always reads from the player's own chair.
 */
function spot(
  seat: SeatIndex,
  heroSeat: SeatIndex,
  count: number,
  size: { width: number; height: number },
  radiusScale: number,
): { x: number; y: number } {
  const step = (seat - heroSeat + count) % count;
  // Screen y grows downwards, so a quarter turn is the bottom of the table and
  // subtracting the step walks seats up the right-hand side first.
  const angle = Math.PI / 2 - (2 * Math.PI * step) / count;
  const rx = (size.width / 2 - SEAT_WIDTH / 2) * radiusScale;
  const ry = (size.height / 2 - SEAT_HEIGHT / 2) * radiusScale;

  return {
    x: size.width / 2 + rx * Math.cos(angle) - SEAT_WIDTH / 2,
    y: size.height / 2 + ry * Math.sin(angle) - SEAT_HEIGHT / 2,
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  felt: {
    // Inset so the seats straddle the rail rather than floating outside it.
    position: 'absolute',
    inset: SEAT_HEIGHT / 2,
    borderWidth: spacing.sm,
  },
  middle: {
    alignItems: 'center',
    gap: spacing.md,
  },
  board: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  seats: {
    position: 'absolute',
    inset: 0,
  },
  unmeasured: {
    opacity: 0,
  },
  absolute: {
    position: 'absolute',
  },
  bet: {
    width: SEAT_WIDTH,
    height: SEAT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waiting: {
    opacity: 0.5,
    letterSpacing: 0.4,
  },
});
