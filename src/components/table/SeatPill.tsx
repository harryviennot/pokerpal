import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { type ReplaySeat } from '@/engine';
import { useMotionPrefs } from '@/hooks/useMotionPrefs';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing, springs } from '@/theme';

import { HERO_SEAT_WIDTH, PILL_HEIGHT, SEAT_WIDTH } from './seatMetrics';
import { seatTone, stackLine } from './seatTone';

export interface SeatPillProps {
  seat: ReplaySeat;
  /** This seat is on the clock. Inverts the plate to white, as the reference does. */
  active: boolean;
  /** The hero's plate is wider: it carries a longer name and a made-hand caption. */
  hero?: boolean;
  /** The verb this seat just played — "Raise", "Call" — shown in place of the name. */
  actionLabel?: string | null;
}

/**
 * The plate under a seat's cards: who, and how much.
 *
 * Four states, all from the reference, and all decided in `seatTone`. While a
 * seat is acting the name line gives way to the verb, italic and shouted, because
 * that is the one moment the player needs to read the table rather than the
 * plate.
 */
export function SeatPill({ seat, active, hero = false, actionLabel = null }: SeatPillProps) {
  const { colors } = useTheme();
  const tone = seatTone(seat, active, colors);
  const won = tone.state === 'winner';
  const glow = useWinnerGlow(won);

  return (
    <View style={styles.wrapper}>
      {won && (
        <Text
          accessibilityLabel="Winner"
          variant="footnote"
          style={[styles.crown, { color: colors.plateGoldBorder }]}>
          ♛
        </Text>
      )}
      <Animated.View
        style={[
          styles.pill,
          { width: hero ? HERO_SEAT_WIDTH : SEAT_WIDTH, backgroundColor: tone.background },
          won && [styles.winner, { borderColor: colors.plateGoldBorder }],
          won && { shadowColor: colors.winnerGlow },
          glow,
        ]}>
        <Text
          variant="footnote"
          numberOfLines={1}
          style={[
            styles.name,
            actionLabel !== null && styles.verb,
            tone.state === 'folded' && styles.faded,
            { color: tone.ink },
          ]}>
          {actionLabel ?? seat.id}
        </Text>
        <Text
          variant="title3"
          tabular
          numberOfLines={1}
          style={[styles.stack, tone.state === 'folded' && styles.faded, { color: tone.ink }]}>
          {stackLine(seat)}
        </Text>
      </Animated.View>
    </View>
  );
}

/** Springs the gold shadow in when the seat takes the pot; static without motion. */
function useWinnerGlow(won: boolean) {
  const { reduceMotion } = useMotionPrefs();
  const glow = useSharedValue(0);

  useEffect(() => {
    const target = won ? 1 : 0;

    glow.value = reduceMotion ? target : withSpring(target, springs.glow);
  }, [won, reduceMotion, glow]);

  return useAnimatedStyle(() => ({ shadowOpacity: glow.value }));
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    zIndex: 1,
  },
  pill: {
    minHeight: PILL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  winner: {
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  // Sits on the plate's top edge rather than above it, so the crown reads as
  // part of the plate and not a floating glyph.
  crown: {
    zIndex: 2,
    marginBottom: -spacing.md,
  },
  name: {
    opacity: 0.95,
  },
  verb: {
    fontStyle: 'italic',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stack: {
    fontWeight: '800',
    marginTop: -spacing.xs / 2,
  },
  faded: {
    opacity: 0.7,
  },
});
