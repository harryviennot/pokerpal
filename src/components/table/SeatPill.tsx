import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { type ReplaySeat } from '@/engine';
import { useTheme, type Theme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';
import { formatChips } from '@/utils/format';

import { SEAT_WIDTH } from './TableSeat';

export interface SeatPillProps {
  seat: ReplaySeat;
  /** Inverts the pill while this seat is acting. */
  active: boolean;
}

/**
 * The name plate under a seat's cards: name over the stack. Inverts for the
 * acting player and goes gold around a winner's chip gain.
 */
export function SeatPill({ seat, active }: SeatPillProps) {
  const { colors } = useTheme();
  const won = seat.won > 0;

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: active ? colors.seatPillActive : colors.seatPill },
        won && [styles.winnerGlow, { borderColor: colors.winner, shadowColor: colors.winnerGlow }],
      ]}>
      <Text
        variant="caption"
        numberOfLines={1}
        style={[styles.name, { color: active ? colors.onSeatPillActive : colors.onSeatPillMuted }]}>
        {seat.id}
      </Text>
      <Text
        variant="footnote"
        tabular
        numberOfLines={1}
        style={[styles.stack, { color: stackColor(seat, active, colors) }]}>
        {stackLine(seat)}
      </Text>
    </View>
  );
}

/** The pill's second line: the chips gained, all in, or the stack behind. */
function stackLine(seat: ReplaySeat): string {
  if (seat.won > 0) {
    return `+${formatChips(seat.won)}`;
  }

  return seat.stack === 0 && seat.status === 'allIn' ? 'All in' : formatChips(seat.stack);
}

function stackColor(seat: ReplaySeat, active: boolean, colors: Theme['colors']): string {
  if (seat.won > 0) {
    return colors.winner;
  }

  if (seat.stack === 0) {
    return colors.warning;
  }

  return active ? colors.onSeatPillActive : colors.onSeatPill;
}

const styles = StyleSheet.create({
  pill: {
    width: SEAT_WIDTH,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    zIndex: 1,
  },
  winnerGlow: {
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  name: {
    opacity: 0.9,
  },
  stack: {
    fontWeight: '700',
  },
});
