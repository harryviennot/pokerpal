import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { PlayingCard, type PlayingCardSize } from '@/components/ui/PlayingCard';
import { type Card } from '@/engine';
import { useMotionPrefs } from '@/hooks/useMotionPrefs';
import { radius, spacing, springs } from '@/theme';

import { DealIn } from './DealIn';
import { EquityBadge } from './EquityBadge';
import { CARD_PEEK } from './seatMetrics';

export interface SeatCardsProps {
  /** Null once the seat folds or mucks: there is nothing in front of them. */
  cards: readonly [Card, Card] | null;
  /** Face up — the hero always, an opponent only once they show. */
  faceUp: boolean;
  /** The hero holds their cards full size and fanned; everyone else shows backs. */
  hero: boolean;
  /** Cards that play at showdown; face-up cards outside it dim. */
  winningFive: ReadonlySet<Card>;
  /** Frosted badge over the hand — live equity during an all-in run-out. */
  badge?: string | null;
  /** This seat is on the clock: the hero's fan perks up while it is. */
  active?: boolean;
}

/** The hand a seat is holding, tucked behind its name plate. */
export function SeatCards({
  cards,
  faceUp,
  hero,
  winningFive,
  badge = null,
  active = false,
}: SeatCardsProps) {
  const lift = useTurnLift(hero && active);

  if (cards === null) {
    return <View style={styles.spacer} />;
  }

  const size: PlayingCardSize = hero ? 'xl' : faceUp ? 'medium' : 'small';

  return (
    <View style={styles.hand}>
      {cards.map((card, index) => (
        <Animated.View key={card} style={hero ? lift[index === 0 ? 'first' : 'second'] : null}>
          <View style={fan(hero, index)}>
            <DealIn variant="scale">
              <PlayingCard
                size={size}
                card={faceUp ? card : undefined}
                faceDown={!faceUp}
                dimmed={faceUp && winningFive.size > 0 && !winningFive.has(card)}
              />
            </DealIn>
          </View>
        </Animated.View>
      ))}

      {badge !== null && (
        // Clipped to the hand's own rounded rect, so the badge is cut by the
        // card corner exactly as it is in the reference.
        <View style={styles.clip} pointerEvents="none">
          <View style={styles.badge}>
            <EquityBadge label={badge} />
          </View>
        </View>
      )}
    </View>
  );
}

/** The hero fans their cards wide; an opponent's backs just lean on each other. */
function fan(hero: boolean, index: number) {
  if (hero) {
    return index === 0 ? styles.heroFirst : styles.heroSecond;
  }

  return index === 0 ? styles.backFirst : styles.backSecond;
}

/** How far the resting fan tucks down, and how much closer its cards sit, in points. */
const TUCK = 3;

/**
 * The hero's fan reacting to the clock: resting, the two cards sit a touch
 * lower and closer together; when the table turns to the hero they rise and
 * separate. The translate rides outside the fan's own rotation, so the tuck
 * moves the cards without disturbing the lean. Instant under reduced motion.
 */
function useTurnLift(up: boolean) {
  const { reduceMotion } = useMotionPrefs();
  const progress = useSharedValue(up ? 1 : 0);

  useEffect(() => {
    const target = up ? 1 : 0;

    progress.value = reduceMotion ? target : withSpring(target, springs.deal);
  }, [up, reduceMotion, progress]);

  const first = useAnimatedStyle(() => ({
    transform: [{ translateY: TUCK * (1 - progress.value) }],
  }));
  const second = useAnimatedStyle(() => ({
    transform: [
      { translateY: TUCK * (1 - progress.value) },
      { translateX: -TUCK * (1 - progress.value) },
    ],
  }));

  return { first, second };
}

const styles = StyleSheet.create({
  hand: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  // Holds the plate down to the same place when a seat has no cards, so folding
  // does not make the whole seat jump.
  spacer: {
    height: CARD_PEEK,
  },
  heroFirst: {
    transform: [{ rotate: '-4deg' }],
  },
  heroSecond: {
    marginLeft: -spacing.md,
    transform: [{ rotate: '5deg' }],
    // Left-cast shadow so the top card reads as sitting above the one it overlaps.
    boxShadow: '-3px 0 15px rgba(0, 0, 0, 0.2)',
    borderRadius: radius.xs,
  },
  backFirst: {
    transform: [{ rotate: '-8deg' }],
  },
  backSecond: {
    marginLeft: -spacing.sm,
    transform: [{ rotate: '5deg' }],
  },
  clip: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    borderRadius: radius.sm,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  // Clear of the plate that overlaps the bottom of the hand, so a badge is never
  // hidden by the name in front of it.
  badge: {
    marginBottom: spacing.md,
  },
});
