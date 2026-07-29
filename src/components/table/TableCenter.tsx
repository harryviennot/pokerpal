import { StyleSheet, View } from 'react-native';

import { PlayingCard } from '@/components/ui/PlayingCard';
import { Text } from '@/components/ui/Text';
import { snapshotPot, type Card, type TableSnapshot } from '@/engine';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';
import { formatChips } from '@/utils/format';

import { WinnerBanner } from './WinnerBanner';
import { winnerSummary } from './winnerSummary';

export interface TableCenterProps {
  snapshot: TableSnapshot;
  /** Cards that play at showdown; everything else on the board dims. */
  winningFive: ReadonlySet<Card>;
}

/** The middle of the felt: the pot, the board and the result banner. */
export function TableCenter({ snapshot, winningFive }: TableCenterProps) {
  const { colors } = useTheme();
  const pot = snapshotPot(snapshot);
  const summary = winnerSummary(snapshot);

  return (
    <View style={styles.middle} pointerEvents="none">
      <View
        accessibilityRole="text"
        accessibilityLabel={`Pot ${formatChips(pot)}`}
        style={[styles.pot, { backgroundColor: colors.feltOverlay }]}>
        <Text variant="caption" style={[styles.potLabel, { color: colors.onFelt }]}>
          Pot total
        </Text>
        <Text variant="headline" tabular style={{ color: colors.onFelt }}>
          {formatChips(pot)}
        </Text>
      </View>

      <View style={styles.board}>
        {snapshot.board.map((card) => (
          <PlayingCard
            key={card}
            card={card}
            size="medium"
            dimmed={winningFive.size > 0 && !winningFive.has(card)}
          />
        ))}
      </View>

      {snapshot.board.length === 0 && summary === null && (
        <Text variant="footnote" style={[styles.waiting, { color: colors.onFelt }]}>
          Preflop
        </Text>
      )}

      <WinnerBanner summary={summary} />
    </View>
  );
}

const styles = StyleSheet.create({
  middle: {
    alignItems: 'center',
    gap: spacing.md,
  },
  pot: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    gap: 2,
  },
  potLabel: {
    opacity: 0.7,
    letterSpacing: 0.4,
  },
  board: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  waiting: {
    opacity: 0.5,
    letterSpacing: 0.4,
  },
});
