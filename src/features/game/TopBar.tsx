import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { type BlindLevel } from '@/engine';
import { useNow } from '@/hooks/useNow';
import { useTheme } from '@/hooks/useTheme';
import { MIN_TOUCH_TARGET, radius, spacing } from '@/theme';
import { formatClock } from '@/utils/format';

import { LEVEL_LENGTH_MS } from './pacing';
import { type GameMode } from './types';

export interface TopBarProps {
  /** Real mode gets a blind clock, and asks before it lets a session be abandoned. */
  mode: GameMode;
  /** Epoch ms the session began. Both clocks are this plus the wall clock. */
  startedAt: number;
  /** The blind ladder. A single level means there is nothing to count down to. */
  levels: readonly BlindLevel[];
  onLeave: () => void;
}

/**
 * The chrome over the felt: the way out, the session clock, the way to the coach.
 *
 * Nothing here is stored. The session clock and the blind clock are both derived
 * from `startedAt` and one interval, because a countdown kept in the game store
 * would wake every subscriber on the screen once a second to tell them a number
 * changed.
 *
 * The reference's top-right money pill is a review button instead: this app's
 * equivalent of checking your balance is checking what the coach made of the last
 * few hands, and a session with no way into that is a session with no coaching.
 */
export function TopBar({ mode, startedAt, levels, onLeave }: TopBarProps) {
  const { colors } = useTheme();
  const now = useNow();
  const next = nextLevel(levels, now - startedAt);
  // The arena is a lit blue stage in both schemes, so the chrome on it is the
  // same white as the pot caption rather than the scheme's label colour.
  const ink = { color: colors.onFelt };

  const leave = (): void => {
    if (mode !== 'real') {
      onLeave();

      return;
    }

    // Real mode has a clock and no rebuys, so walking away is not a pause — the
    // session ends where it stands and the summary is written from it.
    Alert.alert('Leave this session?', 'The session ends here. Your hands are already saved.', [
      { text: 'Keep playing', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: onLeave },
    ]);
  };

  return (
    <View style={styles.bar} pointerEvents="box-none">
      <View style={styles.row}>
        <CircleButton glyph="‹" label="Leave the table" onPress={leave} />

        <View style={styles.clock}>
          <Text variant="footnote" style={[styles.icon, ink]}>
            ⏱
          </Text>
          <Text variant="title3" tabular style={[styles.elapsed, ink]}>
            {formatClock(now - startedAt)}
          </Text>
        </View>

        <View style={styles.spacer} />

        <CircleButton
          glyph="☰"
          label="Review this session"
          onPress={() => router.push('/game/review')}
        />
      </View>

      {mode === 'real' && next !== null && (
        <View style={styles.level} pointerEvents="none">
          <Text variant="subheadline" tabular style={[styles.levelLine, ink]}>
            in {formatClock(next.inMs)}
          </Text>
          <Text variant="subheadline" tabular style={[styles.levelLine, styles.stakes, ink]}>
            {next.level.smallBlind} - {next.level.bigBlind}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * The blinds coming next, and how long until they arrive.
 *
 * Null at the top of the ladder: `advanceToLevel` clamps there, so a countdown
 * would be counting down to the level already being played. The level index is
 * the same arithmetic the pump uses when it books a hand, which is what keeps the
 * clock on screen honest about what will actually happen.
 */
function nextLevel(
  levels: readonly BlindLevel[],
  elapsedMs: number,
): { level: BlindLevel; inMs: number } | null {
  const elapsed = Math.max(0, elapsedMs);
  const index = Math.floor(elapsed / LEVEL_LENGTH_MS) + 1;
  const level = levels[index];

  return level ? { level, inMs: LEVEL_LENGTH_MS - (elapsed % LEVEL_LENGTH_MS) } : null;
}

interface CircleButtonProps {
  glyph: string;
  label: string;
  onPress: () => void;
}

/** A round control on the backdrop, outlined rather than filled, as the reference has it. */
function CircleButton({ glyph, label, onPress }: CircleButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.circle,
        { borderColor: colors.onFelt },
        pressed && styles.pressed,
      ]}>
      <Text variant="title3" style={[styles.glyph, { color: colors.onFelt }]}>
        {glyph}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: spacing.base,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  circle: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
  },
  glyph: {
    fontWeight: '700',
  },
  clock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  icon: {
    opacity: 0.9,
  },
  elapsed: {
    fontWeight: '800',
  },
  spacer: {
    flex: 1,
  },
  level: {
    alignItems: 'flex-end',
  },
  levelLine: {
    fontWeight: '700',
  },
  stakes: {
    marginTop: -spacing.xs / 2,
  },
  pressed: {
    opacity: 0.6,
  },
});
