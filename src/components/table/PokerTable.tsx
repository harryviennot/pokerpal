import { StyleSheet, View } from 'react-native';

import { describeMadeHand, type ReplaySeat, type SeatIndex, type TableSnapshot } from '@/engine';

import { TableBet } from './TableBet';
import { TableCenter } from './TableCenter';
import { TableFelt } from './TableFelt';
import { TableSeat } from './TableSeat';
import { betSpot, seatSpot, useSeatGeometry } from './useSeatGeometry';
import { winningFive } from './winnerSummary';

export interface PokerTableProps {
  snapshot: TableSnapshot;
  /** The seat drawn at the bottom, with its cards face up. */
  heroSeat: SeatIndex;
}

/**
 * The felt: seats around a racetrack, the board and the pot in the middle.
 *
 * The one custom canvas in the app, and the only screen that positions
 * anything by hand. Geometry comes from the measured size rather than fixed
 * points so a two-handed table and a nine-handed one lay out from one rule.
 */
export function PokerTable({ snapshot, heroSeat }: PokerTableProps) {
  const { size, measured, onLayout } = useSeatGeometry();
  const winning = winningFive(snapshot);
  const count = snapshot.seats.length;

  return (
    <View style={styles.container} onLayout={onLayout}>
      <TableFelt width={size.width} height={size.height} />

      <TableCenter snapshot={snapshot} winningFive={winning} />

      {/* Seats are always in the tree — hiding them until the first layout
          pass would keep them out of the accessibility tree too — but they
          only become visible once there is a table to place them on. */}
      <View style={[styles.seats, !measured && styles.unmeasured]}>
        {snapshot.seats.map((seat) => {
          const hero = seat.seat === heroSeat;
          const spot = seatSpot(seat.seat, heroSeat, count, size);
          const bet = betSpot(spot, size);

          return (
            <View key={seat.seat}>
              <View style={[styles.absolute, { left: spot.x, top: spot.y }]}>
                <TableSeat
                  seat={seat}
                  onButton={seat.seat === snapshot.button}
                  active={seat.seat === snapshot.actor}
                  revealed={hero}
                  winningFive={winning}
                  handLabel={hero ? heroHandLabel(seat, snapshot) : null}
                />
              </View>
              <View style={[styles.absolute, { left: bet.x, top: bet.y }]}>
                <TableBet amount={seat.bet} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** The hero's live made hand; nothing once the hand is over or the hero is out. */
function heroHandLabel(seat: ReplaySeat, snapshot: TableSnapshot): string | null {
  if (snapshot.complete || seat.holeCards === null) {
    return null;
  }

  if (seat.status === 'folded' || seat.status === 'sittingOut') {
    return null;
  }

  return describeMadeHand(seat.holeCards, snapshot.board);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
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
});
