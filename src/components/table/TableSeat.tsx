import { StyleSheet, View } from 'react-native';

import { PlayingCard } from '@/components/ui/PlayingCard';
import { Text } from '@/components/ui/Text';
import { type Card, type ReplaySeat } from '@/engine';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';
import { formatChips } from '@/utils/format';

import { SeatAvatar } from './SeatAvatar';
import { SeatPill } from './SeatPill';

export const SEAT_WIDTH = 96;
export const SEAT_HEIGHT = 96;

export interface TableSeatProps {
  seat: ReplaySeat;
  onButton: boolean;
  /** The seat this frame's event belongs to. Inverts the pill. */
  active: boolean;
  /** Whether the hole cards are face up. Shown hands are always face up. */
  revealed: boolean;
  /** Cards that play at showdown; face-up cards outside it dim. */
  winningFive: ReadonlySet<Card>;
  /** The hero's live made hand, shown as a caption over the pill. */
  handLabel?: string | null;
}

/**
 * One player around the table: avatar and cards peeking over the name pill.
 *
 * The hero's seat drops the avatar and fans its two cards large and face up,
 * the way the player would hold them; everyone else shows small backs.
 */
export function TableSeat({
  seat,
  onButton,
  active,
  revealed,
  winningFive,
  handLabel = null,
}: TableSeatProps) {
  const { colors } = useTheme();
  const out = seat.status === 'folded' || seat.status === 'sittingOut';
  const faceUp = revealed || seat.shown;
  // A seat that folded or mucked has no cards in front of it any more.
  const holeCards = out || seat.mucked ? null : seat.holeCards;
  const dims = (card: Card): boolean => faceUp && winningFive.size > 0 && !winningFive.has(card);

  return (
    <View style={[styles.wrapper, out && styles.out]} accessibilityLabel={label(seat)}>
      <View style={styles.peek}>
        {!revealed && <SeatAvatar name={seat.id} crowned={seat.won > 0} />}
        {holeCards ? (
          holeCards.map((card, index) => (
            <View key={card} style={cardStyle(revealed, index)}>
              <PlayingCard
                size={revealed ? 'large' : 'small'}
                card={faceUp ? card : undefined}
                faceDown={!faceUp}
                dimmed={dims(card)}
              />
            </View>
          ))
        ) : (
          <View style={styles.cardSpacer} />
        )}
      </View>

      {handLabel !== null && (
        <View style={[styles.handLabel, { backgroundColor: colors.feltOverlay }]}>
          <Text variant="caption" numberOfLines={1} style={{ color: colors.onFelt }}>
            {handLabel}
          </Text>
        </View>
      )}

      <SeatPill seat={seat} active={active} />

      {onButton && (
        <View
          accessibilityLabel="Dealer button"
          style={[styles.button, { backgroundColor: colors.chip }]}>
          <Text variant="caption" style={[styles.buttonLabel, { color: colors.suitBlack }]}>
            D
          </Text>
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

/** The hero's cards fan apart; an opponent's backs just overlap. */
function cardStyle(revealed: boolean, index: number) {
  if (revealed) {
    return index === 0 ? styles.heroCard : styles.heroSecond;
  }

  return index === 1 ? styles.backSecond : undefined;
}

const styles = StyleSheet.create({
  wrapper: {
    width: SEAT_WIDTH,
    height: SEAT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  out: {
    opacity: 0.4,
  },
  // Avatar and cards sit behind the pill, peeking over its top edge.
  peek: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    marginBottom: -spacing.md,
    zIndex: 0,
  },
  backSecond: {
    marginLeft: -spacing.sm,
  },
  heroCard: {
    transform: [{ rotate: '-4deg' }],
  },
  heroSecond: {
    marginLeft: -spacing.base,
    transform: [{ rotate: '5deg' }],
  },
  cardSpacer: {
    height: 42,
  },
  handLabel: {
    maxWidth: SEAT_WIDTH * 1.5,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.full,
    marginBottom: spacing.xs / 2,
    zIndex: 1,
  },
  button: {
    position: 'absolute',
    right: -2,
    bottom: 0,
    width: 18,
    height: 18,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontWeight: '700',
  },
});
