import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { AnimatedText } from '@/components/ui/AnimatedText';
import { Text } from '@/components/ui/Text';
import { type ReplaySeat } from '@/engine';
import { useMotionPrefs } from '@/hooks/useMotionPrefs';
import { useTheme } from '@/hooks/useTheme';
import { radius, spacing, springs } from '@/theme';

import { HERO_SEAT_WIDTH, PILL_HEIGHT, SEAT_WIDTH } from './seatMetrics';
import { seatTone, stackLine, type SeatTone } from './seatTone';

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
  const fade = useToneTransition(tone);

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
      {/* The bevel: the border is the outer view's own colour showing through a
          thin top inset and a fatter bottom one, which no `borderWidth` can draw. */}
      <Animated.View
        style={[
          styles.pill,
          { width: hero ? HERO_SEAT_WIDTH : SEAT_WIDTH },
          won && styles.winner,
          won && { shadowColor: colors.winnerGlow },
          fade.pill,
          glow,
        ]}>
        <Animated.View style={[styles.pillInside, fade.inside]}>
          <AnimatedText
            variant="footnote"
            numberOfLines={1}
            style={[
              styles.name,
              actionLabel !== null && styles.verb,
              tone.state === 'folded' && styles.faded,
              fade.ink,
            ]}>
            {actionLabel ?? seat.id}
          </AnimatedText>
          <AnimatedText
            variant="callout"
            tabular
            numberOfLines={1}
            style={[
              styles.stack,
              tone.state === 'folded' && styles.faded,
              hero && styles.heroStack,
              fade.ink,
            ]}>
            {stackLine(seat)}
          </AnimatedText>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/**
 * Springs the plate's three colours toward the current tone, so a state change
 * crossfades instead of snapping; instant when motion is reduced. The `tone`
 * preset is critically damped on purpose — see its note in `theme/motion`.
 */
function useToneTransition(tone: SeatTone) {
  const { reduceMotion } = useMotionPrefs();
  const { background, backgroundBorder, ink } = tone;

  const pill = useAnimatedStyle(
    () => ({
      backgroundColor: reduceMotion ? backgroundBorder : withSpring(backgroundBorder, springs.tone),
    }),
    [backgroundBorder, reduceMotion],
  );
  const inside = useAnimatedStyle(
    () => ({
      backgroundColor: reduceMotion ? background : withSpring(background, springs.tone),
    }),
    [background, reduceMotion],
  );
  const inkStyle = useAnimatedStyle(
    () => ({ color: reduceMotion ? ink : withSpring(ink, springs.tone) }),
    [ink, reduceMotion],
  );

  return { pill, inside, ink: inkStyle };
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
    padding: 1.5,
    paddingBottom: spacing.xs,
    borderRadius: radius.sm,
  },
  pillInside: {
    borderRadius: radius.sm - 1.5,
    paddingHorizontal: spacing.sm,
    // Fills the bevel's inner box. `flex: 1` alone does that; a percentage
    // height would resolve against nothing while the pill is content-sized.
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
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
    // A step up from the footnote name it replaces: shouted, but still a line.
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stack: {
    fontWeight: '800',
    marginTop: -spacing.xs,
  },
  // Between callout and title3, neither of which reads right at this width:
  // callout vanishes under the fanned cards, title3 crowds the bevel.
  heroStack: {
    fontSize: 18,
  },
  faded: {
    opacity: 0.7,
  },
});
