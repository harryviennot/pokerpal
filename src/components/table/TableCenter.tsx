import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { ChipStack } from '@/components/ui/ChipStack';
import { PlayingCard } from '@/components/ui/PlayingCard';
import { Text } from '@/components/ui/Text';
import { snapshotPot, type Card, type TableSnapshot } from '@/engine';
import { useMotionPrefs } from '@/hooks/useMotionPrefs';
import { useTheme } from '@/hooks/useTheme';
import { springs } from '@/theme';
import { formatChips } from '@/utils/format';

import { BOARD_GAP, boardCardSize, boardWidth } from './boardLayout';
import { CardFlip } from './CardFlip';
import { WinnerBanner } from './WinnerBanner';
import { winnerSummary } from './winnerSummary';

export interface TableCenterProps {
  snapshot: TableSnapshot;
  /** Cards that play at showdown; everything else on the board dims. */
  winningFive: ReadonlySet<Card>;
  /** Width of the capsule, which decides how big the board's cards can be. */
  feltWidth: number;
}

/**
 * Where each row sits on the capsule, as a fraction of its height.
 *
 * Measured off the reference rather than spaced evenly: the pot rides high in the
 * top cap, the collected chips sit above the middle, and the board is a shade
 * below it, which leaves the bottom third clear for the hero's own cards.
 */
const ROWS = { pot: '13.5%', chips: '37.6%', board: '48.4%', caption: '64.2%' } as const;

/** How many face-down cards stand in for the board between hands. */
const MYSTERY_CARDS = 3;

/** The middle of the felt: the pot, the board and the result caption. */
export function TableCenter({ snapshot, winningFive, feltWidth }: TableCenterProps) {
  const { colors } = useTheme();
  const pot = snapshotPot(snapshot);
  const summary = winnerSummary(snapshot);
  const tick = usePotTick(pot);
  const cards = boardCardSize(feltWidth);
  // Between hands the board is gone but the felt should not read as empty; the
  // reference stands three unrevealed cards in its place.
  const waiting = snapshot.complete && snapshot.board.length === 0;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View
        accessibilityRole="text"
        accessibilityLabel={`Pot ${formatChips(pot)}`}
        style={[styles.row, { top: ROWS.pot }]}>
        <Text variant="footnote" style={{ color: colors.onFelt }}>
          Pot total
        </Text>
        <Animated.View style={tick}>
          <Text variant="headline" tabular style={[styles.amount, { color: colors.onFelt }]}>
            {formatChips(pot)}
          </Text>
        </Animated.View>
      </View>

      {snapshot.pot > 0 && (
        <View style={[styles.row, { top: ROWS.chips }]}>
          <ChipStack amount={snapshot.pot} size="medium" label="Pot" />
        </View>
      )}

      {/* A fixed five-slot frame, centred on the felt and filled left to
          right: the flop lands in its final slots and the turn and river
          append, so no card ever moves once dealt — as on a real table. The
          waiting trio centres itself inside the same frame. */}
      <View style={[styles.row, { top: ROWS.board }]}>
        <View style={[styles.board, waiting && styles.boardWaiting, { width: boardWidth(cards) }]}>
          {waiting
            ? Array.from({ length: MYSTERY_CARDS }, (_, index) => (
                <PlayingCard key={index} size={cards} mystery />
              ))
            : snapshot.board.map((card, index) => (
                <CardFlip key={card} index={index}>
                  <PlayingCard
                    card={card}
                    size={cards}
                    dimmed={winningFive.size > 0 && !winningFive.has(card)}
                  />
                </CardFlip>
              ))}
        </View>
      </View>

      <View style={[styles.row, { top: ROWS.caption }]}>
        <WinnerBanner summary={summary} />
      </View>
    </View>
  );
}

/** A small scale pulse on the pot amount whenever it changes. */
function usePotTick(pot: number) {
  const { reduceMotion } = useMotionPrefs();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!reduceMotion) {
      scale.value = withSequence(withSpring(1.06, springs.pulse), withSpring(1, springs.pulse));
    }
  }, [pot, reduceMotion, scale]);

  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

const styles = StyleSheet.create({
  // Each row is pinned by its own top edge and centres itself across the felt,
  // so nothing above it can shift anything below.
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  amount: {
    fontWeight: '800',
  },
  board: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: BOARD_GAP,
  },
  boardWaiting: {
    justifyContent: 'center',
  },
});
