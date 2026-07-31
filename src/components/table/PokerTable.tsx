import { StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { type SeatIndex, type TableSnapshot } from '@/engine';
import { spacing } from '@/theme';

import { DealerButton } from './DealerButton';
import { GameBackdrop } from './GameBackdrop';
import { SeatAvatar } from './SeatAvatar';
import { SEAT_PEEK_OVERHANG } from './seatMetrics';
import { capsuleRect } from './tableArt';
import { TableBet } from './TableBet';
import { TableCenter } from './TableCenter';
import { TableFelt } from './TableFelt';
import { TableSeat } from './TableSeat';
import {
  betSpot,
  buttonSpot,
  seatBox,
  seatSide,
  seatSpot,
  useSeatGeometry,
} from './useSeatGeometry';
import { madeHandLabel, winningFive } from './winnerSummary';

export interface PokerTableProps {
  snapshot: TableSnapshot;
  /** The seat drawn at the bottom, with its cards face up. */
  heroSeat: SeatIndex;
  /** Character portraits by seat index. Seats without one show a coloured initial. */
  seatAvatars?: readonly ImageSourcePropType[];
  /** A frosted badge over each seat's cards by seat index — live equity, say. */
  seatBadges?: readonly (string | null)[];
  /** The verb the acting seat just played, from the frame being shown. */
  actionLabel?: string | null;
  /**
   * The seat the table is waiting on, whose plate inverts to white.
   *
   * Distinct from the frame's `actor`, who has already acted and shows the verb
   * on a dark plate. A replay has nobody on the clock, so the default is nobody.
   */
  onClock?: SeatIndex | null;
  /**
   * Minimum distance between a seat's box and this component's own edges, in
   * points. The full-bleed game screen passes its screen margin here; a host
   * that already pads itself can leave it at zero.
   */
  edgeKeepout?: number;
  /** Paints the arena field behind the felt. Off when the screen paints its own. */
  backdrop?: boolean;
}

/**
 * Clearance between the edge of the component and the table.
 *
 * Small on purpose: the reference runs the capsule almost to the bezel, and the
 * screens that host this already pad their own edges.
 */
const MARGIN = spacing.xs;

/**
 * The felt: seats around a capsule, the board and the pot in the middle.
 *
 * The one custom canvas in the app, and the only screen that positions anything
 * by hand. Everything is placed against the capsule's own rect rather than the
 * component's, so a phone-sized table and the tracker's smaller one lay out from
 * one set of fractions — see `seatSlots`.
 *
 * Driven entirely by a `TableSnapshot`: everything richer than that, portraits
 * and equity badges and the acting player's verb, arrives as an optional prop, so
 * a caller with only a replay log gets the same table with fewer decorations.
 */
export function PokerTable({
  snapshot,
  heroSeat,
  seatAvatars,
  seatBadges,
  actionLabel = null,
  onClock = null,
  edgeKeepout = 0,
  backdrop = true,
}: PokerTableProps) {
  const { size, measured, onLayout } = useSeatGeometry();
  const capsule = capsuleRect(size, MARGIN);
  const felt = { width: capsule.width, height: capsule.height };
  // The keep-out is measured from this component's edge to the seat's nearest
  // visible pixel — the bust overhangs the positioned box, so it is counted in.
  // The felt starts `capsule.left` in already; only the shortfall constrains.
  const seatInset = Math.max(0, edgeKeepout + SEAT_PEEK_OVERHANG - capsule.left);
  const winning = winningFive(snapshot);
  const count = snapshot.seats.length;
  const hero = snapshot.seats[heroSeat];

  return (
    <View style={styles.container} onLayout={onLayout}>
      {backdrop && <GameBackdrop />}

      {/* Seats are always in the tree — hiding them until the first layout pass
          would keep them out of the accessibility tree too — but they only
          become visible once there is a table to place them on. */}
      <View style={[styles.absolute, capsule, !measured && styles.unmeasured]}>
        <TableFelt width={felt.width} height={felt.height} />

        {/* Over the felt but under every plate, leaning off the rail and cropped
            by the edge of the screen, the way the reference frames it. */}
        {hero && seatAvatars?.[heroSeat] !== undefined && (
          <View style={styles.portrait} pointerEvents="none">
            <SeatAvatar hero name={hero.id} source={seatAvatars[heroSeat]} />
          </View>
        )}

        <TableCenter snapshot={snapshot} winningFive={winning} feltWidth={felt.width} />

        {snapshot.seats.map((seat) => {
          // A busted player leaves their chair empty rather than closing the
          // gap: nobody else moves when someone goes broke.
          if (seat.status === 'sittingOut') {
            return null;
          }

          const isHero = seat.seat === heroSeat;
          const spot = seatSpot(seat.seat, heroSeat, count, felt, seatInset);
          const bet = betSpot(seat.seat, heroSeat, count, felt);
          const button = buttonSpot(seat.seat, heroSeat, count, felt);

          return (
            <View key={seat.seat}>
              <View style={[styles.absolute, spotStyle(spot), seatBox(isHero)]}>
                <TableSeat
                  seat={seat}
                  active={seat.seat === onClock}
                  revealed={isHero}
                  winningFive={winning}
                  handLabel={madeHandLabel(seat, snapshot, isHero)}
                  actionLabel={seat.seat === snapshot.actor ? actionLabel : null}
                  avatar={seatAvatars?.[seat.seat]}
                  badge={seatBadges?.[seat.seat] ?? null}
                  side={seatSide(seat.seat, heroSeat, count)}
                />
              </View>
              <View style={[styles.absolute, spotStyle(bet)]}>
                <TableBet amount={seat.bet} allIn={seat.status === 'allIn'} />
              </View>
              {seat.seat === snapshot.button && (
                <View style={[styles.absolute, spotStyle(button)]}>
                  <DealerButton />
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function spotStyle(spot: { x: number; y: number }) {
  return { left: spot.x, top: spot.y };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  absolute: {
    position: 'absolute',
  },
  unmeasured: {
    opacity: 0,
  },
  portrait: {
    position: 'absolute',
    left: -spacing.xxl,
    bottom: 0,
  },
});
