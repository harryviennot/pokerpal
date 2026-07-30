import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useNow } from '@/hooks/useNow';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing } from '@/theme';

import { DECISION_CLOCK_MS } from './pacing';

export interface DecisionClockProps {
  /** Epoch ms the hero's clock runs out, straight from the store. */
  deadline: number;
  /** How long the clock was given, so the bar can show what is left of it. */
  totalMs?: number;
}

/** How often the bar moves. Four times a second reads as sliding, not ticking. */
const TICK_MS = 250;

/** Seconds left at which the clock stops being information and starts being a warning. */
const URGENT_SECONDS = 5;

/**
 * What is left of the hero's clock, in real mode.
 *
 * Display only, and deliberately so: the store already takes the free check or
 * folds when the deadline passes, and a second timer on the screen racing the
 * store's would eventually act twice. This reads `deadline` and draws it.
 */
export function DecisionClock({ deadline, totalMs = DECISION_CLOCK_MS }: DecisionClockProps) {
  const { colors } = useTheme();
  const now = useNow(TICK_MS);
  const remaining = Math.max(0, deadline - now);
  const seconds = Math.ceil(remaining / 1_000);
  const urgent = seconds <= URGENT_SECONDS;
  const share = totalMs > 0 ? Math.min(1, remaining / totalMs) : 0;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`${seconds} seconds to act`}
      style={[styles.clock, { backgroundColor: colors.frostBadge }]}>
      <Text variant="footnote" tabular style={[styles.seconds, { color: colors.onFrostBadge }]}>
        {seconds}s
      </Text>
      <View style={[styles.track, { backgroundColor: colors.consoleDisabled }]}>
        <View
          style={[
            styles.fill,
            // Percentage width rather than a spring: the bar is a clock, and a
            // clock that eases is a clock that lies about how long is left.
            {
              width: `${share * 100}%`,
              backgroundColor: urgent ? colors.actionRed : colors.pillLight,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clock: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  seconds: {
    fontWeight: '800',
  },
  track: {
    width: spacing.xxl * 3,
    height: spacing.xs,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
  },
});
