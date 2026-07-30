import { StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { type Card, type ReplaySeat } from '@/engine';
import { spacing } from '@/theme';
import { formatChips } from '@/utils/format';

import { HandRankPlate } from './HandRankPlate';
import { SeatAvatar } from './SeatAvatar';
import { SeatCards } from './SeatCards';
import { CARD_PEEK, HERO_SEAT_WIDTH, SEAT_WIDTH } from './seatMetrics';
import { SeatPill } from './SeatPill';

export interface TableSeatProps {
  seat: ReplaySeat;
  /** The seat this frame's event belongs to. Whitens the plate. */
  active: boolean;
  /** Whether the hole cards are face up. Shown hands are always face up. */
  revealed: boolean;
  /** Cards that play at showdown; face-up cards outside it dim. */
  winningFive: ReadonlySet<Card>;
  /** The made hand, shown on a plate behind the name. */
  handLabel?: string | null;
  /** The verb this seat just played, shown in place of its name. */
  actionLabel?: string | null;
  /** The character portrait. Without one the seat shows a coloured initial. */
  avatar?: ImageSourcePropType;
  /** Frosted badge over the cards — live equity during an all-in run-out. */
  badge?: string | null;
  /** Which edge of the capsule this seat sits against; puts the face outboard. */
  side?: 'left' | 'right';
}

/**
 * One player around the table: a face and a hand tucked behind a name plate.
 *
 * The portrait always sits on the outboard side, so nothing ever covers the
 * middle of the felt. The hero's seat drops the portrait — it has one of its own,
 * far larger, in the corner of the screen — and holds its two cards full size
 * and face up, the way the player would.
 */
export function TableSeat({
  seat,
  active,
  revealed,
  winningFive,
  handLabel = null,
  actionLabel = null,
  avatar,
  badge = null,
  side = 'left',
}: TableSeatProps) {
  const out = seat.status === 'folded' || seat.status === 'sittingOut';
  // A mucked hand is shown anyway, face up and dimmed. Real poker lets a loser
  // hide it, but the player learns nothing from a hand that vanishes — and the
  // reference design turns every losing hand over in grey.
  const faceUp = revealed || seat.shown || seat.mucked;
  // A seat that folded has no cards in front of it any more.
  const cards = out ? null : seat.holeCards;
  const width = revealed ? HERO_SEAT_WIDTH : SEAT_WIDTH;
  // An opponent who shows down brings their hand out from behind the plate and
  // sets it down inboard, where it can actually be read.
  const beside = faceUp && !revealed && cards !== null;

  const hand = (
    <SeatCards
      cards={cards}
      faceUp={faceUp}
      hero={revealed}
      winningFive={winningFive}
      badge={badge}
    />
  );

  return (
    <View style={styles.seat} accessibilityLabel={label(seat)}>
      <View style={[styles.peek, side === 'right' && styles.mirrored]}>
        {!revealed && <SeatAvatar name={seat.id} source={avatar} />}
        {beside ? <View style={styles.gap} /> : hand}
      </View>

      {handLabel !== null && <HandRankPlate label={handLabel} width={width} />}

      <SeatPill seat={seat} active={active} hero={revealed} actionLabel={actionLabel} />

      {beside && (
        <View style={[styles.beside, side === 'left' ? styles.inboardRight : styles.inboardLeft]}>
          {hand}
        </View>
      )}
    </View>
  );
}

function label(seat: ReplaySeat): string {
  if (seat.status === 'folded') {
    return `${seat.id} folded, ${formatChips(seat.stack)} behind`;
  }

  return `${seat.id}, ${formatChips(seat.stack)} behind`;
}

const styles = StyleSheet.create({
  seat: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    // Cards and portrait rise above the box the geometry hands out; the plate is
    // what the geometry actually places.
    flex: 1,
  },
  // The face and the hand overlap the plate's top edge, and the plate is drawn
  // over them.
  peek: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: CARD_PEEK,
    marginBottom: -spacing.base,
    zIndex: 0,
  },
  mirrored: {
    flexDirection: 'row-reverse',
  },
  // Holds the row open when the hand has moved out beside the plate, so the
  // plate does not jump up the felt at showdown.
  gap: {
    height: CARD_PEEK,
  },
  // Level with the plate and just past its edge, overflowing the box the geometry
  // handed out — there is felt there, and nothing else wants it.
  beside: {
    position: 'absolute',
    bottom: -spacing.xs,
  },
  inboardRight: {
    left: '100%',
    marginLeft: spacing.xs,
  },
  inboardLeft: {
    right: '100%',
    marginRight: spacing.xs,
  },
});
