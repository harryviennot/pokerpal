import { StyleSheet, View } from 'react-native';

import { PlayingCard } from '@/components/ui/PlayingCard';
import { Text } from '@/components/ui/Text';
import { type ReplaySeat } from '@/engine';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';
import { formatChips } from '@/utils/format';

export const SEAT_WIDTH = 84;
export const SEAT_HEIGHT = 78;

export interface TableSeatProps {
  seat: ReplaySeat;
  onButton: boolean;
  /** The seat this frame's event belongs to. Draws the ring. */
  active: boolean;
  /** Whether the hole cards are face up. Shown hands are always face up. */
  revealed: boolean;
}

/** One player around the table: their cards, their name and what they have left. */
export function TableSeat({ seat, onButton, active, revealed }: TableSeatProps) {
  const { colors } = useTheme();
  const out = seat.status === 'folded' || seat.status === 'sittingOut';
  const faceUp = revealed || seat.shown;
  // A seat that folded or mucked has no cards in front of it any more.
  const holeCards = out || seat.mucked ? null : seat.holeCards;

  return (
    <View style={[styles.wrapper, out && styles.out]} accessibilityLabel={label(seat)}>
      <View style={styles.cards}>
        {holeCards ? (
          holeCards.map((card) => (
            <PlayingCard
              key={card}
              size="small"
              card={faceUp ? card : undefined}
              faceDown={!faceUp}
            />
          ))
        ) : (
          <View style={styles.cardSpacer} />
        )}
      </View>

      <View
        style={[
          styles.plate,
          { backgroundColor: colors.feltRail },
          active && { borderColor: colors.tint },
          seat.won > 0 && { borderColor: colors.success },
        ]}>
        <Text variant="caption" numberOfLines={1} style={{ color: colors.onFelt }}>
          {seat.id}
        </Text>
        <Text
          variant="footnote"
          tabular
          numberOfLines={1}
          style={{ color: seat.stack === 0 ? colors.warning : colors.onFelt }}>
          {seat.stack === 0 && seat.status === 'allIn' ? 'All in' : formatChips(seat.stack)}
        </Text>
      </View>

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

const styles = StyleSheet.create({
  wrapper: {
    width: SEAT_WIDTH,
    height: SEAT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  out: {
    opacity: 0.4,
  },
  cards: {
    flexDirection: 'row',
    gap: 2,
  },
  cardSpacer: {
    height: 42,
  },
  plate: {
    width: SEAT_WIDTH,
    alignItems: 'center',
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: 'transparent',
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
